import path from "node:path";
import {
  normalizeBriefAdapter,
  renderBriefWithAdapter,
  type BriefAdapter
} from "./adapter.js";
import { BriefOpsError } from "./errors.js";
import { formatMemoryItem, selectRelevantMemory } from "./memory.js";
import { readProject } from "./project.js";
import { readSkill } from "./skill.js";
import { formatWorkerForBrief, readWorker } from "./worker.js";
import { formatDateStamp, normalizeName, slugForFilename, workspacePaths } from "./paths.js";
import { estimateTokens, truncateToTokenBudget } from "./tokens.js";
import { listFilesBySuffix, readTextFile, writeTextFile } from "./storage.js";
import { requireWorkspace } from "./workspace.js";
import type { GeneratedBrief, TokenReportLine } from "../schemas/brief.js";
import type { MemoryItem } from "../schemas/memory.js";

const DEFAULT_MEMORY_BUDGET = 300;
const TASK_BUDGET_FLOOR = 100;
const OUTPUT_CONTRACT_BUDGET = 200;
const MIN_SKILL_BUDGET = 80;

const outputContract = [
  "Return:",
  "",
  "1. Summary",
  "2. Findings or implementation notes",
  "3. Files changed",
  "4. Verification performed",
  "5. Remaining risks or follow-ups"
].join("\n");

export type GenerateBriefOptions = {
  cwd?: string;
  skill?: string;
  project?: string;
  worker?: string;
  task: string;
  budget?: number;
  adapter?: string;
};

type ResolvedBriefOptions = {
  cwd: string;
  skills: string[];
  project: string;
  worker?: string;
  task: string;
  budget: number;
  adapter: BriefAdapter;
};

type BuildState = {
  skillBudget: number;
  projectBudget: number;
  memoryBudget: number;
  workerBudget: number;
};

type BuiltBriefParts = {
  skillText: string;
  projectText: string;
  memoryText: string;
  workerText: string;
  taskText: string;
  readIfNeeded: string;
  report: TokenReportLine[];
  totalTokens: number;
  warnings: string[];
  memoryOmitted: number;
};

function extractReadIfNeeded(projectBody: string): string {
  const lines = projectBody.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+read if needed\s*$/i.test(line.trim()));
  if (start === -1) {
    return "";
  }

  const section: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line.trim())) {
      break;
    }
    section.push(line);
  }

  return section.join("\n").trim();
}

function stripReadIfNeeded(projectBody: string): string {
  const lines = projectBody.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+read if needed\s*$/i.test(line.trim()));
  if (start === -1) {
    return projectBody;
  }

  const endOffset = lines
    .slice(start + 1)
    .findIndex((line) => /^##\s+/.test(line.trim()));
  const end = endOffset === -1 ? lines.length : start + 1 + endOffset;

  return [...lines.slice(0, start), ...lines.slice(end)].join("\n").trim();
}

async function resolveBriefOptions(input: GenerateBriefOptions): Promise<ResolvedBriefOptions> {
  const cwd = input.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const workerName = input.worker ? normalizeName(input.worker) : undefined;
  const worker = workerName ? await readWorker(cwd, workerName) : undefined;
  const project = input.project
    ? normalizeName(input.project)
    : worker?.project
      ? normalizeName(worker.project)
      : undefined;
  const skills = input.skill
    ? [normalizeName(input.skill)]
    : worker?.default_skills.map(normalizeName) ?? [];

  if (!project) {
    throw new BriefOpsError("Brief generation requires --project or a worker with a default project.");
  }

  if (skills.length === 0) {
    throw new BriefOpsError("Brief generation requires --skill or a worker with default skills.");
  }

  return {
    cwd,
    skills,
    project,
    worker: workerName,
    task: input.task,
    budget: input.budget ?? 2000,
    adapter: normalizeBriefAdapter(input.adapter)
  };
}

async function selectMemoryForSkills(options: {
  cwd: string;
  project: string;
  skills: string[];
  maxTokens: number;
}): Promise<{ items: MemoryItem[]; text: string; tokens: number; omitted: number }> {
  const selections = await Promise.all(
    options.skills.map((skill) =>
      selectRelevantMemory({
        cwd: options.cwd,
        project: options.project,
        skill,
        maxTokens: options.maxTokens
      })
    )
  );
  const seen = new Set<string>();
  const ordered = selections
    .flatMap((selection) => selection.items)
    .filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const selected: MemoryItem[] = [];
  let tokens = 0;

  for (const item of ordered) {
    const itemTokens = estimateTokens(formatMemoryItem(item));
    if (tokens + itemTokens > options.maxTokens) {
      continue;
    }

    selected.push(item);
    tokens += itemTokens;
  }

  const originalOmitted = selections.reduce((sum, selection) => sum + selection.omitted, 0);
  return {
    items: selected,
    text: selected.map(formatMemoryItem).join("\n"),
    tokens,
    omitted: originalOmitted + ordered.length - selected.length
  };
}

async function buildSkillText(options: ResolvedBriefOptions, skillBudget: number): Promise<{
  text: string;
  used: number;
  budget: number;
  trimmed: boolean;
}> {
  const skills = await Promise.all(options.skills.map((skill) => readSkill(options.cwd, skill)));
  const perSkillBudget = Math.max(MIN_SKILL_BUDGET, Math.floor(skillBudget / skills.length));
  const rendered = skills.map((skill) => {
    const budget = Math.min(skill.data.max_tokens, perSkillBudget);
    const result = truncateToTokenBudget(skill.body, budget);
    const header = options.skills.length > 1 ? `### ${skill.data.name}\n\n` : "";
    return {
      text: `${header}${result.text || "Skill content unavailable after trimming."}`,
      used: estimateTokens(result.text),
      budget,
      trimmed: result.trimmed
    };
  });

  return {
    text: rendered.map((item) => item.text).join("\n\n"),
    used: rendered.reduce((sum, item) => sum + item.used, 0),
    budget: rendered.reduce((sum, item) => sum + item.budget, 0),
    trimmed: rendered.some((item) => item.trimmed)
  };
}

async function buildParts(
  options: ResolvedBriefOptions,
  state: BuildState
): Promise<BuiltBriefParts> {
  const project = await readProject(options.cwd, options.project);
  const skillResult = await buildSkillText(options, state.skillBudget);
  const projectResult = truncateToTokenBudget(
    stripReadIfNeeded(project.body),
    state.projectBudget
  );
  const memory = await selectMemoryForSkills({
    cwd: options.cwd,
    project: options.project,
    skills: options.skills,
    maxTokens: state.memoryBudget
  });
  const workerResult = options.worker
    ? truncateToTokenBudget(await formatWorkerForBrief(options.cwd, options.worker), state.workerBudget)
    : { text: "", trimmed: false };
  const taskText = options.task.trim();
  const outputTokens = estimateTokens(outputContract);
  const taskBudget = Math.max(TASK_BUDGET_FLOOR, estimateTokens(taskText));
  const report = [
    options.worker
      ? {
          label: "Worker",
          used: estimateTokens(workerResult.text),
          budget: state.workerBudget
        }
      : undefined,
    {
      label: options.skills.length > 1 ? "Skills" : "Skill",
      used: skillResult.used,
      budget: skillResult.budget
    },
    {
      label: "Project Context",
      used: estimateTokens(projectResult.text),
      budget: state.projectBudget
    },
    {
      label: "Memory",
      used: memory.tokens,
      budget: state.memoryBudget
    },
    {
      label: "Task",
      used: estimateTokens(taskText),
      budget: taskBudget
    },
    {
      label: "Output Contract",
      used: outputTokens,
      budget: OUTPUT_CONTRACT_BUDGET
    }
  ].filter((line): line is TokenReportLine => Boolean(line));
  const totalTokens = report.reduce((sum, line) => sum + line.used, 0);
  const warnings = [
    workerResult.trimmed ? "Worker profile was trimmed to fit its component budget." : undefined,
    skillResult.trimmed ? "Skill content was trimmed to fit its component budget." : undefined,
    projectResult.trimmed ? "Project context was trimmed to fit its component budget." : undefined,
    memory.omitted > 0 ? `${memory.omitted} matching memory item(s) were omitted by token budget.` : undefined
  ].filter((warning): warning is string => Boolean(warning));

  return {
    skillText: skillResult.text || "Skill content unavailable after trimming.",
    projectText: projectResult.text || "Project context omitted to fit token budget.",
    memoryText: memory.text || "No active matching memory items included.",
    workerText: workerResult.text,
    taskText,
    readIfNeeded: extractReadIfNeeded(project.body) || "No project source references listed.",
    report,
    totalTokens,
    warnings,
    memoryOmitted: memory.omitted
  };
}

export async function generateBrief(input: GenerateBriefOptions): Promise<GeneratedBrief> {
  const options = await resolveBriefOptions(input);
  const skills = await Promise.all(options.skills.map((skill) => readSkill(options.cwd, skill)));
  const project = await readProject(options.cwd, options.project);
  const worker = options.worker ? await readWorker(options.cwd, options.worker) : undefined;
  const state = {
    skillBudget: skills.reduce((sum, skill) => sum + skill.data.max_tokens, 0),
    projectBudget: project.data.max_tokens,
    memoryBudget: DEFAULT_MEMORY_BUDGET,
    workerBudget: worker?.max_tokens ?? 0
  };

  let parts = await buildParts(options, state);
  if (parts.totalTokens > options.budget) {
    const overage = parts.totalTokens - options.budget;
    state.memoryBudget = Math.max(0, state.memoryBudget - overage);
    parts = await buildParts(options, state);
  }

  if (parts.totalTokens > options.budget && state.memoryBudget > 0) {
    state.memoryBudget = 0;
    parts = await buildParts(options, state);
  }

  if (parts.totalTokens > options.budget && state.workerBudget > 0) {
    const overage = parts.totalTokens - options.budget;
    state.workerBudget = Math.max(0, state.workerBudget - overage);
    parts = await buildParts(options, state);
  }

  if (parts.totalTokens > options.budget) {
    const overage = parts.totalTokens - options.budget;
    state.projectBudget = Math.max(0, state.projectBudget - overage);
    parts = await buildParts(options, state);
  }

  if (parts.totalTokens > options.budget) {
    const overage = parts.totalTokens - options.budget;
    const minimumSkillBudget = Math.min(MIN_SKILL_BUDGET, state.skillBudget);
    state.skillBudget = Math.max(minimumSkillBudget, state.skillBudget - overage);
    parts = await buildParts(options, state);
  }

  if (parts.totalTokens > options.budget) {
    parts.warnings.push(
      `Brief exceeds token budget by ${parts.totalTokens - options.budget} estimated tokens.`
    );
  }

  return {
    content: await renderBriefWithAdapter({
      cwd: options.cwd,
      adapter: options.adapter,
      parts: {
        warnings: parts.warnings,
        workerText: parts.workerText,
        skillText: parts.skillText,
        projectText: parts.projectText,
        memoryText: parts.memoryText,
        taskText: parts.taskText,
        outputContract,
        readIfNeeded: parts.readIfNeeded,
        report: parts.report,
        totalTokens: parts.totalTokens,
        budget: options.budget
      }
    }),
    warnings: parts.warnings,
    report: parts.report,
    totalTokens: parts.totalTokens,
    budget: options.budget
  };
}

export async function saveGeneratedBrief(options: {
  cwd: string;
  generated: GeneratedBrief;
  project?: string;
  skill?: string;
  worker?: string;
  outputPath?: string;
}): Promise<string> {
  const targetPath =
    options.outputPath ??
    path.join(
      workspacePaths(options.cwd).briefs,
      `${formatDateStamp()}-${slugForFilename(options.project ?? "global")}-${slugForFilename(
        options.worker ?? options.skill ?? "brief"
      )}.md`
    );
  await writeTextFile(targetPath, options.generated.content, { force: true });
  return targetPath;
}

export async function inspectBriefTokens(input: GenerateBriefOptions): Promise<{
  skillName: string;
  skillTokens: number;
  projectName: string;
  projectTokens: number;
  workerName?: string;
  workerTokens: number;
  memoryCount: number;
  memoryTokens: number;
  taskTokens: number;
  totalTokens: number;
  budget: number;
}> {
  const options = await resolveBriefOptions(input);
  const skills = await Promise.all(options.skills.map((skill) => readSkill(options.cwd, skill)));
  const project = await readProject(options.cwd, options.project);
  const memory = await selectMemoryForSkills({
    cwd: options.cwd,
    project: options.project,
    skills: options.skills,
    maxTokens: DEFAULT_MEMORY_BUDGET
  });
  const workerTokens = options.worker
    ? estimateTokens(await formatWorkerForBrief(options.cwd, options.worker))
    : 0;
  const skillTokens = skills.reduce((sum, skill) => sum + estimateTokens(skill.body), 0);
  const projectTokens = estimateTokens(project.body);
  const taskTokens = estimateTokens(input.task.trim());
  const totalTokens =
    workerTokens + skillTokens + projectTokens + memory.tokens + taskTokens + estimateTokens(outputContract);

  return {
    skillName: options.skills.join(","),
    skillTokens,
    projectName: options.project,
    projectTokens,
    workerName: options.worker,
    workerTokens,
    memoryCount: memory.items.length,
    memoryTokens: memory.tokens,
    taskTokens,
    totalTokens,
    budget: options.budget
  };
}

function briefIdFromPath(filePath: string): string {
  return path.basename(filePath, ".md");
}

async function resolveSavedBriefPath(cwd: string, idOrLatest: string): Promise<string> {
  await requireWorkspace(cwd);
  const files = await listFilesBySuffix(workspacePaths(cwd).briefs, ".md");
  if (files.length === 0) {
    throw new BriefOpsError("No saved briefs found.");
  }

  if (idOrLatest.trim().toLowerCase() === "latest") {
    return [...files].sort().at(-1) as string;
  }

  const id = path.basename(idOrLatest, ".md");
  const match = files.find((filePath) => briefIdFromPath(filePath) === id);
  if (!match) {
    throw new BriefOpsError(`Saved brief not found: ${idOrLatest}`);
  }

  return match;
}

export async function listSavedBriefs(cwd = process.cwd()): Promise<Array<{
  id: string;
  path: string;
  tokens: number;
}>> {
  await requireWorkspace(cwd);
  const files = await listFilesBySuffix(workspacePaths(cwd).briefs, ".md");
  const briefs = await Promise.all(
    files.map(async (filePath) => {
      const content = await readTextFile(filePath);
      return {
        id: briefIdFromPath(filePath),
        path: filePath,
        tokens: estimateTokens(content)
      };
    })
  );

  return briefs.sort((a, b) => b.id.localeCompare(a.id));
}

export async function showSavedBrief(cwd: string, idOrLatest: string): Promise<string> {
  return readTextFile(await resolveSavedBriefPath(cwd, idOrLatest));
}

export async function inspectSavedBrief(cwd: string, idOrLatest: string): Promise<{
  id: string;
  path: string;
  tokens: number;
  characters: number;
}> {
  const filePath = await resolveSavedBriefPath(cwd, idOrLatest);
  const content = await readTextFile(filePath);

  return {
    id: briefIdFromPath(filePath),
    path: filePath,
    tokens: estimateTokens(content),
    characters: content.length
  };
}
