import { describe, expect, it } from "vitest";
import { createProject, listProjects, readProject } from "../src/core/project.js";
import { createSkill, listSkills, readSkill } from "../src/core/skill.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

describe("skill and project documents", () => {
  it("creates and parses skill and project files", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await createSkill({
        cwd: dir,
        name: "risk-review",
        description: "Review changes for risk.",
        tags: ["review", "risk"]
      });
      await createProject({
        cwd: dir,
        name: "atlas-q",
        description: "Rule-based trading system.",
        tags: ["quant"]
      });

      const skill = await readSkill(dir, "risk-review");
      const project = await readProject(dir, "atlas-q");

      expect(skill.data.name).toBe("risk-review");
      expect(skill.data.tags).toContain("risk");
      expect(project.data.name).toBe("atlas-q");
      expect(project.body).toContain("Rule-based trading system");
      expect(await listSkills(dir)).toHaveLength(1);
      expect(await listProjects(dir)).toHaveLength(1);
    });
  });

  it("does not overwrite skill files without force", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await createSkill({ cwd: dir, name: "scope-guard" });

      await expect(createSkill({ cwd: dir, name: "scope-guard" })).rejects.toThrow(
        "File already exists"
      );
    });
  });
});
