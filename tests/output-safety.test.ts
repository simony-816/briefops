import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateCodexResume } from "../src/core/codex.js";
import { generateHandoff } from "../src/core/handoff.js";
import { createProject } from "../src/core/project.js";
import { createSkill } from "../src/core/skill.js";
import { readTextFile, writeTextFile } from "../src/core/storage.js";
import { createWorker } from "../src/core/worker.js";
import { packResume } from "../src/core/workflow.js";
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

describe("explicit output safety", () => {
  it("does not overwrite explicit Codex resume output without force", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      const outputPath = path.join(dir, "resume.md");
      await writeTextFile(outputPath, "keep me\n");

      await expect(generateCodexResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        save: true,
        outputPath
      })).rejects.toThrow("Output file already exists");

      expect(await readTextFile(outputPath)).toBe("keep me\n");
    });
  });

  it("overwrites explicit Codex resume output when force is true", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      const outputPath = path.join(dir, "resume.md");
      await writeTextFile(outputPath, "replace me\n");

      await generateCodexResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        save: true,
        outputPath,
        force: true
      });

      expect(await readTextFile(outputPath)).toContain("BriefOps Codex Resume");
    });
  });

  it("does not overwrite explicit handoff output without force", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      const outputPath = path.join(dir, "handoff.md");
      await writeTextFile(outputPath, "keep me\n");

      await expect(generateHandoff({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        save: true,
        outputPath
      })).rejects.toThrow("Output file already exists");

      expect(await readTextFile(outputPath)).toBe("keep me\n");
    });
  });

  it("does not overwrite explicit pack output without force", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      const outputPath = path.join(dir, "pack.md");
      await writeTextFile(outputPath, "keep me\n");

      await expect(packResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        outputPath
      })).rejects.toThrow("Output file already exists");

      expect(await readTextFile(outputPath)).toBe("keep me\n");
    });
  });
});
