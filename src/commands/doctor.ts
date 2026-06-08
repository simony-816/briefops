import type { Command } from "commander";
import { cleanStaleLocks } from "../core/lock.js";
import { memoryCategories, workspacePaths } from "../core/paths.js";
import { runSecurityDoctor } from "../core/securityDoctor.js";
import { pathExists } from "../core/storage.js";
import { printTable } from "./shared.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check the local BriefOps workspace structure.")
    .option("--security", "Run security, export, and local conflict checks.")
    .option("--fix-stale-locks", "Remove stale BriefOps workspace locks before reporting security checks.")
    .action(async (options: Record<string, unknown>) => {
      if (options.security) {
        if (options.fixStaleLocks) {
          const removed = await cleanStaleLocks();
          if (removed.length > 0) {
            console.log("Removed stale lock files:");
            for (const filePath of removed) {
              console.log(`- ${filePath}`);
            }
            console.log("");
          } else {
            console.log("No stale lock files removed.");
            console.log("");
          }
        }
        const result = await runSecurityDoctor();
        printTable([
          ["Check", "Status", "Detail"],
          ...result.checks.map((check) => [check.name, check.status, check.detail])
        ]);
        if (!result.ok) {
          process.exitCode = 1;
        }
        return;
      }

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
