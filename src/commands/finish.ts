import type { Command } from "commander";
import { finishWork } from "../core/workflow.js";
import { collectRepeated } from "./shared.js";

export function registerFinishCommand(program: Command): void {
  program
    .command("finish")
    .description("Finish a task: log work, propose memory, and print the next continue command.")
    .option("--project <project>", "Project name.")
    .option("--skill <skill>", "Skill name.")
    .option("--worker <worker>", "Worker profile name.")
    .requiredOption("--task <task>", "Completed task description.")
    .requiredOption("--result <result>", "Work result.")
    .option("--lesson <lesson>", "Lesson learned. Can be repeated.", collectRepeated, [])
    .option("--open-risk <text>", "Unresolved risk. Can be repeated.", collectRepeated, [])
    .option("--next-step <text>", "Suggested next step. Can be repeated.", collectRepeated, [])
    .option("--decision <text>", "Decision made. Can be repeated.", collectRepeated, [])
    .option("--incident <text>", "Incident or failure pattern. Can be repeated.", collectRepeated, [])
    .option("--files <files>", "Comma-separated files changed.")
    .option("--commands <commands>", "Comma-separated commands run.")
    .option("--notes <notes>", "Additional notes.")
    .option("--importance <importance>", "trivial|normal|durable|incident", "normal")
    .option("--no-memory-proposal", "Skip memory proposal generation.")
    .option("--propose-skill-patch", "Also propose a skill patch from log lessons.")
    .option("--refresh-worker", "Refresh the worker summary after logging.")
    .option("--continue-task <task>", "Task text to use in the printed continue command.")
    .action(async (options: Record<string, unknown>) => {
      const result = await finishWork({
        project: options.project as string | undefined,
        skill: options.skill as string | undefined,
        worker: options.worker as string | undefined,
        task: options.task as string,
        result: options.result as string,
        lessons: options.lesson as string[] | undefined,
        openRisks: options.openRisk as string[] | undefined,
        nextSteps: options.nextStep as string[] | undefined,
        decisions: options.decision as string[] | undefined,
        incidents: options.incident as string[] | undefined,
        files: options.files as string | undefined,
        commands: options.commands as string | undefined,
        notes: options.notes as string | undefined,
        importance: options.importance as string | undefined,
        noMemoryProposal: Boolean(options.noMemoryProposal),
        proposeSkillPatch: Boolean(options.proposeSkillPatch),
        refreshWorker: Boolean(options.refreshWorker),
        continueTask: options.continueTask as string | undefined
      });

      console.log(`Added work log: ${result.logId}`);
      console.log(result.logPath);
      if (result.memoryProposalId && result.memoryProposalPath) {
        console.log(`Created memory proposal: ${result.memoryProposalId}`);
        console.log(result.memoryProposalPath);
      }
      if (result.skillPatchId && result.skillPatchPath) {
        console.log(`Created skill patch: ${result.skillPatchId}`);
        console.log(result.skillPatchPath);
      }
      if (result.workerSummaryPath) {
        console.log(`Refreshed worker summary: ${result.workerSummaryPath}`);
      }
      if (result.warnings.length > 0) {
        console.log("");
        console.log("Warnings:");
        for (const warning of result.warnings) {
          console.log(`- ${warning}`);
        }
      }
      console.log("");
      console.log("Next command:");
      console.log(result.nextCommand);
    });
}
