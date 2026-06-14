import type { Command } from "commander";
import { bootstrapWorkspace } from "../core/bootstrap.js";
import { printTable } from "./shared.js";

export function registerBootstrapCommand(program: Command): void {
  program
    .command("bootstrap")
    .description("Initialize BriefOps and install first-context Codex guidance for this repo.")
    .option("--force", "Update existing generated guidance/plugin files when safe.")
    .option("--no-codex", "Skip AGENTS.md Codex guidance and prompt pack installation.")
    .option("--no-plugin", "Skip local Codex plugin bundle installation.")
    .option("--no-fix-gitignore", "Do not add `.briefops/` to .gitignore.")
    .option("--no-doctor", "Skip privacy and stability doctor checks.")
    .action(async (options: Record<string, unknown>) => {
      const result = await bootstrapWorkspace({
        force: Boolean(options.force),
        codex: options.codex as boolean | undefined,
        plugin: options.plugin as boolean | undefined,
        fixGitignore: options.fixGitignore as boolean | undefined,
        doctor: options.doctor as boolean | undefined
      });

      console.log("BriefOps bootstrap complete.");
      printTable([
        ["Item", "Status", "Path"],
        ["Workspace", "ready", result.root],
        ["Codex guidance", result.agentsPath ? "installed" : "skipped", result.agentsPath ?? "-"],
        ["Codex prompts", result.promptDir ? "ready" : "skipped", result.promptDir ?? "-"],
        ["Codex plugin", result.pluginRoot ? "installed" : "skipped", result.pluginRoot ?? "-"],
        [".gitignore", result.gitignorePath ? "updated" : "skipped", result.gitignorePath ?? "-"],
        [
          "Stability doctor",
          result.stability ? (result.stability.ok ? "ok" : "fail") : "skipped",
          result.stability ? `${result.stability.checks.length} check(s)` : "-"
        ],
        [
          "Privacy doctor",
          result.privacy ? (result.privacy.ok ? "ok" : "fail") : "skipped",
          result.privacy ? `${result.privacy.checks.length} check(s)` : "-"
        ]
      ]);

      if (result.warnings.length > 0) {
        console.log("");
        console.log("Warnings:");
        for (const warning of result.warnings) {
          console.log(`- ${warning}`);
        }
      }

      console.log("");
      console.log("Next commands:");
      for (const command of result.nextCommands) {
        console.log(`- ${command}`);
      }

      if (result.stability && !result.stability.ok) {
        process.exitCode = 1;
      }
      if (result.privacy && !result.privacy.ok) {
        process.exitCode = 1;
      }
    });
}
