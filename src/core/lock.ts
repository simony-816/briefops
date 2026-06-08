import { promises as fs } from "node:fs";
import path from "node:path";
import { BriefOpsError } from "./errors.js";
import { normalizeName, workspacePaths } from "./paths.js";
import { ensureDirectory, pathExists, readTextFile } from "./storage.js";
import { requireWorkspace } from "./workspace.js";

export type WorkspaceLockOptions = {
  cwd?: string;
  name: string;
  timeoutMs?: number;
  staleMs?: number;
};

const defaultTimeoutMs = 1000;
const defaultStaleMs = 30 * 60 * 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function lockPath(cwd: string, name: string): string {
  return path.join(workspacePaths(cwd).root, ".locks", `${normalizeName(name)}.lock`);
}

async function isStale(filePath: string, staleMs: number): Promise<boolean> {
  if (!(await pathExists(filePath))) {
    return false;
  }

  try {
    const raw = await readTextFile(filePath);
    const createdAt = raw.match(/^created_at: (.+)$/m)?.[1]?.trim();
    const created = createdAt ? Date.parse(createdAt) : Number.NaN;
    return Number.isNaN(created) || Date.now() - created > staleMs;
  } catch {
    return true;
  }
}

async function acquireLock(options: Required<WorkspaceLockOptions>): Promise<string> {
  await requireWorkspace(options.cwd);
  const filePath = lockPath(options.cwd, options.name);
  await ensureDirectory(path.dirname(filePath));
  const start = Date.now();

  while (true) {
    try {
      const handle = await fs.open(filePath, "wx");
      await handle.writeFile(
        [
          `name: ${normalizeName(options.name)}`,
          `pid: ${process.pid}`,
          `created_at: ${new Date().toISOString()}`,
          ""
        ].join("\n"),
        "utf8"
      );
      await handle.close();
      return filePath;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      if (await isStale(filePath, options.staleMs)) {
        await fs.unlink(filePath).catch(() => undefined);
        continue;
      }
      if (Date.now() - start >= options.timeoutMs) {
        throw new BriefOpsError(
          `BriefOps workspace lock is already held: ${normalizeName(options.name)}`
        );
      }
      await delay(10);
    }
  }
}

export async function withWorkspaceLock<T>(
  options: WorkspaceLockOptions,
  callback: () => Promise<T>
): Promise<T> {
  const cwd = options.cwd ?? process.cwd();
  const lockFile = await acquireLock({
    cwd,
    name: options.name,
    timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
    staleMs: options.staleMs ?? defaultStaleMs
  });

  try {
    return await callback();
  } finally {
    await fs.unlink(lockFile).catch(() => undefined);
  }
}
