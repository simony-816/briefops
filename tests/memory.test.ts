import { describe, expect, it } from "vitest";
import { addMemory, listMemory, selectRelevantMemory } from "../src/core/memory.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

describe("memory", () => {
  it("adds, filters, and selects active relevant memory", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Check turnover thresholds.",
        tags: ["risk"]
      });
      await addMemory({
        cwd: dir,
        type: "facts",
        project: "atlas-q",
        content: "Backtest first."
      });
      await addMemory({
        cwd: dir,
        type: "decisions",
        skill: "risk-review",
        content: "Use blocking findings first."
      });
      await addMemory({
        cwd: dir,
        type: "incidents",
        project: "atlas-q",
        skill: "risk-review",
        content: "Old incident.",
        status: "archived"
      });

      const lessons = await listMemory({ cwd: dir, type: "lessons" });
      const selected = await selectRelevantMemory({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        maxTokens: 500
      });

      expect(lessons).toHaveLength(1);
      expect(selected.items).toHaveLength(3);
      expect(selected.text).toContain("Check turnover thresholds");
      expect(selected.text).not.toContain("Old incident");
    });
  });
});
