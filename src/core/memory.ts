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
};

export type ListMemoryFilters = {
  cwd?: string;
  type?: string;
  project?: string;
  skill?: string;
  status?: string;
  tag?: string;
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
    source: "manual",
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

export async function selectRelevantMemory(options: {
  cwd: string;
  project: string;
  skill: string;
  maxTokens: number;
}): Promise<{ items: MemoryItem[]; text: string; tokens: number; omitted: number }> {
  const project = normalizeName(options.project);
  const skill = normalizeName(options.skill);
  const active = await listMemory({ cwd: options.cwd, status: "active" });
  const seen = new Set<string>();
  const newestFirst = (items: MemoryItem[]) =>
    [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const buckets = [
    newestFirst(active.filter((item) => item.project === project && item.skill === skill)),
    newestFirst(active.filter((item) => item.project === project)),
    newestFirst(active.filter((item) => item.skill === skill))
  ];
  const ordered = buckets
    .flat()
    .filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });

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

  return {
    items: selected,
    text: selected.map(formatMemoryItem).join("\n"),
    tokens,
    omitted: ordered.length - selected.length
  };
}
