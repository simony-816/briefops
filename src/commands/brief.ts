import path from "node:path";
import type { Command } from "commander";
import {
  generateBrief,
  inspectSavedBrief,
  listSavedBriefs,
  saveGeneratedBrief,
  showSavedBrief
} from "../core/brief.js";
import { parsePositiveInt, printTable } from "./shared.js";

export function registerBriefCommands(program: Command): void {
  const brief = program.command("brief").description("Generate token-aware task briefs.");

  brief
    .command("generate")
    .description("Compile skill, project context, memory, and task into a brief.")
    .option("--skill <skill>", "Skill name.")
    .option("--project <project>", "Project name.")
    .option("--worker <worker>", "Worker profile name.")
    .requiredOption("--task <task>", "Task description.")
    .option("--budget <tokens>", "Overall token budget.", parsePositiveInt, 2000)
    .option("--adapter <adapter>", "generic|codex|claude-code", "generic")
    .option("--save", "Save to .briefops/briefs.")
    .option("--output <path>", "Write the brief to a specific path.")
    .option("--copy", "Reserved for future clipboard support.")
    .action(async (options: Record<string, unknown>) => {
      const generated = await generateBrief({
        skill: options.skill as string | undefined,
        project: options.project as string | undefined,
        worker: options.worker as string | undefined,
        task: options.task as string,
        budget: options.budget as number,
        adapter: options.adapter as string | undefined
      });

      console.log(generated.content);

      if (options.copy) {
        console.error("Warning: --copy is not implemented yet; brief printed to stdout.");
      }

      if (options.save || options.output) {
        const savedPath = await saveGeneratedBrief({
          cwd: process.cwd(),
          generated,
          project: options.project as string | undefined,
          skill: options.skill as string | undefined,
          worker: options.worker as string | undefined,
          outputPath: options.output
            ? path.resolve(process.cwd(), options.output as string)
            : undefined
        });
        console.error(`Saved brief: ${savedPath}`);
      }
    });

  brief
    .command("list")
    .description("List saved briefs.")
    .action(async () => {
      const briefs = await listSavedBriefs(process.cwd());
      if (briefs.length === 0) {
        console.log("No saved briefs found.");
        return;
      }

      printTable([
        ["ID", "Tokens", "Path"],
        ...briefs.map((item) => [item.id, String(item.tokens), item.path])
      ]);
    });

  brief
    .command("show <id>")
    .description("Show a saved brief by id or latest.")
    .action(async (id: string) => {
      console.log(await showSavedBrief(process.cwd(), id));
    });

  brief
    .command("inspect <id>")
    .description("Inspect a saved brief by id or latest.")
    .action(async (id: string) => {
      const result = await inspectSavedBrief(process.cwd(), id);
      printTable([
        ["Field", "Value"],
        ["ID", result.id],
        ["Path", result.path],
        ["Characters", String(result.characters)],
        ["Estimated Tokens", String(result.tokens)]
      ]);
    });
}
