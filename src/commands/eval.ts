import type { Command } from "commander";
import { createEvalCase, listEvalCases, runEval, showEval } from "../core/eval.js";
import { collectRepeated, parsePositiveInt, printTable } from "./shared.js";

export function registerEvalCommands(program: Command): void {
  const evalCommand = program.command("eval").description("Manage checklist-based eval cases.");

  evalCommand
    .command("create <name>")
    .description("Create a checklist eval case.")
    .option("--skill <skill>", "Skill name.")
    .option("--project <project>", "Project name.")
    .option("--worker <worker>", "Worker profile name.")
    .option("--description <description>", "Case description.")
    .option("--input <input>", "Task input for brief generation.")
    .option("--expected <text>", "Expected phrase/check. Can be repeated.", collectRepeated, [])
    .option("--pass-threshold <count>", "Minimum expected checks required to pass.", parsePositiveInt)
    .option("--force", "Overwrite an existing eval case.")
    .action(async (name: string, options: Record<string, unknown>) => {
      const result = await createEvalCase({
        name,
        skill: options.skill as string | undefined,
        project: options.project as string | undefined,
        worker: options.worker as string | undefined,
        description: options.description as string | undefined,
        input: options.input as string | undefined,
        expected: options.expected as string[] | undefined,
        passThreshold: options.passThreshold as number | undefined,
        force: Boolean(options.force)
      });
      console.log(`Created eval case: ${result.evalCase.id}`);
      console.log(result.path);
    });

  evalCommand
    .command("list")
    .description("List eval cases.")
    .action(async () => {
      const cases = await listEvalCases(process.cwd());
      if (cases.length === 0) {
        console.log("No eval cases found.");
        return;
      }

      printTable([
        ["ID", "Skill", "Project", "Worker", "Expected"],
        ...cases.map((item) => [
          item.id,
          item.skill ?? "",
          item.project ?? "",
          item.worker ?? "",
          String(item.expected.length)
        ])
      ]);
    });

  evalCommand
    .command("run")
    .description("Run matching checklist eval cases.")
    .option("--skill <skill>", "Filter/run with skill.")
    .option("--project <project>", "Filter/run with project.")
    .option("--worker <worker>", "Filter/run with worker.")
    .option("--budget <tokens>", "Brief token budget.", parsePositiveInt, 2000)
    .option("--adapter <adapter>", "generic|codex|claude-code", "generic")
    .action(async (options: Record<string, unknown>) => {
      const summary = await runEval({
        skill: options.skill as string | undefined,
        project: options.project as string | undefined,
        worker: options.worker as string | undefined,
        budget: options.budget as number,
        adapter: options.adapter as string | undefined
      });

      console.log(`${summary.cases.length} cases run`);
      console.log(`${summary.passed} passed`);
      console.log(`${summary.failed} failed`);
      console.log("");
      printTable([
        ["Case", "Result", "Score", "Missing"],
        ...summary.cases.map((item) => [
          item.case.id,
          item.result.passed ? "pass" : "fail",
          `${item.result.score}/${item.case.expected.length}`,
          item.result.missing.join(",")
        ])
      ]);
      console.error(`Saved eval result: ${summary.resultPath}`);
    });

  evalCommand
    .command("show <id>")
    .description("Show an eval case or saved result.")
    .action(async (id: string) => {
      console.log(await showEval(process.cwd(), id));
    });
}
