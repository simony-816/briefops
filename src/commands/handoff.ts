import path from "node:path";
import type { Command } from "commander";
import {
  generateHandoff,
  inspectSavedHandoff,
  listSavedHandoffs,
  showSavedHandoff
} from "../core/handoff.js";
import { normalizeExportPolicy } from "../core/exportPolicy.js";
import { parsePositiveInt, printTable } from "./shared.js";

export function registerHandoffCommands(program: Command): void {
  const handoff = program
    .command("handoff")
    .description("Generate continuity handoff briefs for fresh AI coding threads.");

  handoff
    .command("generate")
    .description("Compile project, worker, memory, and recent work into a handoff.")
    .option("--project <project>", "Project name.")
    .option("--worker <worker>", "Worker profile name.")
    .option("--task <task>", "Optional next task.")
    .option("--budget <tokens>", "Overall token budget.", parsePositiveInt, 2500)
    .option("--export-policy <policy>", "local-private|shared-only", "local-private")
    .option("--save", "Save to .briefops/handoffs.")
    .option("--output <path>", "Write the handoff to a specific path.")
    .action(async (options: Record<string, unknown>) => {
      const result = await generateHandoff({
        project: options.project as string | undefined,
        worker: options.worker as string | undefined,
        task: options.task as string | undefined,
        budget: options.budget as number,
        exportPolicy: normalizeExportPolicy(options.exportPolicy as string | undefined),
        save: Boolean(options.save) || Boolean(options.output),
        outputPath: options.output
          ? path.resolve(process.cwd(), options.output as string)
          : undefined
      });
      console.log(result.content);
      if (result.savedPath) {
        console.error(`Saved handoff: ${result.savedPath}`);
      }
      console.error(`Estimated tokens: ${result.tokens}`);
    });

  handoff
    .command("list")
    .description("List saved handoffs.")
    .action(async () => {
      const handoffs = await listSavedHandoffs(process.cwd());
      if (handoffs.length === 0) {
        console.log("No saved handoffs found.");
        return;
      }

      printTable([
        ["ID", "Tokens", "Path"],
        ...handoffs.map((item) => [item.id, String(item.tokens), item.path])
      ]);
    });

  handoff
    .command("show <id>")
    .description("Show a saved handoff by id or latest.")
    .action(async (id: string) => {
      console.log(await showSavedHandoff(process.cwd(), id));
    });

  handoff
    .command("inspect <id>")
    .description("Inspect a saved handoff by id or latest.")
    .action(async (id: string) => {
      const result = await inspectSavedHandoff(process.cwd(), id);
      printTable([
        ["Field", "Value"],
        ["ID", result.metadata.id],
        ["Path", result.path],
        ["Project", result.metadata.project ?? ""],
        ["Worker", result.metadata.worker ?? ""],
        ["Characters", String(result.characters)],
        ["Estimated Tokens", String(result.metadata.total_tokens)],
        ["Budget", String(result.metadata.budget)],
        ["Warnings", result.metadata.warnings.join("; ")]
      ]);
    });
}
