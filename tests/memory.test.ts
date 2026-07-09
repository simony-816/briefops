import { describe, expect, it } from "vitest";
import { addMemory, formatMemoryItem, listMemory, selectRelevantMemory } from "../src/core/memory.js";
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

  it("prefers project+skill memory over newer lower-priority matches", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Highest priority project and skill match."
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await addMemory({
        cwd: dir,
        type: "facts",
        project: "atlas-q",
        content: "Newer project-only match."
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await addMemory({
        cwd: dir,
        type: "decisions",
        skill: "risk-review",
        content: "Newest skill-only match."
      });

      const selected = await selectRelevantMemory({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        maxTokens: 500
      });

      expect(selected.items.map((item) => item.content)).toEqual([
        "Highest priority project and skill match.",
        "Newer project-only match.",
        "Newest skill-only match."
      ]);
    });
  });

  it("stores optional evidence anchors on memory", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      const item = await addMemory({
        cwd: dir,
        type: "decisions",
        project: "atlas-q",
        skill: "risk-review",
        content: "Require slippage verification before approval.",
        evidence: ["src/risk.ts:12-20#abcdef1234567890", "docs/policy.md"]
      });

      expect(item.evidence).toEqual([
        {
          path: "src/risk.ts",
          start_line: 12,
          end_line: 20,
          sha256: "abcdef1234567890"
        },
        {
          path: "docs/policy.md"
        }
      ]);
      expect(formatMemoryItem(item)).toContain("evidence: src/risk.ts:12-20#abcdef123456,docs/policy.md");
    });
  });

  it("filters project scope, export policy, unverified, and superseded before scoring", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      const current = await addMemory({ cwd: dir, type: "decisions", project: "current", content: "Current project decision.", visibility: "shared", exportable: true });
      await addMemory({ cwd: dir, type: "decisions", project: "other", content: "Other project decision.", visibility: "shared", exportable: true });
      await addMemory({ cwd: dir, type: "decisions", content: "Global decision.", visibility: "shared", exportable: true });
      const unverified = await addMemory({ cwd: dir, type: "lessons", project: "current", content: "Unverified decision.", confidence: "unverified" });
      await addMemory({ cwd: dir, type: "decisions", project: "current", content: "Superseding decision.", supersedes: [unverified.id] });
      const selected = await selectRelevantMemory({ cwd: dir, project: "current", maxTokens: 500, exportPolicy: "shared-only" });
      expect(selected.items.map((item) => item.content)).toContain("Current project decision.");
      expect(selected.items.map((item) => item.content)).toContain("Global decision.");
      expect(selected.items.map((item) => item.content)).not.toContain("Other project decision.");
      expect(selected.items.map((item) => item.id)).toContain(current.id);
      expect(selected.items.map((item) => item.id)).not.toContain(unverified.id);
    });
  });
});
