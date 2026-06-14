import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { budgetStatus, formatBudgetLine } from "../src/core/contextBudget.js";
import { compareContext } from "../src/core/contextCompare.js";
import { addWorkLog } from "../src/core/log.js";
import { addMemory } from "../src/core/memory.js";
import { inspectMemoryHygiene, planMemoryPrune } from "../src/core/memoryHygiene.js";
import { createProject } from "../src/core/project.js";
import { createSkill } from "../src/core/skill.js";
import { readTextFile } from "../src/core/storage.js";
import { createWorker, refreshWorkerSummary } from "../src/core/worker.js";
import { finishWork } from "../src/core/workflow.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

async function seedWorkspace(dir: string): Promise<void> {
  await initWorkspace(dir);
  await createSkill({
    cwd: dir,
    name: "risk-review",
    description: "Review changes for risk and governance violations.",
    maxTokens: 120
  });
  await createProject({
    cwd: dir,
    name: "atlas-q",
    description: "Rule-based quantitative trading system.",
    maxTokens: 120
  });
  await createWorker({
    cwd: dir,
    name: "quant-reviewer",
    description: "Risk-focused quantitative strategy reviewer.",
    project: "atlas-q",
    skills: ["risk-review"]
  });
}

describe("context minimalism", () => {
  it("classifies context budgets and prints budget lines", () => {
    expect(budgetStatus(500, 500)).toBe("ok");
    expect(budgetStatus(700, 500)).toBe("warn");
    expect(budgetStatus(900, 500)).toBe("over");
    expect(formatBudgetLine("AGENTS.md", 520, 500)).toBe("AGENTS.md: 520 / 500 tokens (warn)");
  });

  it("compares raw candidate context to compiled prime context", async () => {
    await withTempDir(async (dir) => {
      await seedWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Always verify turnover warning threshold when rebalance logic changes."
      });
      await addMemory({
        cwd: dir,
        type: "decisions",
        project: "atlas-q",
        skill: "risk-review",
        content: "Treat unverified slippage assumptions as blocking before merge recommendation."
      });
      await addMemory({
        cwd: dir,
        type: "facts",
        project: "atlas-q",
        skill: "risk-review",
        content: Array.from({ length: 90 }, (_, index) =>
          `Risk policy clause ${index} requires documented turnover, slippage, exposure, liquidity, and reviewer evidence before approval.`
        ).join(" ")
      });
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review rebalance logic for risk policy violations.",
        result: "Found missing turnover warning check and unverified slippage assumptions.",
        lessons: ["Always verify turnover warning threshold when rebalance logic changes."],
        decisions: ["Treat unverified slippage assumptions as blocking before merge recommendation."],
        openRisks: ["Slippage assumptions were not verified against the project risk policy."],
        nextSteps: ["Inspect risk policy and add slippage verification to the review checklist."]
      });
      await refreshWorkerSummary({ cwd: dir, name: "quant-reviewer" });

      const comparison = await compareContext({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Review this PR for risk policy violations.",
        exportPolicy: "local-private"
      });

      expect(comparison.raw.totalTokens).toBeGreaterThan(comparison.prime.tokens);
      expect(comparison.savedTokens).toBeGreaterThan(0);

      const sharedOnly = await compareContext({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Review this PR for risk policy violations.",
        exportPolicy: "shared-only"
      });
      expect(sharedOnly.warnings.join("\n")).toContain("Raw candidate context is a local-only estimate");
    });
  });

  it("reports missing workspace for context comparison", async () => {
    await withTempDir(async (dir) => {
      await expect(compareContext({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Review this PR."
      })).rejects.toThrow("briefops");
    });
  });

  it("keeps trivial and no-proposal finish entries out of memory proposals", async () => {
    await withTempDir(async (dir) => {
      await seedWorkspace(dir);

      const trivial = await finishWork({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Fix typo",
        result: "Fixed typo.",
        lessons: ["Tiny typo fixes are not durable lessons."],
        importance: "trivial"
      });
      expect(trivial.memoryProposalId).toBeUndefined();
      expect(trivial.warnings).toContain("Trivial work is not proposed as durable memory.");

      const skipped = await finishWork({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Experiment with review approach",
        result: "Discarded.",
        lessons: ["Prefer narrow review slices."],
        noMemoryProposal: true
      });
      expect(skipped.memoryProposalId).toBeUndefined();
      expect(skipped.warnings).toContain("Memory proposal skipped by --no-memory-proposal.");

      const durable = await finishWork({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review risk policy",
        result: "Found unresolved risk.",
        lessons: ["Check unresolved risk before finishing."],
        importance: "durable"
      });
      expect(durable.memoryProposalId).toBeTruthy();
      expect(durable.memoryProposalStatus).toBe("applied");

      const proposalFiles = await fs.readdir(path.join(dir, ".briefops/memory-proposals"));
      expect(proposalFiles.filter((file) => file.endsWith(".memory-proposal.yaml"))).toHaveLength(1);
    });
  });

  it("keeps durable memory pending only when memory review is requested", async () => {
    await withTempDir(async (dir) => {
      await seedWorkspace(dir);

      const reviewed = await finishWork({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review risk policy",
        result: "Found unresolved risk.",
        lessons: ["Review-mode lessons stay pending until applied locally."],
        memoryReview: true
      });

      expect(reviewed.memoryProposalId).toBeTruthy();
      expect(reviewed.memoryProposalStatus).toBe("proposed");
      expect(reviewed.warnings).toContain("Memory left as a review proposal by --memory-review.");
      expect(await fs.readFile(path.join(dir, ".briefops/memory/lessons.yaml"), "utf8"))
        .not.toContain("Review-mode lessons stay pending");
    });
  });

  it("reports memory hygiene and previews prune actions without writing", async () => {
    await withTempDir(async (dir) => {
      await seedWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Always verify turnover warning threshold."
      });
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Always verify turnover warning threshold."
      });
      await addMemory({
        cwd: dir,
        type: "decisions",
        project: "atlas-q",
        skill: "risk-review",
        status: "stale",
        content: "Old decision that should be archived later."
      });
      await addMemory({
        cwd: dir,
        type: "incidents",
        project: "atlas-q",
        skill: "risk-review",
        status: "deprecated",
        content: "Old incident that should not stay active."
      });
      const before = await readTextFile(path.join(dir, ".briefops/memory/lessons.yaml"));

      const report = await inspectMemoryHygiene({ cwd: dir });
      expect(report.counts.lessons).toBe(2);
      expect(report.warnings).toContain("duplicate-like memories detected.");
      expect(report.warnings).toContain("stale memory exists.");
      expect(report.warnings).toContain("deprecated memory exists.");

      const plan = await planMemoryPrune({ cwd: dir });
      expect(plan.archive.map((item) => item.reason)).toContain("duplicate-like memory");
      expect(plan.archive.map((item) => item.reason)).toContain("stale memory");
      expect(plan.archive.map((item) => item.reason)).toContain("deprecated memory");
      expect(await readTextFile(path.join(dir, ".briefops/memory/lessons.yaml"))).toBe(before);
    });
  });

  it("warns when active memory exceeds hygiene thresholds", async () => {
    await withTempDir(async (dir) => {
      await seedWorkspace(dir);
      for (let index = 0; index < 41; index += 1) {
        await addMemory({
          cwd: dir,
          type: "lessons",
          project: "atlas-q",
          skill: "risk-review",
          content: `Durable lesson number ${index}`
        });
      }

      const report = await inspectMemoryHygiene({ cwd: dir });
      expect(report.warnings).toContain("lessons active memory count is high.");
    });
  });
});
