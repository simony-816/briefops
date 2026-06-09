import path from "node:path";
import type { Command } from "commander";
import {
  renderHarnessExport,
  type ExportTarget,
  type HarnessExportResult
} from "../core/exportTargets.js";
import { normalizeExportPolicy } from "../core/exportPolicy.js";
import { BriefOpsError } from "../core/errors.js";
import { pathExists, writeTextFile } from "../core/storage.js";

type ExportCommandOptions = {
  worker?: string;
  project?: string;
  exportPolicy?: string;
  output?: string;
  force?: boolean;
  dryRun?: boolean;
  stdout?: boolean;
};

function renderTarget(target: ExportTarget, options: ExportCommandOptions): HarnessExportResult {
  return renderHarnessExport({
    target,
    worker: options.worker,
    project: options.project,
    exportPolicy: normalizeExportPolicy(options.exportPolicy ?? "shared-only"),
    outputPath: options.output
      ? path.resolve(process.cwd(), options.output)
      : undefined,
    force: Boolean(options.force),
    dryRun: Boolean(options.dryRun),
    stdout: Boolean(options.stdout)
  });
}

async function writeResult(result: HarnessExportResult, options: ExportCommandOptions): Promise<void> {
  if (options.stdout) {
    for (const file of result.files) {
      console.log(`--- ${path.relative(process.cwd(), file.path)} ---`);
      console.log(file.content.trimEnd());
      console.log("");
    }
    return;
  }

  if (options.dryRun) {
    for (const file of result.files) {
      console.log(`Would write: ${file.path} (${file.tokens} tokens)`);
    }
    return;
  }

  const existing = [];
  for (const file of result.files) {
    if (!options.force && await pathExists(file.path)) {
      existing.push(file.path);
    }
  }
  if (existing.length > 0) {
    throw new BriefOpsError(
      `Output file already exists: ${existing.join(", ")}. Use --force to overwrite.`
    );
  }

  for (const file of result.files) {
    await writeTextFile(file.path, file.content, { force: Boolean(options.force) });
    file.written = true;
    console.log(`Wrote: ${file.path} (${file.tokens} tokens)`);
  }
}

async function runExport(target: ExportTarget, options: ExportCommandOptions): Promise<void> {
  if (options.output && target === "cursor-rules") {
    throw new BriefOpsError("--output is only supported for single-file exports.");
  }
  const result = renderTarget(target, options);
  await writeResult(result, options);
  if (result.warnings.length > 0) {
    console.error("Warnings:");
    for (const warning of result.warnings) {
      console.error(`- ${warning}`);
    }
  }
}

function addCommonOptions(command: Command, includeOutput = true): Command {
  command
    .option("--worker <worker>", "Worker profile name.")
    .option("--project <project>", "Project name.")
    .option("--export-policy <policy>", "local-private|shared-only", "shared-only")
    .option("--force", "Overwrite existing generated files.")
    .option("--dry-run", "Print target paths without writing files.")
    .option("--stdout", "Print generated content instead of writing files.");
  if (includeOutput) {
    command.option("--output <path>", "Write the export to a specific path.");
  }
  return command;
}

export function registerExportCommands(program: Command): void {
  const exportCommand = program
    .command("export")
    .description("Generate local AI harness router files without dumping BriefOps memory.");

  addCommonOptions(exportCommand.command("agents-md").description("Generate AGENTS.md."))
    .action(async (options: ExportCommandOptions) => runExport("agents-md", options));

  addCommonOptions(exportCommand.command("claude-md").description("Generate CLAUDE.md."))
    .action(async (options: ExportCommandOptions) => runExport("claude-md", options));

  addCommonOptions(
    exportCommand.command("cursor-rules").description("Generate Cursor .mdc rule routers."),
    false
  ).action(async (options: ExportCommandOptions) => runExport("cursor-rules", options));

  addCommonOptions(exportCommand.command("all").description("Generate AGENTS.md, CLAUDE.md, and Cursor rules."), false)
    .action(async (options: ExportCommandOptions) => {
      const results = [
        renderTarget("agents-md", options),
        renderTarget("claude-md", options),
        renderTarget("cursor-rules", options)
      ];
      const merged: HarnessExportResult = {
        files: results.flatMap((result) => result.files),
        warnings: results.flatMap((result) => result.warnings)
      };
      await writeResult(merged, options);
      if (merged.warnings.length > 0) {
        console.error("Warnings:");
        for (const warning of merged.warnings) {
          console.error(`- ${warning}`);
        }
      }
    });
}
