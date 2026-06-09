import { describe, expect, it } from "vitest";
import { addMemory } from "../src/core/memory.js";
import { fixBriefOpsGitignore, runPrivacyDoctor } from "../src/core/privacyDoctor.js";
import { createProject } from "../src/core/project.js";
import { createSkill } from "../src/core/skill.js";
import { readTextFile, writeTextFile } from "../src/core/storage.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

async function seed(dir: string): Promise<void> {
  await initWorkspace(dir);
  await createSkill({ cwd: dir, name: "risk-review" });
  await createProject({ cwd: dir, name: "atlas-q" });
}

describe("privacy doctor", () => {
  it("warns when .briefops is not ignored", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);

      const result = await runPrivacyDoctor({ cwd: dir });

      expect(result.ok).toBe(true);
      expect(result.checks.find((check) => check.name === "Gitignore")?.status).toBe("warn");
    });
  });

  it("passes gitignore check when .briefops is ignored", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      await writeTextFile(`${dir}/.gitignore`, ".briefops/\n");

      const result = await runPrivacyDoctor({ cwd: dir });

      expect(result.checks.find((check) => check.name === "Gitignore")?.status).toBe("ok");
    });
  });

  it("fix-gitignore adds .briefops without replacing existing entries", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      await writeTextFile(`${dir}/.gitignore`, "node_modules/\n");

      await fixBriefOpsGitignore(dir);

      const gitignore = await readTextFile(`${dir}/.gitignore`);
      expect(gitignore).toContain("node_modules/");
      expect(gitignore).toContain(".briefops/");
      expect((await runPrivacyDoctor({ cwd: dir })).checks.find((check) => check.name === "Gitignore")?.status)
        .toBe("ok");
    });
  });

  it("warns on private memory marked exportable", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      await writeTextFile(`${dir}/.gitignore`, ".briefops/\n");
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Private lesson should not be exportable.",
        visibility: "private",
        exportable: true
      });

      const result = await runPrivacyDoctor({ cwd: dir });

      expect(result.checks.find((check) => check.name === "Private exportable memory")?.status)
        .toBe("warn");
    });
  });

  it("warns on secret-like strings in local memory", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      await writeTextFile(`${dir}/.gitignore`, ".briefops/\n");
      await addMemory({
        cwd: dir,
        type: "facts",
        project: "atlas-q",
        skill: "risk-review",
        content: "Use API key sk-test-12345678901234567890 for local sandbox.",
        visibility: "private",
        exportable: false
      });

      const result = await runPrivacyDoctor({ cwd: dir });

      expect(result.checks.find((check) => check.name === "Secret-like local memory")?.status)
        .toBe("warn");
    });
  });
});
