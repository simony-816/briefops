import { describe, expect, it } from "vitest";
import {
  readBriefOpsConfig,
  setDefaultWorker
} from "../src/core/config.js";
import { createProject } from "../src/core/project.js";
import { createSkill } from "../src/core/skill.js";
import { readTextFile, writeYamlFile } from "../src/core/storage.js";
import { createWorker } from "../src/core/worker.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

async function seedConfigWorkspace(dir: string): Promise<void> {
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
}

describe("BriefOps config", () => {
  it("reads old workspace config with runtime defaults", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      const config = await readBriefOpsConfig(dir);

      expect(config.defaults).toEqual({});
      expect(config.version).toBe("1.0.0");
      expect(config.token_budgets.prime).toBe(800);
      expect(config.token_budgets.resume).toBe(3000);
      expect(config.memory_categories).toContain("lessons");
    });
  });

  it("stores a default worker for thread starts", async () => {
    await withTempDir(async (dir) => {
      await seedConfigWorkspace(dir);
      const updated = await setDefaultWorker({ cwd: dir, worker: "quant-reviewer" });

      expect(updated.defaults.worker).toBe("quant-reviewer");
      expect(updated.defaults.project).toBe("atlas-q");
      const config = await readBriefOpsConfig(dir);
      expect(config.defaults.worker).toBe("quant-reviewer");
      expect(config.defaults.project).toBe("atlas-q");
      expect(await readTextFile(`${dir}/.briefops/config.yaml`)).toContain("defaults:");
    });
  });

  it("rejects missing default workers", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await expect(setDefaultWorker({ cwd: dir, worker: "missing-worker" })).rejects.toThrow(
        "Worker not found"
      );
    });
  });

  it("normalizes legacy config when writing a default worker", async () => {
    await withTempDir(async (dir) => {
      await seedConfigWorkspace(dir);
      await writeYamlFile(`${dir}/.briefops/config.yaml`, {
        version: "0.1.0",
        created_at: "2026-06-08T00:00:00.000Z",
        memory_categories: ["facts", "decisions", "lessons", "incidents", "deprecated"]
      });

      await setDefaultWorker({ cwd: dir, worker: "quant-reviewer" });
      const config = await readBriefOpsConfig(dir);

      expect(config.version).toBe("1.0.0");
      expect(config.defaults.worker).toBe("quant-reviewer");
      expect(config.token_budgets.prime).toBe(800);
    });
  });

  it("rejects future incompatible workspace config versions", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await writeYamlFile(`${dir}/.briefops/config.yaml`, {
        version: "2.0.0",
        defaults: {},
        token_budgets: {
          prime: 800,
          resume: 3000
        },
        memory_categories: ["facts", "decisions", "lessons", "incidents", "deprecated"]
      });

      await expect(readBriefOpsConfig(dir)).rejects.toThrow(
        "Unsupported BriefOps workspace version"
      );
    });
  });
});
