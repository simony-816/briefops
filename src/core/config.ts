import YAML from "yaml";
import { z } from "zod";
import { BriefOpsError } from "./errors.js";
import { memoryCategories, normalizeName, workspacePaths } from "./paths.js";
import { pathExists, readTextFile, writeYamlFile } from "./storage.js";
import { readWorker } from "./worker.js";
import { requireWorkspace } from "./workspace.js";

const defaultTokenBudgets = {
  prime: 800,
  resume: 3000
};

const rawConfigSchema = z.object({
  version: z.string().optional(),
  created_at: z.string().optional(),
  defaults: z.object({
    project: z.string().optional(),
    worker: z.string().optional()
  }).default({}),
  token_budgets: z.object({
    prime: z.number().int().positive().optional(),
    resume: z.number().int().positive().optional()
  }).default({}),
  memory_categories: z.array(z.string()).default([...memoryCategories])
}).passthrough();

export type BriefOpsConfig = {
  version: string;
  created_at?: string;
  defaults: {
    project?: string;
    worker?: string;
  };
  token_budgets: {
    prime: number;
    resume: number;
  };
  memory_categories: string[];
};

function normalizeConfig(raw: z.infer<typeof rawConfigSchema>): BriefOpsConfig {
  return {
    version: raw.version ?? "0.2.0",
    created_at: raw.created_at,
    defaults: {
      project: raw.defaults.project ? normalizeName(raw.defaults.project) : undefined,
      worker: raw.defaults.worker ? normalizeName(raw.defaults.worker) : undefined
    },
    token_budgets: {
      prime: raw.token_budgets.prime ?? defaultTokenBudgets.prime,
      resume: raw.token_budgets.resume ?? defaultTokenBudgets.resume
    },
    memory_categories:
      raw.memory_categories.length > 0 ? raw.memory_categories : [...memoryCategories]
  };
}

export async function readBriefOpsConfig(cwd = process.cwd()): Promise<BriefOpsConfig> {
  await requireWorkspace(cwd);
  const configPath = workspacePaths(cwd).config;
  if (!(await pathExists(configPath))) {
    return normalizeConfig(rawConfigSchema.parse({}));
  }

  const raw = await readTextFile(configPath);
  const parsed = YAML.parse(raw) ?? {};
  const result = rawConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new BriefOpsError(`Invalid config ${configPath}: ${result.error.message}`);
  }

  return normalizeConfig(result.data);
}

export async function writeBriefOpsConfig(
  cwd: string,
  config: BriefOpsConfig
): Promise<BriefOpsConfig> {
  await requireWorkspace(cwd);
  const normalized = normalizeConfig(rawConfigSchema.parse(config));
  await writeYamlFile(workspacePaths(cwd).config, normalized);
  return normalized;
}

export async function setDefaultWorker(options: {
  cwd?: string;
  worker: string;
}): Promise<BriefOpsConfig> {
  const cwd = options.cwd ?? process.cwd();
  const worker = await readWorker(cwd, options.worker);
  const config = await readBriefOpsConfig(cwd);

  return writeBriefOpsConfig(cwd, {
    ...config,
    version: "0.2.0",
    defaults: {
      ...config.defaults,
      project: worker.project,
      worker: worker.name
    }
  });
}
