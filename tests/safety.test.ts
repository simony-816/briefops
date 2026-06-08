import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { setDefaultWorker } from "../src/core/config.js";
import { withWorkspaceLock } from "../src/core/lock.js";
import { addMemory } from "../src/core/memory.js";
import { primeContext } from "../src/core/prime.js";
import { createProject } from "../src/core/project.js";
import { runSecurityDoctor } from "../src/core/securityDoctor.js";
import { createSkill } from "../src/core/skill.js";
import { ensureDirectory, readTextFile, writeTextFileAtomic, writeYamlFile } from "../src/core/storage.js";
import { createWorker } from "../src/core/worker.js";
import { packResume } from "../src/core/workflow.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

async function seedSafetyWorkspace(dir: string): Promise<void> {
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
    project: "atlas-q",
    skills: ["risk-review"]
  });
  await setDefaultWorker({ cwd: dir, worker: "quant-reviewer" });
}

describe("local safety controls", () => {
  it("prevents two writers from holding the same workspace lock", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      const first = withWorkspaceLock({ cwd: dir, name: "memory" }, async () => {
        await expect(
          withWorkspaceLock({ cwd: dir, name: "memory", timeoutMs: 50 }, async () => "second")
        ).rejects.toThrow("BriefOps workspace lock is already held");
        return "first";
      });

      await expect(first).resolves.toBe("first");
    });
  });

  it("writes text files atomically without leaving temp files", async () => {
    await withTempDir(async (dir) => {
      const target = path.join(dir, "nested", "file.txt");
      await writeTextFileAtomic(target, "hello\n");

      expect(await readTextFile(target)).toBe("hello\n");
      const entries = await fs.readdir(path.dirname(target));
      expect(entries.filter((entry) => entry.includes(".tmp-"))).toEqual([]);
    });
  });

  it("filters private memory when export policy is shared-only", async () => {
    await withTempDir(async (dir) => {
      await seedSafetyWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Private local lesson.",
        visibility: "private",
        exportable: false
      });
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Shared exportable lesson.",
        visibility: "shared",
        exportable: true
      });

      const result = await primeContext({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        exportPolicy: "shared-only"
      });

      expect(result.content).toContain("Shared exportable lesson.");
      expect(result.content).not.toContain("Private local lesson.");
    });
  });

  it("filters private memory from portable packs when export policy is shared-only", async () => {
    await withTempDir(async (dir) => {
      await seedSafetyWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Private pack lesson.",
        visibility: "private",
        exportable: false
      });
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Shared pack lesson.",
        visibility: "shared",
        exportable: true
      });

      const pack = await packResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        exportPolicy: "shared-only"
      });

      expect(pack.content).toContain("Shared pack lesson.");
      expect(pack.content).not.toContain("Private pack lesson.");
    });
  });

  it("reports a healthy security doctor result", async () => {
    await withTempDir(async (dir) => {
      await seedSafetyWorkspace(dir);
      const result = await runSecurityDoctor({ cwd: dir });

      expect(result.ok).toBe(true);
      expect(result.checks.find((check) => check.name === "Workspace")?.status).toBe("ok");
      expect(result.checks.find((check) => check.name === "Default worker")?.status).toBe("ok");
    });
  });

  it("fails security doctor for missing default worker targets and stale locks", async () => {
    await withTempDir(async (dir) => {
      await seedSafetyWorkspace(dir);
      await writeYamlFile(`${dir}/.briefops/config.yaml`, {
        version: "0.2.0",
        defaults: {
          worker: "missing-worker"
        },
        token_budgets: {
          prime: 800,
          resume: 3000
        },
        memory_categories: ["facts", "decisions", "lessons", "incidents", "deprecated"]
      });
      await ensureDirectory(`${dir}/.briefops/.locks`);
      await writeTextFileAtomic(
        `${dir}/.briefops/.locks/memory.lock`,
        "name: memory\npid: 999999\ncreated_at: 2000-01-01T00:00:00.000Z\n"
      );

      const result = await runSecurityDoctor({ cwd: dir });

      expect(result.ok).toBe(false);
      expect(result.checks.find((check) => check.name === "Default worker")?.status).toBe("fail");
      expect(result.checks.find((check) => check.name === "Stale lock files")?.status).toBe("fail");
    });
  });
});
