import path from "node:path";
import type { Command } from "commander";
import {
  generateCodexMission,
  generateCodexPlan,
  installCodexPack
} from "../core/codex.js";
import { parsePositiveInt } from "./shared.js";

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
