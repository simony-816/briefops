import type { Command } from "commander";
import { memoryCategories, workspacePaths } from "../core/paths.js";
import { pathExists } from "../core/storage.js";
import { printTable } from "./shared.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check the local BriefOps workspace structure.")
    .action(async () => {
      const paths = workspacePaths(process.cwd());
      const checks = [
        ["Workspace", paths.root],
        ["Config", paths.config],
        ["Skills", paths.skills],
        ["Projects", paths.projects],
        ["Memory", paths.memory],
        ...memoryCategories.map((category) => [
          `Memory/${category}`,
          `${paths.memory}/${category}.yaml`
        ]),
        ["Workers", paths.workers],
        ["Logs", paths.logs],
        ["Briefs", paths.briefs],
        ["Codex", paths.codex],
        ["Codex Prompts", paths.codexPrompts],
        ["Evals", paths.evals],
        ["Eval Results", paths.evalResults],
        ["Patches", paths.patches],
        ["Templates", paths.templates]
      ];
      const rows = await Promise.all(
        checks.map(async ([label, filePath]) => [
          label,
          (await pathExists(filePath)) ? "ok" : "missing",
          filePath
        ])
      );
      const missing = rows.filter((row) => row[1] === "missing");

      printTable([["Check", "Status", "Path"], ...rows]);
      if (missing.length > 0) {
        process.exitCode = 1;
      }
    });
}
