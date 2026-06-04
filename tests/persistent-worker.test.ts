import { describe, expect, it } from "vitest";
import { generateCodexResume } from "../src/core/codex.js";
import { generateHandoff } from "../src/core/handoff.js";
import { addWorkLog } from "../src/core/log.js";
import { addMemory, listMemory, selectRelevantMemory } from "../src/core/memory.js";
import {
  applyMemoryProposal,
  proposeMemoryFromLog,
  readMemoryProposal,
  rejectMemoryProposal
} from "../src/core/memoryProposal.js";
import { createProject } from "../src/core/project.js";
import { createSkill } from "../src/core/skill.js";
import { createWorker, readWorkerSummary, refreshWorkerSummary } from "../src/core/worker.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

async function seedContinuityWorkspace(dir: string): Promise<void> {
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
    skills: ["risk-review"],
    style: ["skeptical", "verify before completion"]
  });
}

describe("persistent worker continuity", () => {
  it("creates, applies, rejects, and deduplicates memory proposals from logs", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review rebalance logic",
        result: "Found missing turnover warning check.",
        lessons: ["Always verify turnover warning threshold when rebalance logic changes."],
        notes: "decision: Keep billing node-level, not action-level.\nfact: Project uses Vite + React."
      });

      const proposed = await proposeMemoryFromLog({ cwd: dir, fromLog: "latest" });
      expect(proposed.proposal.proposals.map((item) => item.type)).toEqual([
        "lesson",
        "decision",
        "fact",
        "incident"
      ]);

      const applied = await applyMemoryProposal({ cwd: dir, id: proposed.proposal.id });
      expect(applied.created).toBe(4);
      expect(applied.skipped).toBe(0);

      const lessons = await listMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review"
      });
      expect(lessons.map((item) => item.content)).toContain(
        "Always verify turnover warning threshold when rebalance logic changes."
      );

      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review rebalance logic again",
        result: "Found missing turnover warning check.",
        lessons: ["Always verify turnover warning threshold when rebalance logic changes."]
      });
      const duplicate = await proposeMemoryFromLog({ cwd: dir, fromLog: "latest" });
      const duplicateApply = await applyMemoryProposal({ cwd: dir, id: duplicate.proposal.id });
      expect(duplicateApply.created).toBe(0);
      expect(duplicateApply.skipped).toBe(2);

      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        task: "Record non-actionable note",
        result: "Completed review.",
        lessons: ["Check slippage assumptions."]
      });
      const rejectable = await proposeMemoryFromLog({ cwd: dir, fromLog: "latest" });
      await rejectMemoryProposal({ cwd: dir, id: rejectable.proposal.id });
      expect((await readMemoryProposal(dir, rejectable.proposal.id)).status).toBe("rejected");
    });
  });

  it("selects task-related memory ahead of unrelated newer memory", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
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
        content: "Prefer release-note checks for docs-only changes."
      });

      const selected = await selectRelevantMemory({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        task: "Review rebalance logic and turnover warnings.",
        maxTokens: 500
      });

      expect(selected.items[0].content).toContain("turnover warning");
      expect(selected.selections[0].reason).toContain("task match");
    });
  });

  it("refreshes worker summary and includes continuity sections in handoff", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "decisions",
        project: "atlas-q",
        skill: "risk-review",
        content: "Missing universe >20% must stop execution."
      });
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Always verify turnover warning threshold when rebalance logic changes."
      });
      await addMemory({
        cwd: dir,
        type: "incidents",
        project: "atlas-q",
        skill: "risk-review",
        content: "Previous review missed turnover warning check."
      });
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review rebalance logic",
        result: "Found missing turnover warning check."
      });

      const summary = await refreshWorkerSummary({
        cwd: dir,
        name: "quant-reviewer"
      });
      expect(summary.content).toContain("Accumulated Lessons");
      expect(await readWorkerSummary(dir, "quant-reviewer")).toContain("Known Failure Patterns");

      const handoff = await generateHandoff({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue reviewing rebalance policy changes.",
        budget: 3000,
        adapter: "codex",
        save: true
      });
      expect(handoff.content).toContain("## Recent Work History");
      expect(handoff.content).toContain("## Active Decisions");
      expect(handoff.content).toContain("Missing universe >20%");
      expect(handoff.content).toContain("Always verify turnover");
      expect(handoff.savedPath).toBeTruthy();
    });
  });

  it("generates a Codex resume mission with continuity and evidence gates", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Always verify turnover warning threshold when rebalance logic changes."
      });
      await refreshWorkerSummary({ cwd: dir, name: "quant-reviewer" });

      const resume = await generateCodexResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue the rebalance review and identify remaining risks.",
        budget: 3500,
        save: true
      });

      expect(resume.content).toContain("# BriefOps Codex Resume Mission");
      expect(resume.content).toContain("## Handoff Brief");
      expect(resume.content).toContain("Continuity Contract");
      expect(resume.content).toContain("Memory gate");
      expect(resume.content).toContain("<briefops-complete>DONE</briefops-complete>");
      expect(resume.savedPath).toBeTruthy();
    });
  });
});
