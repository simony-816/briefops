import { describe, expect, it } from "vitest";
import { inspectContinuityHealth } from "../src/core/continuity.js";
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
import { readTextFile } from "../src/core/storage.js";
import { continueWork, finishWork, packResume } from "../src/core/workflow.js";
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
      expect(proposed.proposal.items.map((item) => item.type)).toEqual([
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
        save: true
      });
      expect(handoff.content).toContain("# BriefOps Continuity Handoff");
      expect(handoff.content).toContain("## Recent Work");
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
      expect(resume.content).toContain("## Handoff");
      expect(resume.content).toContain("## Worker Intelligence");
      expect(resume.content).toContain("Continuity Contract");
      expect(resume.content).toContain("Risk gate");
      expect(resume.content).toContain("<briefops-complete>DONE</briefops-complete>");
      expect(resume.savedPath).toBeTruthy();
    });
  });

  it("closes the continuity loop from log to memory to handoff to resume", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review rebalance logic for risk policy violations.",
        result: "Found missing turnover warning check and unverified slippage assumptions.",
        lessons: ["Always verify turnover warning threshold when rebalance logic changes."],
        decisions: ["Treat unverified slippage assumptions as blocking before merge recommendation."],
        incidents: ["Missing turnover warning check was found during rebalance review."],
        openRisks: ["Slippage assumptions were not verified against the project risk policy."],
        nextSteps: ["Inspect risk policy and add slippage verification to the review checklist."],
        commands: "npm test,npm run build"
      });

      const proposal = await proposeMemoryFromLog({ cwd: dir, fromLog: "latest" });
      expect(proposal.proposal.items.map((item) => item.type)).toContain("lesson");
      expect(proposal.proposal.items.map((item) => item.type)).toContain("incident");
      expect(proposal.proposal.items.map((item) => item.type)).toContain("decision");
      await applyMemoryProposal({ cwd: dir, id: "latest" });
      await refreshWorkerSummary({ cwd: dir, name: "quant-reviewer" });

      const handoff = await generateHandoff({
        cwd: dir,
        project: "atlas-q",
        worker: "quant-reviewer",
        task: "Continue the previous review and finish unresolved slippage checks.",
        budget: 2500,
        save: true
      });
      expect(handoff.content).toContain("quant-reviewer");
      expect(handoff.content).toContain("Rule-based quantitative trading system");
      expect(handoff.content).toContain("Found missing turnover warning check");
      expect(handoff.content).toContain("Always verify turnover warning threshold");
      expect(handoff.content).toContain("Treat unverified slippage assumptions as blocking");
      expect(handoff.content).toContain("Slippage assumptions were not verified");
      expect(handoff.content).toContain("Suggested Next Actions");
      expect(handoff.content).toContain("Token Budget Report");

      const resume = await generateCodexResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue the previous review and finish unresolved slippage checks.",
        fromHandoff: "latest",
        budget: 2500,
        mode: "loop",
        save: true
      });
      expect(resume.content).toContain("Continue work as quant-reviewer");
      expect(resume.content).toContain("## Current Task");
      expect(resume.content).toContain("## Handoff");
      expect(resume.content).toContain("## Worker Intelligence");
      expect(resume.content).toContain("Evidence Gates");
      expect(resume.content).toContain("Token Budget Report");
      expect(resume.content).toContain("Always verify turnover warning threshold");
      expect(resume.content).toContain("Treat unverified slippage assumptions as blocking");
      expect(resume.content).toContain("Slippage assumptions were not verified");
      expect(resume.content).toContain("Continuity Contract");
      expect(resume.content).toContain("<briefops-complete>DONE</briefops-complete>");
      expect(resume.savedPath).toBeTruthy();
    });
  });

  it("skips duplicate memory when applying a proposal with existing content", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Always verify turnover warning threshold when rebalance logic changes."
      });
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review rebalance logic",
        result: "Completed review.",
        lessons: ["Always verify turnover warning threshold when rebalance logic changes."]
      });

      const proposal = await proposeMemoryFromLog({ cwd: dir, fromLog: "latest" });
      const applied = await applyMemoryProposal({ cwd: dir, id: proposal.proposal.id });

      expect(applied.created).toBe(0);
      expect(applied.skipped).toBe(1);
    });
  });

  it("reports inspect continuity PASS, WARN, and FAIL states", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
      const warn = await inspectContinuityHealth({
        cwd: dir,
        project: "atlas-q",
        worker: "quant-reviewer"
      });
      expect(warn.readiness).toBe("WARN");

      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Always verify turnover warning threshold."
      });
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review rebalance",
        result: "Found missing turnover warning check.",
        openRisks: ["Slippage assumptions remain unverified."],
        nextSteps: ["Verify slippage assumptions against policy."]
      });
      const pass = await inspectContinuityHealth({
        cwd: dir,
        project: "atlas-q",
        worker: "quant-reviewer"
      });
      expect(pass.readiness).toBe("PASS");

      const fail = await inspectContinuityHealth({
        cwd: dir,
        project: "missing-project",
        worker: "quant-reviewer"
      });
      expect(fail.readiness).toBe("FAIL");
    });
  });

  it("trims handoff and resume context before warning about token budget", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
      for (let index = 0; index < 8; index += 1) {
        await addMemory({
          cwd: dir,
          type: "lessons",
          project: "atlas-q",
          skill: "risk-review",
          content: `Lesson ${index}: verify rebalance turnover, slippage, governance policy, and release risk before any recommendation.`
        });
        await addMemory({
          cwd: dir,
          type: "decisions",
          project: "atlas-q",
          skill: "risk-review",
          content: `Decision ${index}: unverified risk policy assumptions block merge recommendations until checked.`
        });
      }
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review rebalance policy",
        result: "Found missing turnover warning check and unverified slippage assumptions.",
        openRisks: ["Slippage assumptions remain unverified against policy."],
        nextSteps: ["Verify slippage assumptions against policy."]
      });

      const handoff = await generateHandoff({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue rebalance risk review.",
        budget: 900
      });
      expect(handoff.warnings).toEqual([]);
      expect(handoff.tokens).toBeLessThanOrEqual(900);

      const resume = await generateCodexResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue rebalance risk review.",
        budget: 1400
      });
      expect(resume.content).toContain("## Completion Signal");
      expect(resume.tokens).toBeLessThanOrEqual(1400);
    });
  });

  it("runs the persistent worker UX with finish, memory approval, continue, and portable pack", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
      const finished = await finishWork({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review rebalance logic for risk policy violations.",
        result: "Found missing turnover warning check and unverified slippage assumptions.",
        lessons: ["Always verify turnover warning threshold when rebalance logic changes."],
        decisions: ["Treat unverified slippage assumptions as blocking before merge recommendation."],
        incidents: ["Missing turnover warning check was found during rebalance review."],
        openRisks: ["Slippage assumptions were not verified against the project risk policy."],
        nextSteps: ["Inspect risk policy and add slippage verification to the review checklist."],
        commands: "npm test,npm run build",
        refreshWorker: true
      });
      expect(finished.nextCommand).toContain("briefops continue");
      expect(finished.memoryProposalId).toContain("memprop_");

      await applyMemoryProposal({ cwd: dir, id: finished.memoryProposalId });
      const continued = await continueWork({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue the previous review and finish unresolved slippage checks.",
        budget: 3000,
        mode: "loop"
      });
      expect(continued.resumePath).toBeTruthy();
      const resume = await readTextFile(continued.resumePath as string);
      expect(resume).toContain("Always verify turnover warning threshold");
      expect(resume).toContain("Treat unverified slippage assumptions as blocking");
      expect(resume).toContain("Slippage assumptions were not verified");
      expect(resume).toContain("## Worker Intelligence");
      expect(resume).toContain("Continuity Contract");
      expect(resume).toContain("<briefops-complete>DONE</briefops-complete>");

      const pack = await packResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue the previous review and finish unresolved slippage checks.",
        budget: 3000
      });
      expect(pack.content).toContain("# BriefOps Portable Resume Pack");
      expect(pack.content).toContain("Always verify turnover warning threshold");
      expect(pack.content).not.toContain("Project file: .briefops/");
    });
  });
});
