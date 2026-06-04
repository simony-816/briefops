import { randomBytes } from "node:crypto";
import { BriefOpsError } from "./errors.js";
import {
  memoryCategories,
  memoryFilePath,
  normalizeName,
  type MemoryCategory
} from "./paths.js";
import { estimateTokens } from "./tokens.js";
import { parseCommaList, readYamlFile, writeYamlFile } from "./storage.js";
import { requireWorkspace } from "./workspace.js";
import {
  memoryFileSchema,
  memoryStatuses,
  type MemoryFile,
  type MemoryItem,
  type MemoryStatus
} from "../schemas/memory.js";

const categoryToItemType: Record<MemoryCategory, MemoryItem["type"]> = {
  facts: "fact",
  decisions: "decision",
  lessons: "lesson",
  incidents: "incident",
  deprecated: "deprecated"
};

const singularToCategory: Record<string, MemoryCategory> = {
  fact: "facts",
  decision: "decisions",
  lesson: "lessons",
  incident: "incidents",
  deprecated: "deprecated"
};

export type AddMemoryOptions = {
  cwd?: string;
  type: string;
  project?: string;
  skill?: string;
  content: string;
  status?: string;
  tags?: string[] | string;
  source?: string;
};

export type ListMemoryFilters = {
  cwd?: string;
  type?: string;
  project?: string;
  skill?: string;
  status?: string;
  tag?: string;
};

export type SelectRelevantMemoryOptions = {
  cwd: string;
  project?: string;
  skill?: string;
  worker?: string;
  task?: string;
  types?: string[];
  maxTokens: number;
  quotas?: Partial<Record<MemoryCategory, number>>;
  includeDeprecated?: boolean;
};

export type MemorySelection = {
  item: MemoryItem;
  score: number;
  tier: number;
  reason: string;
};

export function normalizeMemoryCategory(value: string): MemoryCategory {
  const normalized = value.trim().toLowerCase();
  if ((memoryCategories as readonly string[]).includes(normalized)) {
    return normalized as MemoryCategory;
  }

  const singular = singularToCategory[normalized];
  if (singular) {
    return singular;
  }

  throw new BriefOpsError(`Invalid memory type: ${value}`);
}

export function normalizeMemoryStatus(value?: string): MemoryStatus {
  const status = (value ?? "active").trim().toLowerCase();
  if ((memoryStatuses as readonly string[]).includes(status)) {
    return status as MemoryStatus;
  }

  throw new BriefOpsError(`Invalid memory status: ${value}`);
}

async function readMemoryFile(cwd: string, category: MemoryCategory): Promise<MemoryFile> {
  return readYamlFile(memoryFilePath(cwd, category), memoryFileSchema, { items: [] });
}

async function writeMemoryFile(
  cwd: string,
  category: MemoryCategory,
  memoryFile: MemoryFile
): Promise<void> {
  await writeYamlFile(memoryFilePath(cwd, category), memoryFile);
}

export async function addMemoryIfMissing(options: AddMemoryOptions): Promise<{
  item: MemoryItem;
  created: boolean;
}> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);

  const category = normalizeMemoryCategory(options.type);
  const project = options.project ? normalizeName(options.project) : undefined;
  const skill = options.skill ? normalizeName(options.skill) : undefined;
  const content = options.content.trim();
  const existing = (await readMemoryFile(cwd, category)).items.find(
    (item) =>
      item.project === project &&
      item.skill === skill &&
      item.type === categoryToItemType[category] &&
      item.content.trim().toLowerCase() === content.toLowerCase()
  );

  if (existing) {
    return { item: existing, created: false };
  }

  return {
    item: await addMemory(options),
    created: true
  };
}

export async function addMemory(options: AddMemoryOptions): Promise<MemoryItem> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);

  const category = normalizeMemoryCategory(options.type);
  const memoryFile = await readMemoryFile(cwd, category);
  const tags = Array.isArray(options.tags) ? options.tags : parseCommaList(options.tags);
  const createdAt = new Date().toISOString();
  const item = {
    id: `mem_${createdAt.replace(/[-:.TZ]/g, "").slice(0, 17)}_${randomBytes(3).toString(
      "hex"
    )}`,
    type: categoryToItemType[category],
    status: normalizeMemoryStatus(options.status),
    project: options.project ? normalizeName(options.project) : undefined,
    skill: options.skill ? normalizeName(options.skill) : undefined,
    content: options.content.trim(),
    source: options.source ?? "manual",
    created_at: createdAt,
    tags
  } satisfies MemoryItem;

  memoryFile.items.push(item);
  await writeMemoryFile(cwd, category, memoryFile);
  return item;
}

export async function listMemory(filters: ListMemoryFilters = {}): Promise<MemoryItem[]> {
  const cwd = filters.cwd ?? process.cwd();
  await requireWorkspace(cwd);

  const categories = filters.type
    ? [normalizeMemoryCategory(filters.type)]
    : [...memoryCategories];
  const status = filters.status ? normalizeMemoryStatus(filters.status) : undefined;
  const project = filters.project ? normalizeName(filters.project) : undefined;
  const skill = filters.skill ? normalizeName(filters.skill) : undefined;
  const tag = filters.tag?.trim();
  const items = (
    await Promise.all(categories.map((category) => readMemoryFile(cwd, category)))
  ).flatMap((file) => file.items);

  return items
    .filter((item) => (project ? item.project === project : true))
    .filter((item) => (skill ? item.skill === skill : true))
    .filter((item) => (status ? item.status === status : true))
    .filter((item) => (tag ? item.tags.includes(tag) : true))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function findMemoryById(
  cwd: string,
  id: string
): Promise<{ category: MemoryCategory; file: MemoryFile; item: MemoryItem; index: number }> {
  await requireWorkspace(cwd);

  for (const category of memoryCategories) {
    const file = await readMemoryFile(cwd, category);
    const index = file.items.findIndex((item) => item.id === id);
    if (index !== -1) {
      return {
        category,
        file,
        item: file.items[index],
        index
      };
    }
  }

  throw new BriefOpsError(`Memory item not found: ${id}`);
}

export async function showMemory(cwd: string, id: string): Promise<MemoryItem> {
  return (await findMemoryById(cwd, id)).item;
}

export async function updateMemoryStatus(options: {
  cwd?: string;
  id: string;
  status: string;
}): Promise<MemoryItem> {
  const cwd = options.cwd ?? process.cwd();
  const found = await findMemoryById(cwd, options.id);
  const updated = {
    ...found.item,
    status: normalizeMemoryStatus(options.status)
  };
  found.file.items[found.index] = updated;
  await writeMemoryFile(cwd, found.category, found.file);
  return updated;
}

export function formatMemoryItem(item: MemoryItem): string {
  const parts = [
    item.project ? `project: ${item.project}` : undefined,
    item.skill ? `skill: ${item.skill}` : undefined,
    item.tags.length > 0 ? `tags: ${item.tags.join(",")}` : undefined
  ].filter(Boolean);
  const suffix = parts.length > 0 ? ` (${parts.join("; ")})` : "";

  return `- [${item.type}] ${item.content}${suffix}`;
}

const typeWeights: Record<MemoryItem["type"], number> = {
  decision: 30,
  lesson: 25,
  incident: 20,
  fact: 15,
  deprecated: -10
};

const itemTypeToCategory: Record<MemoryItem["type"], MemoryCategory> = {
  fact: "facts",
  decision: "decisions",
  lesson: "lessons",
  incident: "incidents",
  deprecated: "deprecated"
};

function keywords(value?: string): Set<string> {
  return new Set(
    (value ?? "")
      .toLowerCase()
      .split(/[^a-z0-9가-힣]+/i)
      .map((word) => word.trim())
      .filter((word) => word.length >= 3)
  );
}

function freshnessScore(createdAt: string): number {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) {
    return 0;
  }

  const ageDays = (Date.now() - created) / 86_400_000;
  if (ageDays <= 30) {
    return 10;
  }
  if (ageDays <= 90) {
    return 5;
  }
  return 0;
}

export function scoreMemoryItem(options: {
  item: MemoryItem;
  project?: string;
  skill?: string;
  worker?: string;
  task?: string;
}): MemorySelection {
  const project = options.project ? normalizeName(options.project) : undefined;
  const skill = options.skill ? normalizeName(options.skill) : undefined;
  const reasons: string[] = [];
  let score = 0;
  let tier = 0;

  if (project && skill && options.item.project === project && options.item.skill === skill) {
    score += 100;
    tier = 3;
    reasons.push("project+skill");
  } else {
    if (project && options.item.project === project) {
      score += 50;
      tier = Math.max(tier, 2);
      reasons.push("project");
    }
    if (skill && options.item.skill === skill) {
      score += 40;
      tier = Math.max(tier, 1);
      reasons.push("skill");
    }
  }

  if (options.worker && skill && options.item.skill === skill) {
    score += 20;
    reasons.push("worker skill");
  }

  const taskWords = keywords(options.task);
  const itemWords = keywords(`${options.item.content} ${options.item.tags.join(" ")}`);
  const overlap = [...taskWords].filter((word) => itemWords.has(word));
  if (overlap.length > 0) {
    score += overlap.length * 10;
    reasons.push(`task match: ${overlap.join("/")}`);
  }

  score += typeWeights[options.item.type];
  reasons.push(`${options.item.type} type`);
  const fresh = freshnessScore(options.item.created_at);
  if (fresh > 0) {
    score += fresh;
    reasons.push(fresh === 10 ? "recent 30d" : "recent 90d");
  }
  if (options.item.status === "deprecated" || options.item.type === "deprecated") {
    score -= 25;
    reasons.push("deprecated penalty");
  }

  return {
    item: options.item,
    score,
    tier,
    reason: reasons.join(", ") || "no direct match"
  };
}

export async function selectRelevantMemory(
  options: SelectRelevantMemoryOptions
): Promise<{ items: MemoryItem[]; text: string; tokens: number; omitted: number; selections: MemorySelection[]; omittedSelections: MemorySelection[] }> {
  const types = options.types?.map(normalizeMemoryCategory);
  const active = await listMemory({ cwd: options.cwd, status: "active" });
  const candidates = active.filter((item) => {
    const category = itemTypeToCategory[item.type];
    if (types && !types.includes(category)) {
      return false;
    }
    if (!options.includeDeprecated && category === "deprecated") {
      return false;
    }
    return true;
  });
  const ordered = candidates
    .map((item) =>
      scoreMemoryItem({
        item,
        project: options.project,
        skill: options.skill,
        worker: options.worker,
        task: options.task
      })
    )
    .filter((selection) => selection.score > 0)
    .sort(
      (a, b) =>
        b.tier - a.tier ||
        b.score - a.score ||
        b.item.created_at.localeCompare(a.item.created_at)
    );

  const selected: MemoryItem[] = [];
  const selections: MemorySelection[] = [];
  const quotaCounts = new Map<MemoryCategory, number>();
  let tokens = 0;

  for (const selection of ordered) {
    const item = selection.item;
    const category = itemTypeToCategory[item.type];
    const quota = options.quotas?.[category];
    if (quota !== undefined && (quotaCounts.get(category) ?? 0) >= quota) {
      continue;
    }

    const itemTokens = estimateTokens(formatMemoryItem(item));
    if (tokens + itemTokens > options.maxTokens) {
      continue;
    }

    selected.push(item);
    selections.push(selection);
    quotaCounts.set(category, (quotaCounts.get(category) ?? 0) + 1);
    tokens += itemTokens;
  }

  return {
    items: selected,
    text: selected.map(formatMemoryItem).join("\n"),
    tokens,
    omitted: ordered.length - selected.length,
    selections,
    omittedSelections: ordered.filter((selection) => !selected.some((item) => item.id === selection.item.id))
  };
}
