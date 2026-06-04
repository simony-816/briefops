import { randomBytes } from "node:crypto";
import path from "node:path";
import { BriefOpsError } from "./errors.js";
import { generateBrief } from "./brief.js";
import { evalCaseFilePath, normalizeName, workspacePaths } from "./paths.js";
import {
  listFilesBySuffix,
  readTextFile,
  writeYamlFile
} from "./storage.js";
import { requireWorkspace } from "./workspace.js";
import { evalCaseSchema, evalResultSchema, type EvalCase, type EvalResult } from "../schemas/eval.js";
import YAML from "yaml";

export type CreateEvalCaseOptions = {
  cwd?: string;
  name: string;
  skill?: string;
  project?: string;
  worker?: string;
  description?: string;
  input?: string;
  expected?: string[];
  passThreshold?: number;
  force?: boolean;
};

export type RunEvalOptions = {
  cwd?: string;
  skill?: string;
  project?: string;
  worker?: string;
  budget?: number;
  adapter?: string;
};

export type EvalRunSummary = {
  cases: Array<{
    case: EvalCase;
    result: EvalResult;
  }>;
  passed: number;
  failed: number;
  resultPath: string;
};

function resultId(date = new Date()): string {
  return `eval_${date.toISOString().replace(/[-:.TZ]/g, "").slice(0, 17)}_${randomBytes(3).toString(
    "hex"
  )}`;
}

async function writeEvalCase(cwd: string, evalCase: EvalCase, force = false): Promise<string> {
  const filePath = evalCaseFilePath(cwd, evalCase.id);
  if (!force) {
    try {
      await readTextFile(filePath);
      throw new BriefOpsError(`File already exists: ${filePath}`);
    } catch (error) {
      if (error instanceof BriefOpsError && error.message.startsWith("File not found")) {
        await writeYamlFile(filePath, evalCase);
        return filePath;
      }

      throw error;
    }
  }

  await writeYamlFile(filePath, evalCase);
  return filePath;
}

export async function createEvalCase(
  options: CreateEvalCaseOptions
): Promise<{ path: string; evalCase: EvalCase }> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const expected = options.expected?.map((item) => item.trim()).filter(Boolean) ?? [];
  const evalCase = evalCaseSchema.parse({
    id: normalizeName(options.name),
    skill: options.skill ? normalizeName(options.skill) : undefined,
    project: options.project ? normalizeName(options.project) : undefined,
    worker: options.worker ? normalizeName(options.worker) : undefined,
    description: options.description ?? "",
    input: options.input ?? options.description ?? "",
    expected,
    scoring: {
      type: "checklist",
      pass_threshold: options.passThreshold ?? Math.max(1, expected.length)
    }
  });
  const filePath = await writeEvalCase(cwd, evalCase, Boolean(options.force));

  return { path: filePath, evalCase };
}

export async function readEvalCase(cwd: string, id: string): Promise<EvalCase> {
  await requireWorkspace(cwd);
  const filePath = evalCaseFilePath(cwd, id);

  try {
    const raw = await readTextFile(filePath);
    const parsed = YAML.parse(raw);
    const result = evalCaseSchema.safeParse(parsed);
    if (!result.success) {
      throw new BriefOpsError(`Invalid eval case ${filePath}: ${result.error.message}`);
    }
    return result.data;
  } catch (error) {
    if (error instanceof BriefOpsError && error.message.startsWith("File not found")) {
      throw new BriefOpsError(`Eval case not found: ${id}`);
    }

    throw error;
  }
}

export async function listEvalCases(cwd = process.cwd()): Promise<EvalCase[]> {
  await requireWorkspace(cwd);
  const files = await listFilesBySuffix(workspacePaths(cwd).evals, ".eval.yaml");
  const cases = await Promise.all(
    files.map(async (filePath) => {
      const raw = await readTextFile(filePath);
      const parsed = YAML.parse(raw);
      const result = evalCaseSchema.safeParse(parsed);
      if (!result.success) {
        throw new BriefOpsError(`Invalid eval case ${filePath}: ${result.error.message}`);
      }
      return result.data;
    })
  );

  return cases.sort((a, b) => a.id.localeCompare(b.id));
}

function matchesCase(evalCase: EvalCase, filters: RunEvalOptions): boolean {
  const skill = filters.skill ? normalizeName(filters.skill) : undefined;
  const project = filters.project ? normalizeName(filters.project) : undefined;
  const worker = filters.worker ? normalizeName(filters.worker) : undefined;

  return (
    (skill ? (evalCase.skill ?? skill) === skill : true) &&
    (project ? (evalCase.project ?? project) === project : true) &&
    (worker ? (evalCase.worker ?? worker) === worker : true)
  );
}

function scoreChecklist(content: string, expected: string[]): { matched: string[]; missing: string[] } {
  const haystack = content.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const item of expected) {
    if (haystack.includes(item.toLowerCase())) {
      matched.push(item);
    } else {
      missing.push(item);
    }
  }

  return { matched, missing };
}

export async function runEval(options: RunEvalOptions = {}): Promise<EvalRunSummary> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const cases = (await listEvalCases(cwd)).filter((evalCase) => matchesCase(evalCase, options));

  if (cases.length === 0) {
    throw new BriefOpsError("No eval cases matched the requested filters.");
  }

  const results: EvalRunSummary["cases"] = [];
  for (const evalCase of cases) {
    const skill = options.skill ?? evalCase.skill;
    const project = options.project ?? evalCase.project;
    const worker = options.worker ?? evalCase.worker;
    if (!worker && (!skill || !project)) {
      throw new BriefOpsError(
        `Eval case ${evalCase.id} needs either a worker or both skill and project.`
      );
    }

    const generated = await generateBrief({
      cwd,
      skill,
      project,
      worker,
      task: evalCase.input || evalCase.description,
      budget: options.budget ?? 2000,
      adapter: options.adapter
    });
    const scored = scoreChecklist(generated.content, evalCase.expected);
    const passThreshold =
      evalCase.scoring.pass_threshold ?? Math.max(1, evalCase.expected.length);
    const result = evalResultSchema.parse({
      id: resultId(),
      created_at: new Date().toISOString(),
      case_id: evalCase.id,
      skill,
      project,
      worker,
      passed: scored.matched.length >= passThreshold,
      score: scored.matched.length,
      pass_threshold: passThreshold,
      matched: scored.matched,
      missing: scored.missing,
      brief_tokens: generated.totalTokens
    });

    results.push({ case: evalCase, result });
  }

  const resultPath = path.join(workspacePaths(cwd).evalResults, `${resultId()}.yaml`);
  await writeYamlFile(
    resultPath,
    results.map((item) => item.result)
  );

  const passed = results.filter((item) => item.result.passed).length;
  return {
    cases: results,
    passed,
    failed: results.length - passed,
    resultPath
  };
}

export async function showEval(cwd: string, id: string): Promise<string> {
  await requireWorkspace(cwd);
  const casePath = evalCaseFilePath(cwd, id);
  try {
    return await readTextFile(casePath);
  } catch (error) {
    if (!(error instanceof BriefOpsError && error.message.startsWith("File not found"))) {
      throw error;
    }
  }

  const resultPath = path.join(workspacePaths(cwd).evalResults, `${normalizeName(id)}.yaml`);
  try {
    return await readTextFile(resultPath);
  } catch (error) {
    if (error instanceof BriefOpsError && error.message.startsWith("File not found")) {
      throw new BriefOpsError(`Eval case or result not found: ${id}`);
    }

    throw error;
  }
}
