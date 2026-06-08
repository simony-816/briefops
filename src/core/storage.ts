import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { BriefOpsError } from "./errors.js";

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeFileIfAbsent(filePath: string, content: string): Promise<boolean> {
  if (await pathExists(filePath)) {
    return false;
  }

  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
  return true;
}

export async function writeTextFile(
  filePath: string,
  content: string,
  options: { force?: boolean } = {}
): Promise<void> {
  if (!options.force && (await pathExists(filePath))) {
    throw new BriefOpsError(`File already exists: ${filePath}`);
  }

  await ensureDirectory(path.dirname(filePath));
  await writeTextFileAtomic(filePath, content);
}

export async function writeTextFileAtomic(filePath: string, content: string): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  const tempPath = path.join(
    path.dirname(filePath),
    `.tmp-${path.basename(filePath)}-${process.pid}-${randomBytes(4).toString("hex")}`
  );

  try {
    await fs.writeFile(tempPath, content, "utf8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

export async function readTextFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new BriefOpsError(`File not found: ${filePath}`);
    }

    throw error;
  }
}

export async function readYamlFile<TSchema extends z.ZodTypeAny>(
  filePath: string,
  schema: TSchema,
  fallback: z.input<TSchema>
): Promise<z.output<TSchema>> {
  if (!(await pathExists(filePath))) {
    return schema.parse(fallback);
  }

  const raw = await readTextFile(filePath);
  const parsed = YAML.parse(raw) ?? fallback;
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new BriefOpsError(`Invalid YAML in ${filePath}: ${result.error.message}`);
  }

  return result.data;
}

export async function writeYamlFile(filePath: string, value: unknown): Promise<void> {
  await writeYamlFileAtomic(filePath, value);
}

export async function writeYamlFileAtomic(filePath: string, value: unknown): Promise<void> {
  await writeTextFileAtomic(filePath, `${YAML.stringify(value).trim()}\n`);
}

export function stringifyMarkdownWithFrontmatter(data: unknown, body: string): string {
  return `---\n${YAML.stringify(data).trim()}\n---\n\n${body.trim()}\n`;
}

export function parseMarkdownWithFrontmatter<TSchema extends z.ZodTypeAny>(
  raw: string,
  schema: TSchema,
  sourceName: string
): { data: z.output<TSchema>; body: string; raw: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new BriefOpsError(`Missing frontmatter in ${sourceName}`);
  }

  const parsed = YAML.parse(match[1] ?? "") ?? {};
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new BriefOpsError(`Invalid frontmatter in ${sourceName}: ${result.error.message}`);
  }

  return {
    data: result.data,
    body: (match[2] ?? "").trim(),
    raw
  };
}

export async function listFilesBySuffix(dirPath: string, suffix: string): Promise<string[]> {
  if (!(await pathExists(dirPath))) {
    return [];
  }

  const entries = await fs.readdir(dirPath);
  return entries
    .filter((entry) => entry.endsWith(suffix))
    .sort()
    .map((entry) => path.join(dirPath, entry));
}

export function parseCommaList(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
