import { describe, expect, it } from "vitest";
import { generateBrief } from "../src/core/brief.js";
import { createEvalCase, runEval } from "../src/core/eval.js";
import { addWorkLog } from "../src/core/log.js";
import { applySkillPatch, proposeSkillPatch } from "../src/core/patch.js";
import { createProject } from "../src/core/project.js";
import { createSkill, readSkill } from "../src/core/skill.js";
import { createWorker } from "../src/core/worker.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

describe("v1 lifecycle features", () => {
  it("generates a worker-based brief from the worker skill bundle", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await createSkill({ cwd: dir, name: "risk-review", description: "Review risk." });
      await createSkill({ cwd: dir, name: "release-review", description: "Review release readiness." });
      await createProject({ cwd: dir, name: "atlas-q", description: "Backtest first." });
      await createWorker({
        cwd: dir,
        name: "quant-reviewer",
        project: "atlas-q",
        skills: ["risk-review", "release-review"],
        style: ["governance-first"]
      });

      const generated = await generateBrief({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Review this PR.",
        adapter: "codex",
        budget: 2500
      });

      expect(generated.content).toContain("## Worker Profile");
      expect(generated.content).toContain("Default skills: risk-review, release-review");
      expect(generated.content).toContain("### risk-review");
      expect(generated.content).toContain("### release-review");
      expect(generated.content).toContain("You are Codex");
    });
  });

  it("proposes and applies a skill patch from a work log lesson", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await createSkill({ cwd: dir, name: "risk-review" });
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        task: "Review rebalance logic.",
        result: "Found missing turnover warning check.",
        lessons: ["Verify turnover warning threshold when rebalance logic changes."]
      });

      const proposed = await proposeSkillPatch({
        cwd: dir,
        skill: "risk-review",
        fromLog: "latest"
      });
      expect(proposed.diff).toContain("Verify turnover warning threshold");

      await applySkillPatch({
        cwd: dir,
        skill: "risk-review",
        patch: proposed.patch.id
      });

      const skill = await readSkill(dir, "risk-review");
      expect(skill.data.version).toBe("0.1.1");
      expect(skill.body).toContain("- Verify turnover warning threshold");
      expect(skill.body).toContain("## Changelog");
    });
  });

  it("runs checklist eval cases against generated briefs", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await createSkill({
        cwd: dir,
        name: "risk-review",
        description: "Review changes for risk and governance violations."
      });
      await createProject({
        cwd: dir,
        name: "atlas-q",
        description: "Rule-based non-ML quantitative trading system."
      });
      await createEvalCase({
        cwd: dir,
        name: "risk-brief-case",
        skill: "risk-review",
        project: "atlas-q",
        input: "Review rebalance logic.",
        expected: ["risk and governance violations", "Rule-based non-ML"]
      });

      const summary = await runEval({
        cwd: dir,
        skill: "risk-review",
        project: "atlas-q",
        budget: 2000
      });

      expect(summary.cases).toHaveLength(1);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(0);
      expect(summary.cases[0].result.missing).toHaveLength(0);
    });
  });
});
