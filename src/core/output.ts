import path from "node:path";
import { BriefOpsError } from "./errors.js";
import { pathExists, writeTextFile } from "./storage.js";

export async function writeGeneratedOutput(options: {
  defaultPath: string;
  outputPath?: string;
  content: string;
  force?: boolean;
}): Promise<string> {
  const targetPath = options.outputPath ?? options.defaultPath;
  const isExplicit = Boolean(options.outputPath);

  if (isExplicit && !options.force && await pathExists(targetPath)) {
    throw new BriefOpsError(
      `Output file already exists: ${targetPath}. Re-run with --force to overwrite.`
    );
  }

  await writeTextFile(targetPath, options.content, {
    force: !isExplicit || Boolean(options.force)
  });
  return targetPath;
}

export function resolveCliOutputPath(cwd: string, value?: string): string | undefined {
  return value ? path.resolve(cwd, value) : undefined;
}
