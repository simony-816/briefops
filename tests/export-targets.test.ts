import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultContextBudgets } from "../src/core/contextBudget.js";
import { renderHarnessExport } from "../src/core/exportTargets.js";
import { estimateTokens } from "../src/core/tokens.js";
import { withTempDir } from "./helpers.js";

const repoRoot = process.cwd();
const cliEntry = path.join(repoRoot, "src/index.ts");
const tsxLoader = path.join(repoRoot, "node_modules/tsx/dist/loader.mjs");

type CliResult = {
  stdout: string;
  stderr: string;
  code: number | null;
};

function runCli(cwd: string, args: string[]): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", tsxLoader, cliEntry, ...args], {
      cwd,
      env: process.env
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}

async function expectCli(cwd: string, args: string[]): Promise<CliResult> {
  const result = await runCli(cwd, args);
  expect(result.code, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`).toBe(0);
  return result;
}

describe("harness router exports", () => {
  it("prints context budget targets from the CLI", async () => {
    await withTempDir(async (dir) => {
      const result = await expectCli(dir, ["inspect", "budget"]);

      expect(result.stdout).toContain("BriefOps Context Budget");
      expect(result.stdout).toContain("AGENTS.md: target 500 tokens");
      expect(result.stdout).toContain("prime default: 800 tokens");
    });
  });

  it("generates router-only AGENTS.md content", () => {
    const result = renderHarnessExport({
      cwd: "/tmp/repo",
      target: "agents-md",
      worker: "quant-reviewer",
      project: "atlas-q"
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe("/tmp/repo/AGENTS.md");
    expect(result.files[0].content).toContain("briefops prime --format codex");
    expect(result.files[0].content).toContain("Never apply memory automatically");
    expect(result.files[0].content).not.toContain("Accumulated Lessons");
    expect(result.files[0].content).not.toContain("Recent Work");
    expect(result.files[0].tokens).toBeLessThanOrEqual(800);
  });

  it("generates router-only CLAUDE.md content", () => {
    const result = renderHarnessExport({
      cwd: "/tmp/repo",
      target: "claude-md",
      worker: "quant-reviewer"
    });

    expect(result.files[0].path).toBe("/tmp/repo/CLAUDE.md");
    expect(result.files[0].content).toContain("briefops prime --format markdown");
    expect(result.files[0].content).toContain("Human Approval Required");
    expect(result.files[0].content).not.toContain("@.briefops");
    expect(result.files[0].tokens).toBeLessThanOrEqual(1000);
  });

  it("generates compact Cursor rules with the right activation strategy", () => {
    const result = renderHarnessExport({
      cwd: "/tmp/repo",
      target: "cursor-rules",
      worker: "quant-reviewer"
    });
    const combinedTokens = estimateTokens(result.files.map((file) => file.content).join("\n"));

    expect(result.files.map((file) => path.basename(file.path))).toEqual([
      "briefops-prime.mdc",
      "briefops-finish.mdc",
      "briefops-memory-review.mdc",
      "briefops-continue.mdc"
    ]);
    expect(result.files[0].content).toContain("alwaysApply: true");
    for (const file of result.files.slice(1)) {
      expect(file.content).toContain("alwaysApply: false");
      expect(file.content).not.toContain("raw work logs");
    }
    expect(combinedTokens).toBeLessThanOrEqual(defaultContextBudgets.exportCursorTotal);
  });

  it("supports dry-run, stdout, force, and overwrite protection from the CLI", async () => {
    await withTempDir(async (dir) => {
      const dryRun = await expectCli(dir, ["export", "agents-md", "--dry-run"]);
      expect(dryRun.stdout).toContain("Would write:");
      await expect(fs.stat(path.join(dir, "AGENTS.md"))).rejects.toThrow();

      const stdout = await expectCli(dir, ["export", "agents-md", "--stdout"]);
      expect(stdout.stdout).toContain("--- AGENTS.md ---");
      expect(stdout.stdout).toContain("briefops prime");
      await expect(fs.stat(path.join(dir, "AGENTS.md"))).rejects.toThrow();

      const written = await expectCli(dir, ["export", "agents-md"]);
      expect(written.stdout).toContain("Wrote:");
      const original = await fs.readFile(path.join(dir, "AGENTS.md"), "utf8");
      expect(original).toContain("BriefOps Agent Instructions");

      const blocked = await runCli(dir, ["export", "agents-md"]);
      expect(blocked.code).toBe(1);
      expect(blocked.stderr).toContain("Output file already exists");

      const forced = await expectCli(dir, ["export", "agents-md", "--force"]);
      expect(forced.stdout).toContain("Wrote:");
    });
  });

  it("generates all local harness files", async () => {
    await withTempDir(async (dir) => {
      await expectCli(dir, ["export", "all", "--worker", "quant-reviewer"]);

      expect(await fs.readFile(path.join(dir, "AGENTS.md"), "utf8")).toContain("briefops prime");
      expect(await fs.readFile(path.join(dir, "CLAUDE.md"), "utf8")).toContain("Claude Code");
      expect(
        await fs.readFile(path.join(dir, ".cursor/rules/briefops-prime.mdc"), "utf8")
      ).toContain("alwaysApply: true");
      expect(
        await fs.readFile(path.join(dir, ".cursor/rules/briefops-finish.mdc"), "utf8")
      ).toContain("alwaysApply: false");
      expect(
        await fs.readFile(path.join(dir, ".cursor/rules/briefops-memory-review.mdc"), "utf8")
      ).toContain("approve latest");
      expect(
        await fs.readFile(path.join(dir, ".cursor/rules/briefops-continue.mdc"), "utf8")
      ).toContain("continue --worker quant-reviewer");
    });
  });
});
