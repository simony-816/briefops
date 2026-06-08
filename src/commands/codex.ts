import path from "node:path";
import type { Command } from "commander";
import {
  generateCodexMission,
  generateCodexPlan,
  generateCodexResume,
  installCodexPack
} from "../core/codex.js";
import { inspectCodexPlugin, installCodexPlugin } from "../core/codexPlugin.js";
import { runPrimeCommand } from "./prime.js";
import { parsePositiveInt, printTable } from "./shared.js";

export function registerCodexCommands(program: Command): void {
  const codex = program
    .command("codex")
    .description("Generate Codex-favored prompts, missions, and repo guidance.");

  codex
    .command("install")
    .description("Install BriefOps Codex guidance into AGENTS.md and .briefops/codex.")
    .option("--force", "Append BriefOps guidance when AGENTS.md already exists.")
    .action(async (options: Record<string, unknown>) => {
      const result = await installCodexPack({
        force: Boolean(options.force)
      });
      console.log("BriefOps Codex pack installed.");
      console.log(`AGENTS.md: ${result.agentsPath}`);
      console.log(`Prompts: ${result.promptDir}`);
    });

  const plugin = codex
    .command("plugin")
    .description("Manage local BriefOps Codex plugin assets.");

  plugin
    .command("install")
    .description("Install the BriefOps Codex plugin bundle into .briefops/codex/plugin.")
    .option("--force", "Overwrite generated plugin files.")
    .action(async (options: Record<string, unknown>) => {
      const result = await installCodexPlugin({
        force: Boolean(options.force)
      });
      console.log("BriefOps Codex plugin bundle installed.");
      console.log(`Plugin: ${result.root}`);
      console.log(`Files: ${result.files.length}`);
      console.log("Next: install this local plugin folder in Codex, or use the generated skills as repo guidance.");
    });

  plugin
    .command("doctor")
    .description("Check whether the local BriefOps Codex plugin bundle is installed and current.")
    .action(async () => {
      const result = await inspectCodexPlugin();
      console.log(`Plugin: ${result.root}`);
      printTable([
        ["File", "Status"],
        ...result.files.map((file) => [file.relativePath, file.status])
      ]);
      if (!result.ok) {
        process.exitCode = 1;
      }
    });

  codex
    .command("prime")
    .description("Print compact BriefOps context for starting Codex work.")
    .option("--worker <worker>", "Worker profile name.")
    .option("--project <project>", "Project name.")
    .option("--task <task>", "Current task.")
    .option("--max-tokens <tokens>", "Prime context token budget.", parsePositiveInt, 800)
    .option("--export-policy <policy>", "local-private|shared-only", "local-private")
    .action(async (options: Record<string, unknown>) => {
      await runPrimeCommand(options, {
        format: "codex"
      });
    });

  codex
    .command("resume")
    .description("Generate a continuity-aware Codex resume prompt.")
    .option("--worker <worker>", "Worker profile name.")
    .option("--project <project>", "Project name.")
    .requiredOption("--task <task>", "Task description.")
    .option("--from-handoff <id>", "Saved handoff id or latest.")
    .option("--budget <tokens>", "Resume token budget.", parsePositiveInt, 3000)
    .option("--mode <mode>", "loop|execute|plan", "loop")
    .option("--completion-promise <text>", "Concrete completion promise.")
    .option("--save", "Save to .briefops/codex/prompts.")
    .option("--output <path>", "Write the prompt to a specific path.")
    .action(async (options: Record<string, unknown>) => {
      const result = await generateCodexResume({
        worker: options.worker as string | undefined,
        project: options.project as string | undefined,
        task: options.task as string,
        fromHandoff: options.fromHandoff as string | undefined,
        budget: options.budget as number,
        mode: options.mode as string | undefined,
        completionPromise: options.completionPromise as string | undefined,
        save: Boolean(options.save) || Boolean(options.output),
        outputPath: options.output
          ? path.resolve(process.cwd(), options.output as string)
          : undefined
      });
      console.log(result.content);
      if (result.savedPath) {
        console.error(`Saved Codex resume: ${result.savedPath}`);
      }
      console.error(`Estimated tokens: ${result.tokens}`);
    });

  codex
    .command("mission")
    .description("Generate a Codex mission prompt with evidence gates and a completion promise.")
    .option("--skill <skill>", "Skill name.")
    .option("--project <project>", "Project name.")
    .option("--worker <worker>", "Worker profile name.")
    .requiredOption("--task <task>", "Task description.")
    .option("--budget <tokens>", "Brief token budget.", parsePositiveInt, 2500)
    .option("--completion-promise <text>", "Concrete completion promise.")
    .option("--mode <mode>", "loop|execute|plan", "loop")
    .option("--save", "Save to .briefops/codex/prompts.")
    .option("--output <path>", "Write the prompt to a specific path.")
    .action(async (options: Record<string, unknown>) => {
      const result = await generateCodexMission({
        skill: options.skill as string | undefined,
        project: options.project as string | undefined,
        worker: options.worker as string | undefined,
        task: options.task as string,
        budget: options.budget as number,
        completionPromise: options.completionPromise as string | undefined,
        mode: options.mode as string | undefined,
        save: Boolean(options.save) || Boolean(options.output),
        outputPath: options.output
          ? path.resolve(process.cwd(), options.output as string)
          : undefined
      });
      console.log(result.content);
      if (result.savedPath) {
        console.error(`Saved Codex mission: ${result.savedPath}`);
      }
      console.error(`Estimated tokens: ${result.tokens}`);
    });

  codex
    .command("plan")
    .description("Generate a Codex planning prompt that does not edit product code.")
    .option("--project <project>", "Project name.")
    .option("--worker <worker>", "Worker profile name.")
    .requiredOption("--idea <idea>", "What to plan.")
    .option("--save", "Save to .briefops/codex/prompts.")
    .option("--output <path>", "Write the prompt to a specific path.")
    .action(async (options: Record<string, unknown>) => {
      const result = await generateCodexPlan({
        project: options.project as string | undefined,
        worker: options.worker as string | undefined,
        idea: options.idea as string,
        save: Boolean(options.save) || Boolean(options.output),
        outputPath: options.output
          ? path.resolve(process.cwd(), options.output as string)
          : undefined
      });
      console.log(result.content);
      if (result.savedPath) {
        console.error(`Saved Codex plan: ${result.savedPath}`);
      }
      console.error(`Estimated tokens: ${result.tokens}`);
    });
}
