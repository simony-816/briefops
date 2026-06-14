import { describe, expect, it } from "vitest";
import { approveAny, approveMemory, approveSkillPatch } from "../src/core/approval.js";
import { inspectContinuityHealth } from "../src/core/continuity.js";
import { generateCodexResume } from "../src/core/codex.js";
import { generateHandoff } from "../src/core/handoff.js";
import { getInboxSummary } from "../src/core/inbox.js";
import { addWorkLog } from "../src/core/log.js";
import { addMemory, listMemory, selectRelevantMemory } from "../src/core/memory.js";
import {
  applyMemoryProposal,
  proposeMemoryFromLog,
  readMemoryProposal,
  rejectMemoryProposal
} from "../src/core/memoryProposal.js";
import { proposeSkillPatch, readSkillPatch } from "../src/core/patch.js";
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

  it("finishWork records a log and warns when no memory proposal candidates exist", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);

      const finished = await finishWork({
        cwd: dir,
        worker: "reviewer",
        task: "Fix typo",
        result: "Fixed typo."
      });

      expect(finished.logId).toContain("log_");
      expect(finished.logPath).toContain(".briefops/logs");
      expect(finished.memoryProposalId).toBeUndefined();
      expect(finished.memoryProposalPath).toBeUndefined();
      expect(finished.warnings).toContain("No durable memory proposal candidates found.");
      expect(finished.warnings).toContain(
        "Worker reviewer does not exist yet. Run: briefops worker create reviewer"
      );
      expect(finished.nextCommand).toBe(
        'briefops continue --worker reviewer --task "Fix typo"'
      );
    });
  });

  it("finishWork warns instead of failing when no skill patch candidates exist", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);

      const finished = await finishWork({
        cwd: dir,
        worker: "quant-reviewer",
        project: "atlas-q",
        skill: "risk-review",
        task: "Fix typo",
        result: "Fixed typo.",
        proposeSkillPatch: true
      });

      expect(finished.logId).toContain("log_");
      expect(finished.skillPatchId).toBeUndefined();
      expect(finished.warnings).toContain("No skill patch candidates found.");
    });
  });

  it("finishWork still fails propose-skill-patch for invalid skills", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);

      await expect(finishWork({
        cwd: dir,
        worker: "quant-reviewer",
        project: "atlas-q",
        skill: "missing-skill",
        task: "Fix typo",
        result: "Fixed typo.",
        proposeSkillPatch: true
      })).rejects.toThrow("Skill not found");
    });
  });

  it("continueWork can save a portable pack with the handoff and resume", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
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

      const continued = await continueWork({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue unresolved slippage checks.",
        budget: 3000,
        pack: true
      });

      expect(continued.handoffPath).toBeTruthy();
      expect(continued.resumePath).toBeTruthy();
      expect(continued.packPath).toBeTruthy();
      expect(await readTextFile(continued.packPath as string)).toContain(
        "# BriefOps Portable Resume Pack"
      );
    });
  });

  it("packResume includes self-contained header metadata", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Always verify turnover warning threshold."
      });

      const pack = await packResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue unresolved slippage checks.",
        budget: 3000
      });

      expect(pack.content).toContain("# BriefOps Portable Resume Pack");
      expect(pack.content).toContain("This pack is self-contained.");
      expect(pack.content).toContain("Worker: quant-reviewer");
      expect(pack.content).toContain("Task: Continue unresolved slippage checks.");
      expect(pack.content).toContain("Generated:");
      expect(pack.content).toContain("Estimated tokens:");
      expect(pack.content).not.toContain("Project file: .briefops/");
    });
  });

  it("stores memory visibility and export metadata from manual adds and proposals", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
      const manual = await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Shared lesson for future export.",
        visibility: "shared",
        exportable: true
      });
      expect(manual.visibility).toBe("shared");
      expect(manual.exportable).toBe(true);

      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review rebalance",
        result: "Completed review.",
        lessons: ["Private lesson from work log."]
      });
      const proposed = await proposeMemoryFromLog({ cwd: dir, fromLog: "latest" });
      expect(proposed.proposal.items[0].visibility).toBe("private");
      expect(proposed.proposal.items[0].exportable).toBe(false);

      await applyMemoryProposal({ cwd: dir, id: proposed.proposal.id });
      const applied = await listMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review"
      });
      expect(applied.find((item) => item.content === "Private lesson from work log.")?.visibility)
        .toBe("private");
      expect(applied.find((item) => item.content === "Private lesson from work log.")?.exportable)
        .toBe(false);
    });
  });

  it("approves memory proposals and skill patches through convenience helpers", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review rebalance",
        result: "Found missing turnover warning check.",
        lessons: ["Always verify turnover warning threshold."],
        nextSteps: ["Verify turnover warning threshold before merge."]
      });
      await proposeMemoryFromLog({ cwd: dir, fromLog: "latest" });

      const memory = await approveMemory({ cwd: dir, id: "latest" });
      expect(memory.kind).toBe("memory");
      expect(memory.created).toBeGreaterThan(0);

      const patch = await proposeSkillPatch({
        cwd: dir,
        skill: "risk-review",
        fromLog: "latest"
      });
      expect((await readSkillPatch(dir, patch.patch.id)).status).toBe("proposed");

      const approvedPatch = await approveSkillPatch({ cwd: dir, id: "latest" });
      expect(approvedPatch.kind).toBe("skill-patch");
      expect(approvedPatch.patch.status).toBe("applied");
      expect(approvedPatch.skillPath).toContain("risk-review.skill.md");
    });
  });

  it("approves latest proposed skill patch when newer memory proposal is already applied", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Record patch lesson",
        result: "Completed review.",
        lessons: ["Add patch lesson to skill checklist."]
      });
      const patch = await proposeSkillPatch({
        cwd: dir,
        skill: "risk-review",
        fromLog: "latest"
      });

      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Record memory lesson",
        result: "Completed review.",
        lessons: ["Memory proposal lesson."]
      });
      await proposeMemoryFromLog({ cwd: dir, fromLog: "latest" });
      await approveMemory({ cwd: dir, id: "latest" });

      await expect(approveMemory({ cwd: dir, id: "latest" })).rejects.toThrow(
        "No proposed memory proposals found"
      );

      const approved = await approveAny({ cwd: dir, id: "latest" });
      expect(approved.kind).toBe("skill-patch");
      expect(approved.kind === "skill-patch" ? approved.patch.id : "").toBe(patch.patch.id);

      await expect(approveSkillPatch({ cwd: dir, id: "latest" })).rejects.toThrow(
        "No proposed skill patches found"
      );
    });
  });

  it("summarizes the local inbox queue", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Old lesson.",
        status: "stale"
      });
      await addMemory({
        cwd: dir,
        type: "deprecated",
        project: "atlas-q",
        skill: "risk-review",
        content: "Deprecated local rule."
      });
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review rebalance",
        result: "Found missing turnover warning check.",
        lessons: ["Always verify turnover warning threshold."],
        openRisks: ["Slippage assumptions remain unverified."]
      });
      await proposeMemoryFromLog({ cwd: dir, fromLog: "latest" });
      await proposeSkillPatch({
        cwd: dir,
        skill: "risk-review",
        fromLog: "latest"
      });

      const inbox = await getInboxSummary({
        cwd: dir,
        project: "atlas-q",
        worker: "quant-reviewer",
        skill: "risk-review"
      });

      expect(inbox.pendingMemoryProposals).toBe(1);
      expect(inbox.pendingSkillPatches).toBe(1);
      expect(inbox.openRisks).toBe(1);
      expect(inbox.staleMemory).toBe(1);
      expect(inbox.deprecatedMemory).toBe(1);
      expect(inbox.recommendedCommands).toContain(
        "briefops memory proposal-list --status proposed"
      );
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

  it("runs the persistent worker UX with finish, auto-applied memory, continue, and portable pack", async () => {
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
      expect(finished.memoryProposalStatus).toBe("applied");
      expect(finished.memoryCreated).toBeGreaterThan(0);

      const continued = await continueWork({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue the previous review and finish unresolved slippage checks.",
        budget: 3000,
        mode: "loop",
        pack: true
      });
      expect(continued.resumePath).toBeTruthy();
      expect(continued.packPath).toBeTruthy();
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

  it("auto-promotes finish memory while preserving immediate handoff continuity", async () => {
    await withTempDir(async (dir) => {
      await seedContinuityWorkspace(dir);
      const finished = await finishWork({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review cache invalidation follow-up.",
        result: "Found stale cache risk in follow-up path.",
        lessons: ["Auto-promote task-specific lessons into durable local memory."],
        decisions: ["Keep local memory promotion separate from shared-only export."],
        openRisks: ["Cache invalidation behavior still needs a regression test."],
        nextSteps: ["Add regression coverage for cache invalidation."]
      });

      expect(finished.memoryProposalId).toContain("memprop_");
      expect(finished.memoryProposalStatus).toBe("applied");
      expect((await listMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review"
      })).map((item) => item.content)).toContain(
        "Auto-promote task-specific lessons into durable local memory."
      );

      const continued = await continueWork({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue cache invalidation follow-up.",
        budget: 3000,
        pack: true
      });
      expect(continued.pendingMemoryProposals).toBe(0);

      const resume = await readTextFile(continued.resumePath as string);
      expect(resume).toContain("Auto-promote task-specific lessons into durable local memory.");
      expect(resume).toContain("Keep local memory promotion separate from shared-only export.");
      expect(resume).toContain("open risk: Cache invalidation behavior still needs a regression test.");

      const sharedOnly = await generateHandoff({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue cache invalidation follow-up.",
        exportPolicy: "shared-only"
      });
      expect(sharedOnly.content).not.toContain("Auto-promote task-specific lessons");
    });
  });
});
