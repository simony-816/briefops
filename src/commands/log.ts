import type { Command } from "commander";
import { addWorkLog, listWorkLogs, readWorkLog } from "../core/log.js";
import { collectRepeated, parsePositiveInt, printTable } from "./shared.js";

export function registerLogCommands(program: Command): void {
  const log = program.command("log").description("Manage completed work logs.");

  log
    .command("add")
    .description("Add a completed work log.")
    .option("--project <project>", "Project name.")
    .option("--skill <skill>", "Skill name.")
    .option("--worker <worker>", "Worker profile name.")
    .requiredOption("--task <task>", "Task description.")
    .requiredOption("--result <result>", "Work result.")
    .option("--lesson <lesson>", "Lesson learned. Can be repeated.", collectRepeated, [])
    .option("--files <files>", "Comma-separated files changed.")
    .option("--commands <commands>", "Comma-separated commands run.")
    .option("--notes <notes>", "Additional notes.")
    .action(async (options: Record<string, unknown>) => {
      const result = await addWorkLog({
        project: options.project as string | undefined,
        skill: options.skill as string | undefined,
        worker: options.worker as string | undefined,
        task: options.task as string,
        result: options.result as string,
        lessons: options.lesson as string[] | undefined,
        files: options.files as string | undefined,
        commands: options.commands as string | undefined,
        notes: options.notes as string | undefined
      });
      console.log(`Added work log: ${result.log.id}`);
      console.log(result.path);
    });

  log
    .command("list")
    .description("List recent work logs.")
    .option("--project <project>", "Filter by project.")
    .option("--skill <skill>", "Filter by skill.")
    .option("--worker <worker>", "Filter by worker.")
    .option("--limit <limit>", "Maximum logs to list.", parsePositiveInt, 20)
    .action(async (options: Record<string, unknown>) => {
      const logs = await listWorkLogs({
        project: options.project as string | undefined,
        skill: options.skill as string | undefined,
        worker: options.worker as string | undefined,
        limit: options.limit as number
      });
      if (logs.length === 0) {
        console.log("No work logs found.");
        return;
      }

      printTable([
        ["ID", "Created", "Project", "Skill", "Worker", "Task", "Result"],
        ...logs.map((item) => [
          item.id,
          item.created_at,
          item.project ?? "",
          item.skill ?? "",
          item.worker ?? "",
          item.task,
          item.result
        ])
      ]);
    });

  log
    .command("show <id>")
    .description("Show a work log by id or latest.")
    .action(async (id: string) => {
      const item = await readWorkLog(process.cwd(), id);
      printTable([
        ["Field", "Value"],
        ["ID", item.id],
        ["Created", item.created_at],
        ["Project", item.project ?? ""],
        ["Skill", item.skill ?? ""],
        ["Worker", item.worker ?? ""],
        ["Task", item.task],
        ["Result", item.result],
        ["Lessons", item.lessons.join(" | ")],
        ["Files Changed", item.files_changed.join(",")],
        ["Commands Run", item.commands_run.join(",")],
        ["Notes", item.notes]
      ]);
    });
}
