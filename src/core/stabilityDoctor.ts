import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { readBriefOpsConfig, type BriefOpsConfig } from "./config.js";
import { BriefOpsError } from "./errors.js";
import { listFilesBySuffix, parseMarkdownWithFrontmatter, pathExists, readTextFile } from "./storage.js";
import { workspacePaths, memoryCategories, memoryFilePath } from "./paths.js";
import { memoryFileSchema, type MemoryItem } from "../schemas/memory.js";
import { memoryProposalSchema } from "../schemas/memoryProposal.js";
import { projectFrontmatterSchema } from "../schemas/project.js";
import { skillFrontmatterSchema } from "../schemas/skill.js";
import { workLogSchema } from "../schemas/log.js";
import { skillPatchSchema } from "../schemas/patch.js";
import { workerProfileSchema, type WorkerProfile } from "../schemas/worker.js";

export type StabilityDoctorStatus = "ok" | "warn" | "fail";

export type StabilityDoctorCheck = {
  name: string;
  status: StabilityDoctorStatus;
  detail: string;
};

export type StabilityDoctorResult = {
  ok: boolean;
  checks: StabilityDoctorCheck[];
};

type ParsedWorkspace = {
  projects: Set<string>;
  skills: Set<string>;
  workers: Map<string, WorkerProfile>;
  logs: Set<string>;
  memory: MemoryItem[];
};

function check(
  name: string,
  status: StabilityDoctorStatus,
  detail: string
): StabilityDoctorCheck {
  return { name, status, detail };
}

function relative(cwd: string, filePath: string): string {
  const rel = path.relative(cwd, filePath);
  return rel.startsWith("..") ? filePath : rel || ".";
}

function summarize(items: string[], empty: string, maxExamples: number): string {
  if (items.length === 0) {
    return empty;
  }

  const shown = items.slice(0, maxExamples);
  const suffix = items.length > shown.length ? `; ${items.length - shown.length} more` : "";
  return `${items.length}: ${shown.join("; ")}${suffix}`;
}

async function safeReadYaml(filePath: string): Promise<unknown> {
  return YAML.parse(await readTextFile(filePath)) ?? {};
}

async function validateRequiredPaths(cwd: string): Promise<string[]> {
  const paths = workspacePaths(cwd);
  const required = [
    paths.root,
    paths.config,
    paths.skills,
    paths.projects,
    paths.memory,
    paths.memoryProposals,
    paths.workers,
    paths.workerSummaries,
    paths.logs,
    paths.handoffs,
    paths.briefs,
    paths.codex,
    paths.codexPrompts,
    paths.evals,
    paths.evalResults,
    paths.patches,
    paths.templates
  ];
  const missing: string[] = [];

  for (const filePath of required) {
    if (!(await pathExists(filePath))) {
      missing.push(relative(cwd, filePath));
    }
  }

  return missing;
}

async function validateManagedSymlinks(cwd: string): Promise<string[]> {
  const paths = workspacePaths(cwd);
  const managed = [
    paths.root,
    paths.skills,
    paths.projects,
    paths.memory,
    paths.memoryProposals,
    paths.workers,
    paths.workerSummaries,
    paths.logs,
    paths.handoffs,
    paths.briefs,
    paths.codex,
    paths.codexPrompts,
    paths.evals,
    paths.evalResults,
    paths.patches,
    paths.templates
  ];
  const symlinks: string[] = [];

  for (const filePath of managed) {
    try {
      if ((await fs.lstat(filePath)).isSymbolicLink()) {
        symlinks.push(relative(cwd, filePath));
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return symlinks;
}

async function validateProjectFiles(cwd: string, maxExamples: number): Promise<{
  check: StabilityDoctorCheck;
  projects: Set<string>;
}> {
  const files = await listFilesBySuffix(workspacePaths(cwd).projects, ".project.md");
  const invalid: string[] = [];
  const projects = new Set<string>();

  for (const filePath of files) {
    try {
      const parsed = parseMarkdownWithFrontmatter(
        await readTextFile(filePath),
        projectFrontmatterSchema,
        filePath
      );
      projects.add(parsed.data.name);
    } catch (error) {
      invalid.push(`${relative(cwd, filePath)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    check: invalid.length === 0
      ? check("Project files", "ok", `${files.length} project file(s) valid.`)
      : check("Project files", "fail", summarize(invalid, "No invalid project files.", maxExamples)),
    projects
  };
}

async function validateSkillFiles(cwd: string, maxExamples: number): Promise<{
  check: StabilityDoctorCheck;
  skills: Set<string>;
}> {
  const files = await listFilesBySuffix(workspacePaths(cwd).skills, ".skill.md");
  const invalid: string[] = [];
  const skills = new Set<string>();

  for (const filePath of files) {
    try {
      const parsed = parseMarkdownWithFrontmatter(
        await readTextFile(filePath),
        skillFrontmatterSchema,
        filePath
      );
      skills.add(parsed.data.name);
    } catch (error) {
      invalid.push(`${relative(cwd, filePath)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    check: invalid.length === 0
      ? check("Skill files", "ok", `${files.length} skill file(s) valid.`)
      : check("Skill files", "fail", summarize(invalid, "No invalid skill files.", maxExamples)),
    skills
  };
}

async function validateWorkerFiles(cwd: string, maxExamples: number): Promise<{
  check: StabilityDoctorCheck;
  workers: Map<string, WorkerProfile>;
}> {
  const files = await listFilesBySuffix(workspacePaths(cwd).workers, ".worker.yaml");
  const invalid: string[] = [];
  const workers = new Map<string, WorkerProfile>();

  for (const filePath of files) {
    try {
      const result = workerProfileSchema.safeParse(await safeReadYaml(filePath));
      if (!result.success) {
        throw new BriefOpsError(result.error.message);
      }
      workers.set(result.data.name, result.data);
    } catch (error) {
      invalid.push(`${relative(cwd, filePath)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    check: invalid.length === 0
      ? check("Worker files", "ok", `${files.length} worker file(s) valid.`)
      : check("Worker files", "fail", summarize(invalid, "No invalid worker files.", maxExamples)),
    workers
  };
}

async function validateLogFiles(cwd: string, maxExamples: number): Promise<{
  check: StabilityDoctorCheck;
  logs: Set<string>;
}> {
  const files = await listFilesBySuffix(workspacePaths(cwd).logs, ".yaml");
  const invalid: string[] = [];
  const logs = new Set<string>();

  for (const filePath of files) {
    try {
      const result = workLogSchema.safeParse(await safeReadYaml(filePath));
      if (!result.success) {
        throw new BriefOpsError(result.error.message);
      }
      logs.add(result.data.id);
    } catch (error) {
      invalid.push(`${relative(cwd, filePath)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    check: invalid.length === 0
      ? check("Work logs", "ok", `${files.length} work log file(s) valid.`)
      : check("Work logs", "fail", summarize(invalid, "No invalid work logs.", maxExamples)),
    logs
  };
}

async function validateMemoryFiles(cwd: string, maxExamples: number): Promise<{
  check: StabilityDoctorCheck;
  memory: MemoryItem[];
}> {
  const invalid: string[] = [];
  const memory: MemoryItem[] = [];

  for (const category of memoryCategories) {
    const filePath = memoryFilePath(cwd, category);
    try {
      const result = memoryFileSchema.safeParse(await safeReadYaml(filePath));
      if (!result.success) {
        throw new BriefOpsError(result.error.message);
      }
      memory.push(...result.data.items);
    } catch (error) {
      invalid.push(`${relative(cwd, filePath)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    check: invalid.length === 0
      ? check("Memory files", "ok", `${memory.length} memory item(s) valid.`)
      : check("Memory files", "fail", summarize(invalid, "No invalid memory files.", maxExamples)),
    memory
  };
}

async function validateProposalFiles(cwd: string, logs: Set<string>, maxExamples: number): Promise<{
  check: StabilityDoctorCheck;
  orphaned: string[];
}> {
  const files = await listFilesBySuffix(workspacePaths(cwd).memoryProposals, ".memory-proposal.yaml");
  const invalid: string[] = [];
  const orphaned: string[] = [];

  for (const filePath of files) {
    try {
      const result = memoryProposalSchema.safeParse(await safeReadYaml(filePath));
      if (!result.success) {
        throw new BriefOpsError(result.error.message);
      }
      if (!logs.has(result.data.from_log)) {
        orphaned.push(`${result.data.id} -> log ${result.data.from_log}`);
      }
    } catch (error) {
      invalid.push(`${relative(cwd, filePath)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    check: invalid.length === 0
      ? check("Memory proposals", "ok", `${files.length} memory proposal file(s) valid.`)
      : check("Memory proposals", "fail", summarize(invalid, "No invalid memory proposals.", maxExamples)),
    orphaned
  };
}

async function validatePatchFiles(cwd: string, logs: Set<string>, maxExamples: number): Promise<{
  check: StabilityDoctorCheck;
  orphaned: string[];
}> {
  const files = await listFilesBySuffix(workspacePaths(cwd).patches, ".patch.yaml");
  const invalid: string[] = [];
  const orphaned: string[] = [];

  for (const filePath of files) {
    try {
      const result = skillPatchSchema.safeParse(await safeReadYaml(filePath));
      if (!result.success) {
        throw new BriefOpsError(result.error.message);
      }
      if (!logs.has(result.data.from_log)) {
        orphaned.push(`${result.data.id} -> log ${result.data.from_log}`);
      }
    } catch (error) {
      invalid.push(`${relative(cwd, filePath)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    check: invalid.length === 0
      ? check("Skill patches", "ok", `${files.length} skill patch file(s) valid.`)
      : check("Skill patches", "fail", summarize(invalid, "No invalid skill patches.", maxExamples)),
    orphaned
  };
}

function duplicateMemoryIds(memory: MemoryItem[]): string[] {
  const counts = new Map<string, number>();
  for (const item of memory) {
    counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => `${id} (${count})`)
    .sort();
}

function referenceCheck(options: {
  config?: BriefOpsConfig;
  workspace: ParsedWorkspace;
  maxExamples: number;
}): StabilityDoctorCheck {
  const broken: string[] = [];
  const { config, workspace } = options;

  if (config?.defaults.project && !workspace.projects.has(config.defaults.project)) {
    broken.push(`default project -> ${config.defaults.project}`);
  }
  if (config?.defaults.worker && !workspace.workers.has(config.defaults.worker)) {
    broken.push(`default worker -> ${config.defaults.worker}`);
  }

  for (const worker of workspace.workers.values()) {
    if (worker.project && !workspace.projects.has(worker.project)) {
      broken.push(`worker ${worker.name} -> project ${worker.project}`);
    }
    for (const skill of worker.default_skills) {
      if (!workspace.skills.has(skill)) {
        broken.push(`worker ${worker.name} -> skill ${skill}`);
      }
    }
  }

  for (const item of workspace.memory) {
    if (item.project && !workspace.projects.has(item.project)) {
      broken.push(`memory ${item.id} -> project ${item.project}`);
    }
    if (item.skill && !workspace.skills.has(item.skill)) {
      broken.push(`memory ${item.id} -> skill ${item.skill}`);
    }
  }

  return broken.length === 0
    ? check("References", "ok", "No broken project, skill, worker, or memory references.")
    : check("References", "fail", summarize(broken, "No broken references.", options.maxExamples));
}

export async function runStabilityDoctor(options: {
  cwd?: string;
  maxExamples?: number;
} = {}): Promise<StabilityDoctorResult> {
  const cwd = options.cwd ?? process.cwd();
  const maxExamples = options.maxExamples ?? 5;
  const paths = workspacePaths(cwd);

  if (!(await pathExists(paths.root))) {
    return {
      ok: false,
      checks: [check("Workspace", "fail", ".briefops workspace not found.")]
    };
  }

  const checks: StabilityDoctorCheck[] = [
    check("Workspace", "ok", relative(cwd, paths.root))
  ];

  const missingPaths = await validateRequiredPaths(cwd);
  checks.push(
    missingPaths.length === 0
      ? check("Required paths", "ok", "All required workspace paths exist.")
      : check("Required paths", "fail", summarize(missingPaths, "No missing paths.", maxExamples))
  );

  const symlinks = await validateManagedSymlinks(cwd);
  checks.push(
    symlinks.length === 0
      ? check("Managed symlinks", "ok", "No managed workspace paths are symlinks.")
      : check("Managed symlinks", "fail", summarize(symlinks, "No managed symlinks.", maxExamples))
  );

  let config: BriefOpsConfig | undefined;
  try {
    config = await readBriefOpsConfig(cwd);
    checks.push(check("Config", "ok", `Schema ${config.version}.`));
  } catch (error) {
    checks.push(check("Config", "fail", error instanceof Error ? error.message : String(error)));
  }

  const projects = await validateProjectFiles(cwd, maxExamples);
  const skills = await validateSkillFiles(cwd, maxExamples);
  const workers = await validateWorkerFiles(cwd, maxExamples);
  const logs = await validateLogFiles(cwd, maxExamples);
  const memory = await validateMemoryFiles(cwd, maxExamples);
  checks.push(projects.check, skills.check, workers.check, logs.check, memory.check);

  const workspace: ParsedWorkspace = {
    projects: projects.projects,
    skills: skills.skills,
    workers: workers.workers,
    logs: logs.logs,
    memory: memory.memory
  };
  const duplicateIds = duplicateMemoryIds(memory.memory);
  checks.push(
    duplicateIds.length === 0
      ? check("Memory ids", "ok", "No duplicate memory ids.")
      : check("Memory ids", "fail", summarize(duplicateIds, "No duplicate memory ids.", maxExamples))
  );
  checks.push(referenceCheck({ config, workspace, maxExamples }));

  const proposals = await validateProposalFiles(cwd, workspace.logs, maxExamples);
  const patches = await validatePatchFiles(cwd, workspace.logs, maxExamples);
  checks.push(proposals.check, patches.check);

  const orphaned = [...proposals.orphaned, ...patches.orphaned].sort();
  checks.push(
    orphaned.length === 0
      ? check("Review artifacts", "ok", "No proposal or patch points at a missing work log.")
      : check("Review artifacts", "warn", summarize(orphaned, "No orphaned review artifacts.", maxExamples))
  );

  return {
    ok: checks.every((item) => item.status !== "fail"),
    checks
  };
}
