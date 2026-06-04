import path from "node:path";
import { BriefOpsError } from "./errors.js";

export const memoryCategories = [
  "facts",
  "decisions",
  "lessons",
  "incidents",
  "deprecated"
] as const;

export type MemoryCategory = (typeof memoryCategories)[number];

export function normalizeName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, "-");
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(normalized)) {
    throw new BriefOpsError(
      `Invalid name: ${name}. Use letters, numbers, dots, underscores, or hyphens.`
    );
  }

  return normalized;
}

export function workspacePaths(cwd = process.cwd()) {
  const root = path.join(cwd, ".briefops");
  return {
    cwd,
    root,
    config: path.join(root, "config.yaml"),
    skills: path.join(root, "skills"),
    projects: path.join(root, "projects"),
    memory: path.join(root, "memory"),
    workers: path.join(root, "workers"),
    logs: path.join(root, "logs"),
    briefs: path.join(root, "briefs"),
    evals: path.join(root, "evals"),
    evalResults: path.join(root, "evals", "results"),
    patches: path.join(root, "patches"),
    templates: path.join(root, "templates")
  };
}

export function skillFilePath(cwd: string, name: string): string {
  return path.join(workspacePaths(cwd).skills, `${normalizeName(name)}.skill.md`);
}

export function projectFilePath(cwd: string, name: string): string {
  return path.join(workspacePaths(cwd).projects, `${normalizeName(name)}.project.md`);
}

export function memoryFilePath(cwd: string, category: MemoryCategory): string {
  return path.join(workspacePaths(cwd).memory, `${category}.yaml`);
}

export function workerFilePath(cwd: string, name: string): string {
  return path.join(workspacePaths(cwd).workers, `${normalizeName(name)}.worker.yaml`);
}

export function evalCaseFilePath(cwd: string, name: string): string {
  return path.join(workspacePaths(cwd).evals, `${normalizeName(name)}.eval.yaml`);
}

export function skillPatchFilePath(cwd: string, id: string): string {
  return path.join(workspacePaths(cwd).patches, `${normalizeName(id)}.patch.yaml`);
}

export function formatDateStamp(date = new Date()): string {
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "_",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    "_",
    pad(date.getUTCMilliseconds(), 3)
  ].join("");
}

export function slugForFilename(value: string): string {
  return normalizeName(value)
    .replace(/[._]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
