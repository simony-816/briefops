import type { Command } from "commander";
import { createWorker, listWorkers, showWorker, summarizeWorker } from "../core/worker.js";
import { parseCommaList } from "../core/storage.js";
import { parsePositiveInt, printTable } from "./shared.js";

export function registerWorkerCommands(program: Command): void {
  const worker = program.command("worker").description("Manage worker profiles as skill bundles.");

  worker
    .command("create <name>")
    .description("Create a worker profile.")
    .option("--description <description>", "Worker description.")
    .option("--project <project>", "Default project.")
    .option("--skills <skills>", "Comma-separated default skills.")
    .option("--style <style>", "Comma-separated style notes.")
    .option("--max-tokens <tokens>", "Worker profile token budget.", parsePositiveInt)
    .option("--force", "Overwrite an existing worker profile.")
    .action(async (name: string, options: Record<string, unknown>) => {
      const result = await createWorker({
        name,
        description: options.description as string | undefined,
        project: options.project as string | undefined,
        skills: parseCommaList(options.skills as string | undefined),
        style: parseCommaList(options.style as string | undefined),
        maxTokens: options.maxTokens as number | undefined,
        force: Boolean(options.force)
      });
      console.log(`Created worker: ${result.worker.name}`);
      console.log(result.path);
    });

  worker
    .command("list")
    .description("List worker profiles.")
    .option("--status <status>", "Filter by status.")
    .action(async (options: Record<string, unknown>) => {
      const workers = await listWorkers({
        status: options.status as string | undefined
      });
      if (workers.length === 0) {
        console.log("No workers found.");
        return;
      }

      printTable([
        ["Name", "Status", "Project", "Skills", "Description"],
        ...workers.map((item) => [
          item.name,
          item.status,
          item.project ?? "",
          item.default_skills.join(","),
          item.description
        ])
      ]);
    });

  worker
    .command("show <name>")
    .description("Print a worker profile.")
    .action(async (name: string) => {
      console.log(await showWorker(process.cwd(), name));
    });

  worker
    .command("summary <name>")
    .description("Summarize worker history from logs.")
    .option("--limit <limit>", "Maximum logs to summarize.", parsePositiveInt, 5)
    .action(async (name: string, options: Record<string, unknown>) => {
      console.log(await summarizeWorker(process.cwd(), name, options.limit as number));
    });
}
