import path from "node:path";
import { describe, expect, it } from "vitest";
import { primeContext } from "../src/core/prime.js";
import { createProject } from "../src/core/project.js";
import { createSkill } from "../src/core/skill.js";
import { runStabilityDoctor } from "../src/core/stabilityDoctor.js";
import { writeYamlFile } from "../src/core/storage.js";
import { createWorker } from "../src/core/worker.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

async function seed(dir: string): Promise<void> {
  await initWorkspace(dir);
  await createSkill({ cwd: dir, name: "risk-review" });
  await createProject({ cwd: dir, name: "atlas-q" });
  await createWorker({
    cwd: dir,
    name: "quant-reviewer",
    project: "atlas-q",
    skills: ["risk-review"]
  });
}

function memoryItem(id: string, content: string) {
  return {
    id,
    type: "lesson",
    status: "active",
    project: "atlas-q",
    skill: "risk-review",
    content,
    source: "test",
    created_at: "2026-06-10T00:00:00.000Z",
    tags: [],
    visibility: "private",
    exportable: false
  };
}

describe("stability doctor", () => {
  it("passes a healthy initialized workspace", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);

      const result = await runStabilityDoctor({ cwd: dir });

      expect(result.ok).toBe(true);
      expect(result.checks.find((check) => check.name === "Required paths")?.status).toBe("ok");
      expect(result.checks.find((check) => check.name === "Memory ids")?.status).toBe("ok");
      expect(result.checks.find((check) => check.name === "References")?.status).toBe("ok");
    });
  });

  it("fails on broken worker references", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      await createWorker({
        cwd: dir,
        name: "broken-reviewer",
        project: "missing-project",
        skills: ["missing-skill"]
      });

      const result = await runStabilityDoctor({ cwd: dir });
      const references = result.checks.find((check) => check.name === "References");

      expect(result.ok).toBe(false);
      expect(references?.status).toBe("fail");
      expect(references?.detail).toContain("worker broken-reviewer -> project missing-project");
      expect(references?.detail).toContain("worker broken-reviewer -> skill missing-skill");
    });
  });

  it("bounds duplicate memory id output", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      const items = Array.from({ length: 8 }, (_, index) => [
        memoryItem(`dup-${index}`, `Duplicate lesson ${index}a`),
        memoryItem(`dup-${index}`, `Duplicate lesson ${index}b`)
      ]).flat();
      await writeYamlFile(path.join(dir, ".briefops", "memory", "lessons.yaml"), { items });

      const result = await runStabilityDoctor({ cwd: dir, maxExamples: 5 });
      const memoryIds = result.checks.find((check) => check.name === "Memory ids");

      expect(result.ok).toBe(false);
      expect(memoryIds?.status).toBe("fail");
      expect(memoryIds?.detail).toContain("8:");
      expect(memoryIds?.detail).toContain("dup-0");
      expect(memoryIds?.detail).toContain("3 more");
      expect(memoryIds?.detail).not.toContain("dup-7");
    });
  });

  it("does not inject stability diagnostics into prime context", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      const items = Array.from({ length: 8 }, (_, index) => [
        memoryItem(`dup-${index}`, `Duplicate lesson ${index}a`),
        memoryItem(`dup-${index}`, `Duplicate lesson ${index}b`)
      ]).flat();
      await writeYamlFile(path.join(dir, ".briefops", "memory", "lessons.yaml"), { items });

      const stability = await runStabilityDoctor({ cwd: dir });
      const prime = await primeContext({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        maxTokens: 800
      });

      expect(stability.ok).toBe(false);
      expect(prime.tokens).toBeLessThanOrEqual(800);
      expect(prime.content).not.toContain("Memory ids");
      expect(prime.content).not.toContain("duplicate memory");
      expect(prime.content).not.toContain("doctor --stability");
    });
  });
});
