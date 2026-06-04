import type { Command } from "commander";
import { inspectBriefTokens } from "../core/brief.js";
import { listWorkLogs } from "../core/log.js";
import { formatMemoryItem, listMemory, selectContinuityContext, selectRelevantMemory } from "../core/memory.js";
import { memoryCategories, skillFilePath, workspacePaths } from "../core/paths.js";
import { readProject } from "../core/project.js";
import { pathExists } from "../core/storage.js";
import { readWorker } from "../core/worker.js";
import { parsePositiveInt, printTable } from "./shared.js";

export function registerInspectCommands(program: Command): void {
  const inspect = program.command("inspect").description("Inspect BriefOps inputs.");

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
      const projectName = options.project as string;
      const workerName = options.worker as string;
      let projectOk = true;
      let workerOk = true;
      let worker;
      try {
        await readProject(process.cwd(), projectName);
      } catch {
        projectOk = false;
      }
      try {
        worker = await readWorker(process.cwd(), workerName);
      } catch {
        workerOk = false;
      }
      const skills = worker?.default_skills ?? [];
      const skillStatuses = await Promise.all(
        skills.map(async (skill) => [skill, await pathExists(skillFilePath(process.cwd(), skill))] as const)
      );
      const memoryRows = await Promise.all(
        memoryCategories.map(async (category) => {
          const items = await listMemory({
            type: category,
            project: projectName,
            status: "active"
          });
          return [category, items.length] as const;
        })
      );
      const logs = await listWorkLogs({
        project: projectName,
        worker: workerName,
        limit: Number.MAX_SAFE_INTEGER
      });
      const openRisks = logs.flatMap((log) => log.open_risks);
      const nextSteps = logs.flatMap((log) => log.next_steps);
      const anySkillMissing = skillStatuses.some(([, ok]) => !ok);
      const activeMemoryTotal = memoryRows.reduce((sum, [, count]) => sum + count, 0);
      const fail = !projectOk || !workerOk || skills.length === 0;
      const warn = !fail && (
        anySkillMissing ||
        logs.length === 0 ||
        openRisks.length === 0 ||
        nextSteps.length === 0 ||
        (memoryRows.find(([category]) => category === "lessons")?.[1] ?? 0) === 0
      );
      const readiness = fail ? "FAIL" : warn ? "WARN" : "PASS";
      console.log("Continuity Health");
      console.log("");
      console.log(`Project: ${projectName}`);
      console.log(`Worker: ${workerName}`);
      console.log("");
      console.log("Workspace:");
      console.log(`- skills: ${skills.length > 0 && !anySkillMissing ? "ok" : "missing"}`);
      console.log(`- project: ${projectOk ? "ok" : "missing"}`);
      console.log(`- worker: ${workerOk ? "ok" : "missing"}`);
      console.log("");
      console.log("Memory:");
      for (const [category, count] of memoryRows) {
        console.log(`- active ${category}: ${count}`);
      }
      console.log("");
      console.log("History:");
      console.log(`- work logs: ${logs.length}`);
      console.log(`- latest log: ${logs[0]?.created_at.slice(0, 10) ?? "none"}`);
      console.log(`- open risks: ${openRisks.length}`);
      console.log(`- next steps: ${nextSteps.length}`);
      console.log("");
      console.log("Continuity readiness:");
      console.log(readiness);
      console.log("");
      console.log("Recommended next command:");
      console.log(
        `briefops handoff generate --project ${projectName} --worker ${workerName} --task "${nextSteps[0] ?? "<next task>"}" --save`
      );
      if (activeMemoryTotal === 0 && logs.length === 0) {
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
