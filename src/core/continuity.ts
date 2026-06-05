import { listWorkLogs } from "./log.js";
import { listMemory } from "./memory.js";
import { memoryCategories, skillFilePath } from "./paths.js";
import { readProject } from "./project.js";
import { pathExists } from "./storage.js";
import { readWorker } from "./worker.js";

export type ContinuityReadiness = "PASS" | "WARN" | "FAIL";

export type ContinuityHealth = {
  project: string;
  worker: string;
  workspace: {
    project: boolean;
    worker: boolean;
    skills: boolean;
    missingSkills: string[];
  };
  memory: Record<string, number>;
  history: {
    workLogs: number;
    latestLog?: string;
    openRisks: number;
    nextSteps: number;
  };
  readiness: ContinuityReadiness;
  recommendedNextCommand: string;
};

export async function inspectContinuityHealth(options: {
  cwd?: string;
  project: string;
  worker: string;
}): Promise<ContinuityHealth> {
  const cwd = options.cwd ?? process.cwd();
  let projectOk = true;
  let workerOk = true;
  let workerProfile;

  try {
    await readProject(cwd, options.project);
  } catch {
    projectOk = false;
  }

  try {
    workerProfile = await readWorker(cwd, options.worker);
  } catch {
    workerOk = false;
  }

  const skills = workerProfile?.default_skills ?? [];
  const skillStatuses = await Promise.all(
    skills.map(async (skill) => [skill, await pathExists(skillFilePath(cwd, skill))] as const)
  );
  const missingSkills = skillStatuses.filter(([, ok]) => !ok).map(([skill]) => skill);
  const memoryEntries = await Promise.all(
    memoryCategories.map(async (category) => {
      const items = await listMemory({
        cwd,
        type: category,
        project: options.project,
        status: "active"
      });
      return [category, items.length] as const;
    })
  );
  const memory = Object.fromEntries(memoryEntries);
  const logs = await listWorkLogs({
    cwd,
    project: options.project,
    worker: options.worker,
    limit: Number.MAX_SAFE_INTEGER
  });
  const openRisks = logs.flatMap((log) => log.open_risks);
  const nextSteps = logs.flatMap((log) => log.next_steps);
  const fail = !projectOk || !workerOk || skills.length === 0;
  const warn = !fail && (
    missingSkills.length > 0 ||
    logs.length === 0 ||
    openRisks.length === 0 ||
    nextSteps.length === 0 ||
    (memory.lessons ?? 0) === 0
  );
  const readiness = fail ? "FAIL" : warn ? "WARN" : "PASS";
  const nextTask = nextSteps[0] ?? "<next task>";

  return {
    project: options.project,
    worker: options.worker,
    workspace: {
      project: projectOk,
      worker: workerOk,
      skills: skills.length > 0 && missingSkills.length === 0,
      missingSkills
    },
    memory,
    history: {
      workLogs: logs.length,
      latestLog: logs[0]?.created_at.slice(0, 10),
      openRisks: openRisks.length,
      nextSteps: nextSteps.length
    },
    readiness,
    recommendedNextCommand:
      `briefops handoff generate --project ${options.project} --worker ${options.worker} --task "${nextTask}" --save`
  };
}
