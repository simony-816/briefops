import { describe, expect, it } from "vitest";
import { setDefaultWorker } from "../src/core/config.js";
import { addMemory } from "../src/core/memory.js";
import { inspectContinuityObservability } from "../src/core/observability.js";
import { createProject } from "../src/core/project.js";
import { runStrictDoctor } from "../src/core/strictDoctor.js";
import { createSkill } from "../src/core/skill.js";
import { writeTextFile } from "../src/core/storage.js";
import { createWorker, refreshWorkerSummary } from "../src/core/worker.js";
import { finishWork } from "../src/core/workflow.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

async function seedReadyWorkspace(dir: string): Promise<void> {
  await initWorkspace(dir);
  await writeTextFile(`${dir}/.gitignore`, ".briefops/\n");
  await createSkill({ cwd: dir, name: "risk-review" });
  await createProject({ cwd: dir, name: "atlas-q" });
  await createWorker({
    cwd: dir,
    name: "quant-reviewer",
    project: "atlas-q",
    skills: ["risk-review"]
  });
  await setDefaultWorker({ cwd: dir, worker: "quant-reviewer" });
}

describe("strict doctor and observability", () => {
  it("aggregates strict release-readiness checks", async () => {
    await withTempDir(async (dir) => {
      await seedReadyWorkspace(dir);

      const result = await runStrictDoctor({ cwd: dir });

      expect(result.ok).toBe(true);
      expect(result.releaseReady).toBe(true);
      expect(result.summary.fail).toBe(0);
      expect(result.summary.warn).toBe(0);
      expect(result.checks.map((check) => check.source)).toContain("memory-hygiene");
    });
  });

  it("treats privacy warnings as not release-ready", async () => {
    await withTempDir(async (dir) => {
      await seedReadyWorkspace(dir);
      await writeTextFile(`${dir}/.gitignore`, "node_modules/\n", { force: true });

      const result = await runStrictDoctor({ cwd: dir });

      expect(result.ok).toBe(true);
      expect(result.releaseReady).toBe(false);
      expect(result.checks.find((check) => check.name === "Gitignore")?.status).toBe("warn");
    });
  });

  it("reports continuity context compression and hygiene counts", async () => {
    await withTempDir(async (dir) => {
      await seedReadyWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Always verify turnover warning threshold when rebalance logic changes."
      });
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Always verify turnover warning threshold when rebalance logic changes."
      });
      await finishWork({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review rebalance logic.",
        result: "Found missing turnover warning.",
        lessons: ["Always verify turnover warning threshold when rebalance logic changes."],
        files: "src/risk.ts:12-20"
      });
      await refreshWorkerSummary({ cwd: dir, name: "quant-reviewer" });

      const result = await inspectContinuityObservability({
        cwd: dir,
        task: "Continue risk review.",
        maxTokens: 800
      });

      expect(result.ok).toBe(true);
      expect(result.worker).toBe("quant-reviewer");
      expect(result.project).toBe("atlas-q");
      expect(result.context.raw.totalTokens).toBeGreaterThan(result.context.prime.tokens);
      expect(result.context.savedTokens).toBeGreaterThan(0);
      expect(result.continuity.workLogs).toBeGreaterThan(0);
      expect(result.hygiene.duplicateLike).toBeGreaterThanOrEqual(1);
    });
  });
});
