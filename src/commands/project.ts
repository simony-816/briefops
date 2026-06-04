import type { Command } from "commander";
import { createProject, listProjects, showProject } from "../core/project.js";
import { parseCommaList } from "../core/storage.js";
import { parsePositiveInt, printTable } from "./shared.js";

export function registerProjectCommands(program: Command): void {
  const project = program.command("project").description("Manage project context files.");

  project
    .command("create <name>")
    .description("Create a project markdown file.")
    .option("--description <description>", "Project description.")
    .option("--tags <tags>", "Comma-separated tags.")
    .option("--max-tokens <tokens>", "Component token budget.", parsePositiveInt)
    .option("--force", "Overwrite an existing project file.")
    .action(async (name: string, options: Record<string, unknown>) => {
      const result = await createProject({
        name,
        description: options.description as string | undefined,
        tags: parseCommaList(options.tags as string | undefined),
        maxTokens: options.maxTokens as number | undefined,
        force: Boolean(options.force)
      });
      console.log(`Created project: ${result.name}`);
      console.log(result.path);
    });

  project
    .command("list")
    .description("List projects.")
    .action(async () => {
      const projects = await listProjects(process.cwd());
      if (projects.length === 0) {
        console.log("No projects found.");
        return;
      }

      printTable([
        ["Name", "Max Tokens", "Tags", "Description"],
        ...projects.map((item) => [
          item.data.name,
          String(item.data.max_tokens),
          item.data.tags.join(","),
          item.data.description
        ])
      ]);
    });

  project
    .command("show <name>")
    .description("Print a project file.")
    .action(async (name: string) => {
      console.log(await showProject(process.cwd(), name));
    });
}
