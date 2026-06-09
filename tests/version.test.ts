import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { briefopsVersion } from "../src/version.js";

describe("BriefOps version", () => {
  it("matches package.json", async () => {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "package.json"), "utf8")
    ) as { version: string };

    expect(briefopsVersion).toBe(packageJson.version);
  });
});
