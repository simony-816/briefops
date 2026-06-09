import type { Command } from "commander";
import { inspectBriefTokens } from "../core/brief.js";
import { defaultContextBudgets } from "../core/contextBudget.js";
import { inspectContinuityHealth } from "../core/continuity.js";
import { formatMemoryItem, listMemory, selectContinuityContext, selectRelevantMemory } from "../core/memory.js";
import { memoryCategories, workspacePaths } from "../core/paths.js";
import { pathExists } from "../core/storage.js";
import { readWorker } from "../core/worker.js";
import { parsePositiveInt, printTable } from "./shared.js";

export function registerInspectCommands(program: Command): void {
  const inspect = program.command("inspect").description("Inspect BriefOps inputs.");

  inspect
    .command("budget")
    .description("Print BriefOps context budget targets.")
    .action(() => {
      console.log("BriefOps Context Budget");
      console.log("");
      console.log("Exports:");
      console.log(`- AGENTS.md: target ${defaultContextBudgets.exportAgentsMd} tokens`);
      console.log(`- CLAUDE.md: target ${defaultContextBudgets.exportClaudeMd} tokens`);
      console.log(`- Cursor rule: target ${defaultContextBudgets.exportCursorRule} tokens`);
      console.log(`- Cursor rules total: target ${defaultContextBudgets.exportCursorTotal} tokens`);
      console.log("");
      console.log("Runtime:");
      console.log(`- prime default: ${defaultContextBudgets.prime} tokens`);
      console.log(`- handoff default: ${defaultContextBudgets.handoff} tokens`);
      console.log(`- resume pack default: ${defaultContextBudgets.resumePack} tokens`);
    });

  inspect
    .command("retrieval")
    .description("Inspect task-aware continuity context retrieval.")
    .option("--project <project>", "Project name.")
    .option("--skill <skill>", "Skill name.")
    .option("--worker <worker>", "Worker profile name.")
    .requiredOption("--task <task>", "Task text for relevance scoring.")
    .option("--budget <tokens>", "Memory token budget.", parsePositiveInt, 500)
    .action(async (options: Record<string, unknown>) => {
      const worker = options.worker
        ? await readWorker(process.cwd(), options.worker as string)
        : undefined;
      const selected = await selectContinuityContext({
        cwd: process.cwd(),
        project: (options.project as string | undefined) ?? worker?.project,
        skill: options.skill as string | undefined,
        skills: worker?.default_skills,
        worker: worker?.name,
        task: options.task as string,
        maxTokens: options.budget as number,
        quotas: {
          facts: 3,
          decisions: 5,
          lessons: 6,
          incidents: 4,
          deprecated: 0
        }
      });
      console.log("Selected continuity context");
      console.log("");
      if (selected.selections.length === 0) {
        console.log("No continuity context selected.");
        return;
      }
      printTable([
        ["Score", "Type", "Source", "Content"],
        ...selected.selections.map((selection) => [
          String(selection.score),
          selection.item.type,
          selection.item.source ?? "memory",
          selection.item.content
        ])
      ]);
    });

  inspect
    .command("continuity")
    .description("Inspect continuity health for a project and worker.")
    .requiredOption("--project <project>", "Project name.")
    .requiredOption("--worker <worker>", "Worker profile name.")
    .action(async (options: Record<string, unknown>) => {
      const health = await inspectContinuityHealth({
        project: options.project as string,
        worker: options.worker as string
      });
      console.log("Continuity Health");
      console.log("");
      console.log(`Project: ${health.project}`);
      console.log(`Worker: ${health.worker}`);
      console.log("");
      console.log("Workspace:");
      console.log(`- skills: ${health.workspace.skills ? "ok" : "missing"}`);
      console.log(`- project: ${health.workspace.project ? "ok" : "missing"}`);
      console.log(`- worker: ${health.workspace.worker ? "ok" : "missing"}`);
      console.log("");
      console.log("Memory:");
      for (const [category, count] of Object.entries(health.memory)) {
        console.log(`- active ${category}: ${count}`);
      }
      console.log("");
      console.log("History:");
      console.log(`- work logs: ${health.history.workLogs}`);
      console.log(`- latest log: ${health.history.latestLog ?? "none"}`);
      console.log(`- open risks: ${health.history.openRisks}`);
      console.log(`- next steps: ${health.history.nextSteps}`);
      console.log("");
      console.log("Continuity readiness:");
      console.log(health.readiness);
      console.log("");
      console.log("Recommended next command:");
      console.log(health.recommendedNextCommand);
      const activeMemoryTotal = Object.values(health.memory).reduce((sum, count) => sum + count, 0);
      if (activeMemoryTotal === 0 && health.history.workLogs === 0) {
        process.exitCode = 1;
      }
    });

  inspect
    .command("tokens")
    .description("Estimate token usage for a brief without printing the full brief.")
    .option("--skill <skill>", "Skill name.")
    .option("--project <project>", "Project name.")
    .option("--worker <worker>", "Worker profile name.")
    .requiredOption("--task <task>", "Task description.")
    .option("--budget <tokens>", "Overall token budget.", parsePositiveInt, 2000)
    .option("--adapter <adapter>", "generic|codex|claude-code", "generic")
    .action(async (options: Record<string, unknown>) => {
      const report = await inspectBriefTokens({
        skill: options.skill as string | undefined,
        project: options.project as string | undefined,
        worker: options.worker as string | undefined,
        task: options.task as string,
        budget: options.budget as number,
        adapter: options.adapter as string | undefined
      });

      console.log("Token inspection");
      console.log("");
      console.log("Skill:");
      console.log(`  ${report.skillName}: ${report.skillTokens} tokens`);
      if (report.workerName) {
        console.log("");
        console.log("Worker:");
        console.log(`  ${report.workerName}: ${report.workerTokens} tokens`);
      }
      console.log("");
      console.log("Project:");
      console.log(`  ${report.projectName}: ${report.projectTokens} tokens`);
      console.log("");
      console.log("Memory:");
      console.log(`  effective section tokens: ${report.memoryTokens}`);
      console.log("");
      console.log("Task:");
      console.log(`  effective section tokens: ${report.taskTokens}`);
      console.log("");
      console.log("Rendered brief estimate:");
      console.log(`  ${report.renderedTokens} / ${report.budget}`);
      if (report.warnings.length > 0) {
        console.log("");
        console.log("Warnings:");
        for (const warning of report.warnings) {
          console.log(`  - ${warning}`);
        }
      }
    });

  inspect
    .command("workspace")
    .description("Inspect the local workspace paths.")
    .action(async () => {
      const paths = workspacePaths(process.cwd());
      const rows = await Promise.all(
        Object.entries(paths)
          .filter(([key]) => key !== "cwd")
          .map(async ([key, filePath]) => [
            key,
            (await pathExists(filePath)) ? "ok" : "missing",
            filePath
          ])
      );

      printTable([["Path", "Status", "Value"], ...rows]);
    });

  inspect
    .command("memory")
    .description("Inspect memory counts or task-aware selection.")
    .option("--project <project>", "Filter by project.")
    .option("--skill <skill>", "Filter by skill.")
    .option("--worker <worker>", "Worker profile name.")
    .option("--task <task>", "Task text for relevance scoring.")
    .option("--budget <tokens>", "Memory token budget.", parsePositiveInt, 500)
    .action(async (options: Record<string, unknown>) => {
      if (options.task) {
        const selected = await selectRelevantMemory({
          cwd: process.cwd(),
          project: options.project as string | undefined,
          skill: options.skill as string | undefined,
          worker: options.worker as string | undefined,
          task: options.task as string,
          maxTokens: options.budget as number,
          includeDeprecated: true
        });
        console.log("Selected memory:");
        if (selected.selections.length === 0) {
          console.log("No memory selected.");
        } else {
          selected.selections.forEach((selection, index) => {
            console.log(
              `${index + 1}. ${formatMemoryItem(selection.item)} score=${selection.score} reason=${selection.reason}`
            );
          });
        }
        console.log("");
        console.log("Omitted:");
        if (selected.omittedSelections.length === 0) {
          console.log("No matching memory omitted.");
        } else {
          selected.omittedSelections.forEach((selection) => {
            console.log(
              `- ${selection.item.id} score=${selection.score} reason=${selection.reason}`
            );
          });
        }
        return;
      }

      const rows = await Promise.all(
        memoryCategories.map(async (category) => {
          const items = await listMemory({
            type: category,
            project: options.project as string | undefined,
            skill: options.skill as string | undefined
          });
          const active = items.filter((item) => item.status === "active").length;
          return [category, String(items.length), String(active)];
        })
      );

      printTable([["Category", "Items", "Active"], ...rows]);
    });
}
