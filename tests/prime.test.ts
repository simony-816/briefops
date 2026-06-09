import { describe, expect, it } from "vitest";
import { setDefaultWorker } from "../src/core/config.js";
import { addWorkLog } from "../src/core/log.js";
import { addMemory } from "../src/core/memory.js";
import { primeContext } from "../src/core/prime.js";
import { createProject } from "../src/core/project.js";
import { createSkill } from "../src/core/skill.js";
import { estimateTokens } from "../src/core/tokens.js";
import { createWorker } from "../src/core/worker.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

async function seedPrimeWorkspace(dir: string): Promise<void> {
  await initWorkspace(dir);
  await createSkill({
    cwd: dir,
    name: "risk-review",
    description: "Review changes for risk and governance violations."
  });
  await createProject({
    cwd: dir,
    name: "atlas-q",
    description: "Rule-based quantitative trading system."
  });
  await createWorker({
    cwd: dir,
    name: "quant-reviewer",
    description: "Risk-focused reviewer.",
    project: "atlas-q",
    skills: ["risk-review"],
    style: ["verify before completion"]
  });
}

describe("prime context", () => {
  it("returns a short setup response when no workspace exists", async () => {
    await withTempDir(async (dir) => {
      const result = await primeContext({
        cwd: dir,
        task: "Start work.",
        maxTokens: 300,
        format: "codex"
      });

      expect(result.status).toBe("setup-required");
      expect(result.content).toContain("briefops init");
      expect(result.content).toContain("briefops codex plugin install");
      expect(result.content).toContain("briefops worker use <worker>");
      expect(result.tokens).toBeLessThanOrEqual(300);
    });
  });

  it("emits compact ready context without full resume pack content", async () => {
    await withTempDir(async (dir) => {
      await seedPrimeWorkspace(dir);
      await setDefaultWorker({ cwd: dir, worker: "quant-reviewer" });
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Always verify turnover warning threshold before merge recommendation."
      });
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review rebalance logic",
        result: "Found missing turnover warning check.",
        openRisks: ["Slippage assumptions remain unverified."],
        nextSteps: ["Verify slippage assumptions against policy."]
      });

      const result = await primeContext({
        cwd: dir,
        task: "Continue unresolved slippage checks.",
        maxTokens: 800,
        format: "codex"
      });

      expect(result.status).toBe("ready");
      expect(result.content).toContain("# BriefOps Prime Context");
      expect(result.content).toContain("quant-reviewer");
      expect(result.content).toContain("Token Budget");
      expect(result.content).toContain("Always verify turnover warning");
      expect(result.content).not.toContain("# BriefOps Portable Resume Pack");
      expect(result.tokens).toBeLessThanOrEqual(800);
    });
  });

  it("adds Codex-specific operating guidance only for codex format", async () => {
    await withTempDir(async (dir) => {
      await seedPrimeWorkspace(dir);
      await setDefaultWorker({ cwd: dir, worker: "quant-reviewer" });

      const codex = await primeContext({
        cwd: dir,
        task: "Continue unresolved checks.",
        maxTokens: 800,
        format: "codex"
      });
      const markdown = await primeContext({
        cwd: dir,
        task: "Continue unresolved checks.",
        maxTokens: 800,
        format: "markdown"
      });

      expect(codex.content).toContain("## Codex Operating Note");
      expect(markdown.content).not.toContain("## Codex Operating Note");
      expect(codex.tokens).toBeLessThanOrEqual(800);
      expect(markdown.tokens).toBeLessThanOrEqual(800);
    });
  });

  it("hides private continuity counts in shared-only mode while keeping local-private counts", async () => {
    await withTempDir(async (dir) => {
      await seedPrimeWorkspace(dir);
      await setDefaultWorker({ cwd: dir, worker: "quant-reviewer" });
      await addMemory({
        cwd: dir,
        type: "facts",
        project: "atlas-q",
        skill: "risk-review",
        content: "Private fact count sentinel.",
        visibility: "private",
        exportable: false
      });
      await addMemory({
        cwd: dir,
        type: "decisions",
        project: "atlas-q",
        skill: "risk-review",
        content: "Private decision count sentinel.",
        visibility: "private",
        exportable: false
      });
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Shared exportable count sentinel.",
        visibility: "shared",
        exportable: true
      });
      for (let index = 0; index < 2; index += 1) {
        await addWorkLog({
          cwd: dir,
          project: "atlas-q",
          skill: "risk-review",
          worker: "quant-reviewer",
          task: `Review private count leak ${index}`,
          result: `Private local work log result ${index}.`,
          openRisks: [`Private open risk ${index}.`],
          nextSteps: [`Private next step ${index}.`]
        });
      }

      const shared = await primeContext({
        cwd: dir,
        task: "Continue shared exportable count sentinel review.",
        maxTokens: 1200,
        format: "codex",
        exportPolicy: "shared-only"
      });
      const local = await primeContext({
        cwd: dir,
        task: "Continue shared exportable count sentinel review.",
        maxTokens: 1200,
        format: "codex",
        exportPolicy: "local-private"
      });

      expect(shared.content).toContain("Shared-only export policy is active.");
      expect(shared.content).toContain("Work logs: omitted by shared-only policy");
      expect(shared.content).toContain("Active memory: shared/exportable selected only");
      expect(shared.content).toContain("Shared/exportable memory selected: 1");
      expect(shared.content).toContain("Shared exportable count sentinel.");
      expect(shared.content).not.toContain("Work logs: 1");
      expect(shared.content).not.toContain("Work logs: 2");
      expect(shared.content).not.toContain("facts=");
      expect(shared.content).not.toContain("decisions=");
      expect(shared.content).not.toContain("lessons=");
      expect(shared.content).not.toContain("incidents=");
      expect(shared.content).not.toContain("Private fact count sentinel.");
      expect(shared.content).not.toContain("Private decision count sentinel.");
      expect(shared.content).not.toContain("Private local work log result");
      expect(shared.content).not.toContain("Private open risk");
      expect(shared.content).not.toContain("Private next step");

      expect(local.content).toMatch(/Work logs: \d+/);
      expect(local.content).toContain("facts=");
      expect(local.content).toContain("decisions=");
      expect(local.content).toContain("lessons=");
      expect(local.content).toContain("Private open risk");
      expect(local.content).toContain("Private next step");
    });
  });

  it("asks for a default worker when more than one worker exists and none is selected", async () => {
    await withTempDir(async (dir) => {
      await seedPrimeWorkspace(dir);
      await createWorker({
        cwd: dir,
        name: "docs-reviewer",
        project: "atlas-q",
        skills: ["risk-review"]
      });

      const result = await primeContext({
        cwd: dir,
        task: "Continue work.",
        maxTokens: 500
      });

      expect(result.status).toBe("attention-required");
      expect(result.content).toContain("briefops worker use <worker>");
      expect(result.tokens).toBeLessThanOrEqual(500);
    });
  });

  it("uses substantially fewer tokens than a manual history dump", async () => {
    await withTempDir(async (dir) => {
      await seedPrimeWorkspace(dir);
      await setDefaultWorker({ cwd: dir, worker: "quant-reviewer" });
      for (let index = 0; index < 8; index += 1) {
        await addMemory({
          cwd: dir,
          type: "lessons",
          project: "atlas-q",
          skill: "risk-review",
          content: `Lesson ${index}: verify rebalance turnover warnings, slippage policy, governance evidence, release risk, and unresolved assumptions before any merge recommendation.`
        });
        await addWorkLog({
          cwd: dir,
          project: "atlas-q",
          skill: "risk-review",
          worker: "quant-reviewer",
          task: `Review rebalance logic ${index}`,
          result: "Found missing turnover warning check and unverified slippage assumptions.",
          openRisks: ["Slippage assumptions remain unverified against policy."],
          nextSteps: ["Verify slippage assumptions before recommendation."]
        });
      }

      const manualDump = [
        "# Manual Context Dump",
        "",
        "Project README, all worker memory files, recent logs, handoff notes, and unresolved risks:",
        "",
        ...Array.from({ length: 40 }, (_, index) =>
          `- Entry ${index}: review rebalance turnover warnings, slippage assumptions, governance policy, release risk, prior reviewer lessons, current project facts, unresolved next steps, and evidence gates before continuing.`
        )
      ].join("\n");
      const prime = await primeContext({
        cwd: dir,
        task: "Continue unresolved slippage checks.",
        maxTokens: 800,
        format: "codex"
      });

      expect(prime.tokens).toBeLessThanOrEqual(800);
      expect(prime.tokens).toBeLessThan(estimateTokens(manualDump) * 0.35);
    });
  });
});
