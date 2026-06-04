import { BriefOpsError } from "./errors.js";
import { normalizeName, projectFilePath, workspacePaths } from "./paths.js";
import {
  listFilesBySuffix,
  parseMarkdownWithFrontmatter,
  readTextFile,
  stringifyMarkdownWithFrontmatter,
  writeTextFile
} from "./storage.js";
import { requireWorkspace } from "./workspace.js";
import { projectFrontmatterSchema, type ProjectDocument } from "../schemas/project.js";

export type CreateProjectOptions = {
  cwd?: string;
  name: string;
  description?: string;
  tags?: string[];
  maxTokens?: number;
  force?: boolean;
};

export async function createProject(
  options: CreateProjectOptions
): Promise<{ path: string; name: string }> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);

  const name = normalizeName(options.name);
  const filePath = projectFilePath(cwd, name);
  const data = projectFrontmatterSchema.parse({
    name,
    description: options.description ?? "",
    max_tokens: options.maxTokens ?? 500,
    tags: options.tags ?? []
  });
  const body = [
    `# Project: ${name}`,
    "",
    "## Active Facts",
    "",
    options.description ? `- ${options.description}` : "- Add durable project facts here.",
    "",
    "## Active Constraints",
    "",
    "- Add constraints the agent must respect.",
    "",
    "## Read If Needed",
    "",
    "- Add source files or docs to inspect when relevant."
  ].join("\n");

  await writeTextFile(filePath, stringifyMarkdownWithFrontmatter(data, body), {
    force: options.force
  });

  return { path: filePath, name };
}

export async function readProject(cwd: string, name: string): Promise<ProjectDocument> {
  await requireWorkspace(cwd);
  const normalized = normalizeName(name);
  const filePath = projectFilePath(cwd, normalized);

  try {
    const raw = await readTextFile(filePath);
    return parseMarkdownWithFrontmatter(raw, projectFrontmatterSchema, filePath);
  } catch (error) {
    if (error instanceof BriefOpsError && error.message.startsWith("File not found")) {
      throw new BriefOpsError(`Project not found: ${normalized}`);
    }

    throw error;
  }
}

export async function showProject(cwd: string, name: string): Promise<string> {
  await requireWorkspace(cwd);
  const normalized = normalizeName(name);

  try {
    return await readTextFile(projectFilePath(cwd, normalized));
  } catch (error) {
    if (error instanceof BriefOpsError && error.message.startsWith("File not found")) {
      throw new BriefOpsError(`Project not found: ${normalized}`);
    }

    throw error;
  }
}

export async function listProjects(cwd = process.cwd()): Promise<ProjectDocument[]> {
  await requireWorkspace(cwd);
  const files = await listFilesBySuffix(workspacePaths(cwd).projects, ".project.md");

  return Promise.all(
    files.map(async (filePath) => {
      const raw = await readTextFile(filePath);
      return parseMarkdownWithFrontmatter(raw, projectFrontmatterSchema, filePath);
    })
  );
}
