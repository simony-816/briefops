import { describe, expect, it } from "vitest";
import { generateBrief, inspectBriefTokens } from "../src/core/brief.js";
import { addMemory } from "../src/core/memory.js";
import { createProject } from "../src/core/project.js";
import { createSkill } from "../src/core/skill.js";
import { estimateTokens } from "../src/core/tokens.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

describe("brief generation", () => {
  it("generates a compact task brief with a token budget report", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await createSkill({
        cwd: dir,
        name: "risk-review",
        description: "Review changes for risk and governance violations.",
        maxTokens: 80
      });
      await createProject({
        cwd: dir,
        name: "atlas-q",
        description: "Rule-based non-ML quantitative trading system.",
        maxTokens: 60
      });
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Always verify turnover warning threshold when rebalance logic changes."
      });

      const generated = await generateBrief({
        cwd: dir,
        skill: "risk-review",
        project: "atlas-q",
        task: "Review recent rebalance logic changes.",
        budget: 300
      });

      expect(generated.content).toContain("# BriefOps Task Brief");
      expect(generated.content).toContain("## Token Budget Report");
      expect(generated.content).toContain("Always verify turnover");
      expect(generated.totalTokens).toBeLessThanOrEqual(300);
    });
  });

  it("trims memory before project context when the budget is tight", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await createSkill({ cwd: dir, name: "risk-review", maxTokens: 40 });
      await createProject({ cwd: dir, name: "atlas-q", maxTokens: 30 });

      for (let index = 0; index < 5; index += 1) {
        await addMemory({
          cwd: dir,
          type: "lessons",
          project: "atlas-q",
          skill: "risk-review",
          content: `Long memory ${index} ${"important context ".repeat(20)}`
        });
      }

      const generated = await generateBrief({
        cwd: dir,
        skill: "risk-review",
        project: "atlas-q",
        task: "Review this change.",
        budget: 120
      });

      expect(generated.totalTokens).toBe(estimateTokens(generated.content));
      expect(generated.warnings.some((warning) => warning.includes("memory item"))).toBe(true);
      expect(generated.warnings.some((warning) => warning.includes("Rendered brief exceeds"))).toBe(true);
    });
  });

  it("reports totalTokens from the final rendered brief content", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await createSkill({ cwd: dir, name: "risk-review", maxTokens: 100 });
      await createProject({ cwd: dir, name: "atlas-q", maxTokens: 80 });

      const generated = await generateBrief({
        cwd: dir,
        skill: "risk-review",
        project: "atlas-q",
        task: "Review this change.",
        budget: 500,
        adapter: "codex"
      });

      expect(generated.totalTokens).toBe(estimateTokens(generated.content));
      expect(generated.content).toContain(`- Total: ${generated.totalTokens} / 500`);
    });
  });

  it("inspects tokens through the same rendered path as brief generation", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await createSkill({ cwd: dir, name: "risk-review", maxTokens: 100 });
      await createProject({ cwd: dir, name: "atlas-q", maxTokens: 80 });

      const input = {
        cwd: dir,
        skill: "risk-review",
        project: "atlas-q",
        task: "Review this change.",
        budget: 500,
        adapter: "codex"
      };
      const generated = await generateBrief(input);
      const inspected = await inspectBriefTokens(input);

      expect(inspected.renderedTokens).toBe(generated.totalTokens);
      expect(inspected.totalTokens).toBe(generated.totalTokens);
    });
  });
});
