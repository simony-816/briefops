import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  generateCodexMission,
  generateCodexPlan,
  installCodexPack
} from "../src/core/codex.js";
import { createProject } from "../src/core/project.js";
import { createSkill } from "../src/core/skill.js";
import { createWorker } from "../src/core/worker.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

describe("codex prompt pack", () => {
  it("installs AGENTS.md guidance and prompt pack files", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);

      const result = await installCodexPack({ cwd: dir });
      const agents = await fs.readFile(path.join(dir, "AGENTS.md"), "utf8");

      expect(result.promptDir).toContain(".briefops/codex/prompts");
      expect(agents).toContain("BriefOps Codex Guidance");
      expect(agents).toContain("briefops prime --format codex");
      expect(agents).toContain("briefops bootstrap");
      expect(agents).toContain("briefops codex mission");
      await expect(fs.stat(path.join(result.promptDir, "prime.md"))).resolves.toBeTruthy();
    });
  });

  it("generates a Codex mission with evidence gates", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await createSkill({ cwd: dir, name: "risk-review", description: "Review risk." });
      await createProject({ cwd: dir, name: "atlas-q", description: "Backtest first." });
      await createWorker({
        cwd: dir,
        name: "quant-reviewer",
        project: "atlas-q",
        skills: ["risk-review"],
        style: ["governance-first"]
      });

      const result = await generateCodexMission({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Review this PR.",
        save: true
      });

      expect(result.content).toContain("# BriefOps Codex Mission");
      expect(result.content).toContain("## Evidence Gates");
      expect(result.content).toContain("<briefops-complete>DONE</briefops-complete>");
      expect(result.content).toContain("## BriefOps Brief");
      expect(result.savedPath).toContain(".briefops/codex/prompts");
    });
  });

  it("generates a planning-only prompt", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await createProject({ cwd: dir, name: "briefops", description: "Codex-first CLI." });

      const result = await generateCodexPlan({
        cwd: dir,
        project: "briefops",
        idea: "Add Codex prompt harness."
      });

      expect(result.content).toContain("You are planning only.");
      expect(result.content).toContain("PLAN READY");
      expect(result.content).toContain("Codex-first CLI");
    });
  });
});
