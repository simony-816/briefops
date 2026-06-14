import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bootstrapWorkspace } from "../src/core/bootstrap.js";
import { withTempDir } from "./helpers.js";

describe("bootstrap workspace", () => {
  it("runs first-adoption setup for Codex-first BriefOps projects", async () => {
    await withTempDir(async (dir) => {
      const result = await bootstrapWorkspace({
        cwd: dir
      });

      expect(result.root).toContain(".briefops");
      expect(result.agentsPath).toBe(path.join(dir, "AGENTS.md"));
      expect(result.promptDir).toContain(".briefops/codex/prompts");
      expect(result.pluginRoot).toContain(".briefops/codex/plugin/briefops");
      expect(result.gitignorePath).toBe(path.join(dir, ".gitignore"));
      expect(result.stability?.ok).toBe(true);
      expect(result.privacy?.ok).toBe(true);
      expect(result.nextCommands).toContain(
        "briefops prime --format codex --task \"<current task>\" --max-tokens 800"
      );

      const agents = await fs.readFile(path.join(dir, "AGENTS.md"), "utf8");
      const gitignore = await fs.readFile(path.join(dir, ".gitignore"), "utf8");

      expect(agents).toContain("briefops prime --format codex");
      expect(agents).toContain("briefops bootstrap");
      expect(gitignore).toContain(".briefops/");
      await expect(
        fs.stat(path.join(dir, ".briefops/codex/plugin/briefops/.codex-plugin/plugin.json"))
      ).resolves.toBeTruthy();
    });
  });
});
