import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

describe("workspace initialization", () => {
  it("creates the .briefops structure idempotently", async () => {
    await withTempDir(async (dir) => {
      const first = await initWorkspace(dir);
      const second = await initWorkspace(dir);

      expect(first.created.length).toBeGreaterThan(0);
      expect(second.existing.length).toBeGreaterThan(0);
      await expect(fs.access(path.join(dir, ".briefops", "config.yaml"))).resolves.toBeUndefined();
      await expect(fs.access(path.join(dir, ".briefops", "memory", "lessons.yaml"))).resolves.toBeUndefined();
    });
  });
});
