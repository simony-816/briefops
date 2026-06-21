import type { Command } from "commander";
import {
  harnessRoutes,
  renderHarnessRoute,
  routeHarnessTask
} from "../core/harness.js";
import { printTable } from "./shared.js";

export function registerHarnessCommands(program: Command): void {
  const harness = program
    .command("harness")
    .description("Route tasks through the BriefOps Master Harness workflow.");

  harness
    .command("route")
    .description("Classify a task and print the required workflow depth.")
    .requiredOption("--task <task>", "Task description.")
    .option("--type <type>", "Explicit task type.")
    .option("--json", "Print machine-readable JSON.")
    .action((options: Record<string, unknown>) => {
      const result = routeHarnessTask({
        task: options.task as string,
        taskType: options.type as string | undefined
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(renderHarnessRoute(result));
    });

  harness
    .command("matrix")
    .description("Print the Master Harness routing matrix.")
    .option("--json", "Print machine-readable JSON.")
    .action((options: Record<string, unknown>) => {
      const routes = harnessRoutes();
      if (options.json) {
        console.log(JSON.stringify(routes, null, 2));
        return;
      }

      printTable([
        [
          "Task Type",
          "Spec",
          "Plan",
          "Goal Ledger",
          "Findings",
          "Verification",
          "Memory Update"
        ],
        ...routes.map((route) => [
          route.label,
          route.spec,
          route.plan,
          route.goalLedger,
          route.findings,
          route.verification,
          route.memoryUpdate
        ])
      ]);
    });
}
