import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCodexPluginManifest,
  codexPluginFiles,
  inspectCodexPlugin,
  installCodexPlugin
} from "../src/core/codexPlugin.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

describe("Codex plugin package", () => {
  it("builds a local-first skill-only plugin manifest", () => {
    const manifest = buildCodexPluginManifest();

    expect(manifest.name).toBe("briefops");
    expect(manifest.skills).toBe("./skills/");
    expect(manifest.interface.displayName).toBe("BriefOps");
    expect(manifest.interface.category).toBe("Developer Tools");
    expect(manifest.interface.capabilities).toEqual(["Read", "Write"]);
    expect(manifest.interface.shortDescription).toContain("local-first");
  });

  it("ships every Codex skill used by the manifest", () => {
    const files = codexPluginFiles();
    const skillFiles = files
      .map((file) => file.relativePath)
      .filter((file) => file.endsWith("SKILL.md"));

    expect(skillFiles).toEqual([
      "skills/briefops-prime-context/SKILL.md",
      "skills/briefops-finish-task/SKILL.md",
      "skills/briefops-review-memory/SKILL.md",
      "skills/briefops-continue-worker/SKILL.md"
    ]);

    for (const file of files) {
      expect(file.content.trim().length).toBeGreaterThan(40);
    }
    expect(
      files.find((file) => file.relativePath === "skills/briefops-prime-context/SKILL.md")
        ?.content
    ).toContain("briefops bootstrap");
  });

  it("keeps committed plugin files in sync with generated content", async () => {
    const root = path.join(process.cwd(), "plugins/briefops-codex");

    for (const file of codexPluginFiles()) {
      const disk = await fs.readFile(path.join(root, file.relativePath), "utf8");
      expect(disk).toBe(file.content);
    }
  });

  it("installs a local Codex plugin bundle under .briefops", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      const result = await installCodexPlugin({ cwd: dir });

      expect(result.root).toContain(".briefops/codex/plugin/briefops");
      expect(result.files).toContain(".codex-plugin/plugin.json");
      expect(result.files).toContain("skills/briefops-prime-context/SKILL.md");
      await expect(
        fs.stat(path.join(result.root, ".codex-plugin/plugin.json"))
      ).resolves.toBeTruthy();
    });
  });

  it("reports local Codex plugin install drift", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      const installed = await installCodexPlugin({ cwd: dir });
      await fs.writeFile(
        path.join(installed.root, "skills/briefops-prime-context/SKILL.md"),
        "changed\n",
        "utf8"
      );

      const inspection = await inspectCodexPlugin({ cwd: dir });
      expect(inspection.ok).toBe(false);
      expect(
        inspection.files.find(
          (file) => file.relativePath === "skills/briefops-prime-context/SKILL.md"
        )?.status
      ).toBe("changed");
    });
  });

  it("does not overwrite changed local plugin files without force", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await installCodexPlugin({ cwd: dir });
      const skillPath = path.join(
        dir,
        ".briefops/codex/plugin/briefops/skills/briefops-prime-context/SKILL.md"
      );
      await fs.writeFile(skillPath, "custom local edit\n", "utf8");

      await expect(installCodexPlugin({ cwd: dir })).rejects.toThrow(
        "Generated plugin file has local changes"
      );

      expect(await fs.readFile(skillPath, "utf8")).toBe("custom local edit\n");
    });
  });

  it("overwrites changed local plugin files with force", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await installCodexPlugin({ cwd: dir });
      const skillPath = path.join(
        dir,
        ".briefops/codex/plugin/briefops/skills/briefops-prime-context/SKILL.md"
      );
      await fs.writeFile(skillPath, "custom local edit\n", "utf8");

      await installCodexPlugin({ cwd: dir, force: true });

      expect(await fs.readFile(skillPath, "utf8")).toContain("BriefOps Prime Context");
    });
  });
});
