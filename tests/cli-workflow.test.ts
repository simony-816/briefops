import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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

function matchPath(output: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = output.match(new RegExp(`${escaped}: (.+)`));
  expect(match?.[1]).toBeTruthy();
  return match?.[1].trim() as string;
}

describe("CLI persistent worker workflow", () => {
  it("finishes typo-sized work without memory proposal candidates", async () => {
    await withTempDir(async (dir) => {
      await expectCli(dir, ["init"]);
      const finished = await expectCli(dir, [
        "finish",
        "--worker",
        "reviewer",
        "--task",
        "Fix typo",
        "--result",
        "Fixed typo."
      ]);

      expect(finished.stdout).toContain("Added work log:");
      expect(finished.stdout).toContain("Warnings:");
      expect(finished.stdout).toContain("- No durable memory proposal candidates found.");
      expect(finished.stdout).toContain(
        "- Worker reviewer does not exist yet. Run: briefops worker create reviewer"
      );
      expect(finished.stdout).toContain("Next command:");
      expect(finished.stdout).toContain('briefops continue --worker reviewer --task "Fix typo"');
    });
  });

  it("runs finish, apply memory, continue --pack, and standalone pack", async () => {
    await withTempDir(async (dir) => {
      await expectCli(dir, ["init"]);
      await expectCli(dir, ["skill", "create", "risk-review"]);
      await expectCli(dir, ["project", "create", "atlas-q"]);
      await expectCli(dir, [
        "worker",
        "create",
        "quant-reviewer",
        "--project",
        "atlas-q",
        "--skills",
        "risk-review"
      ]);
      const finish = await expectCli(dir, [
        "finish",
        "--project",
        "atlas-q",
        "--skill",
        "risk-review",
        "--worker",
        "quant-reviewer",
        "--task",
        "Review rebalance",
        "--result",
        "Found missing turnover warning.",
        "--lesson",
        "Always verify turnover warning."
      ]);
      expect(finish.stdout).toContain("Next command");

      const proposalFiles = await fs.readdir(path.join(dir, ".briefops/memory-proposals"));
      expect(proposalFiles.some((file) => file.endsWith(".memory-proposal.yaml"))).toBe(true);

      const applied = await expectCli(dir, ["memory", "proposal-apply", "latest"]);
      expect(applied.stdout).toContain("Applied memory proposal:");

      const continued = await expectCli(dir, [
        "continue",
        "--worker",
        "quant-reviewer",
        "--task",
        "Continue unresolved checks.",
        "--pack"
      ]);
      expect(continued.stdout).toContain("Continuity readiness");
      expect(continued.stdout).toContain("Saved handoff:");
      expect(continued.stdout).toContain("Saved Codex resume:");
      expect(continued.stdout).toContain("Saved portable resume pack:");

      const resumePath = matchPath(continued.stdout, "Saved Codex resume");
      const continuedPackPath = matchPath(continued.stdout, "Saved portable resume pack");
      await expect(fs.stat(continuedPackPath)).resolves.toBeTruthy();

      const standalonePack = await expectCli(dir, [
        "pack",
        "resume",
        "--worker",
        "quant-reviewer",
        "--task",
        "Continue unresolved checks."
      ]);
      const standalonePackPath = matchPath(standalonePack.stdout, "Saved portable resume pack");
      await expect(fs.stat(standalonePackPath)).resolves.toBeTruthy();

      const resume = await fs.readFile(resumePath, "utf8");
      const pack = await fs.readFile(standalonePackPath, "utf8");
      for (const content of [resume, pack]) {
        expect(content).toContain("Always verify turnover warning.");
        expect(content).toContain("Worker Intelligence");
        expect(content).toContain("Continuity Contract");
        expect(content).toContain("<briefops-complete>DONE</briefops-complete>");
      }
    });
  });

  it("installs and checks the local Codex plugin bundle", async () => {
    await withTempDir(async (dir) => {
      await expectCli(dir, ["init"]);

      const installed = await expectCli(dir, ["codex", "plugin", "install"]);
      expect(installed.stdout).toContain("BriefOps Codex plugin bundle installed.");
      expect(installed.stdout).toContain(".briefops/codex/plugin/briefops");

      const checked = await expectCli(dir, ["codex", "plugin", "doctor"]);
      expect(checked.stdout).toContain("skills/briefops-prime-context/SKILL.md");
      expect(checked.stdout).toContain("ok");
    });
  });

  it("sets and prints the default worker for new thread starts", async () => {
    await withTempDir(async (dir) => {
      await expectCli(dir, ["init"]);
      await expectCli(dir, ["skill", "create", "risk-review"]);
      await expectCli(dir, ["project", "create", "atlas-q"]);
      await expectCli(dir, [
        "worker",
        "create",
        "quant-reviewer",
        "--project",
        "atlas-q",
        "--skills",
        "risk-review"
      ]);

      const selected = await expectCli(dir, ["worker", "use", "quant-reviewer"]);
      expect(selected.stdout).toContain("Default worker: quant-reviewer");
      expect(selected.stdout).toContain("Default project: atlas-q");

      const current = await expectCli(dir, ["worker", "current"]);
      expect(current.stdout).toContain("Default worker: quant-reviewer");
      expect(current.stdout).toContain("Default project: atlas-q");
    });
  });

  it("prints compact prime context from the CLI", async () => {
    await withTempDir(async (dir) => {
      await expectCli(dir, ["init"]);
      await expectCli(dir, ["skill", "create", "risk-review"]);
      await expectCli(dir, ["project", "create", "atlas-q"]);
      await expectCli(dir, [
        "worker",
        "create",
        "quant-reviewer",
        "--project",
        "atlas-q",
        "--skills",
        "risk-review"
      ]);
      await expectCli(dir, ["worker", "use", "quant-reviewer"]);

      const primed = await expectCli(dir, [
        "prime",
        "--task",
        "Continue unresolved checks.",
        "--max-tokens",
        "800"
      ]);
      expect(primed.stdout).toContain("BriefOps Prime Context");
      expect(primed.stdout).toContain("Token Budget");
      expect(primed.stderr).toContain("Estimated tokens:");

      const codexPrimed = await expectCli(dir, [
        "codex",
        "prime",
        "--task",
        "Continue unresolved checks.",
        "--max-tokens",
        "800"
      ]);
      expect(codexPrimed.stdout).toContain("BriefOps Prime Context");
      expect(codexPrimed.stdout).toContain("Codex Operating Note");
      expect(codexPrimed.stderr).toContain("Estimated tokens:");
    });
  });

  it("accepts shared-only export policy for handoff and Codex resume CLI output", async () => {
    await withTempDir(async (dir) => {
      await expectCli(dir, ["init"]);
      await expectCli(dir, ["skill", "create", "risk-review"]);
      await expectCli(dir, ["project", "create", "atlas-q"]);
      await expectCli(dir, [
        "worker",
        "create",
        "quant-reviewer",
        "--project",
        "atlas-q",
        "--skills",
        "risk-review"
      ]);
      await expectCli(dir, ["worker", "use", "quant-reviewer"]);

      const handoff = await expectCli(dir, [
        "handoff",
        "generate",
        "--worker",
        "quant-reviewer",
        "--task",
        "Continue unresolved checks.",
        "--export-policy",
        "shared-only"
      ]);
      expect(handoff.stdout).toContain("Shared-only export policy is active.");

      const resume = await expectCli(dir, [
        "codex",
        "resume",
        "--worker",
        "quant-reviewer",
        "--task",
        "Continue unresolved checks.",
        "--export-policy",
        "shared-only"
      ]);
      expect(resume.stdout).toContain("Shared-only export policy is active.");
      expect(resume.stdout).toContain("Continuity Contract");
    });
  });

  it("protects explicit CLI output files unless --force is passed", async () => {
    await withTempDir(async (dir) => {
      await expectCli(dir, ["init"]);
      await expectCli(dir, ["skill", "create", "risk-review"]);
      await expectCli(dir, ["project", "create", "atlas-q"]);
      await expectCli(dir, [
        "worker",
        "create",
        "quant-reviewer",
        "--project",
        "atlas-q",
        "--skills",
        "risk-review"
      ]);
      const outputPath = path.join(dir, "resume.md");
      await fs.writeFile(outputPath, "keep me\n", "utf8");

      const blocked = await runCli(dir, [
        "codex",
        "resume",
        "--worker",
        "quant-reviewer",
        "--task",
        "Continue unresolved checks.",
        "--output",
        "resume.md"
      ]);
      expect(blocked.code).toBe(1);
      expect(blocked.stderr).toContain("Output file already exists");
      expect(await fs.readFile(outputPath, "utf8")).toBe("keep me\n");

      const forced = await expectCli(dir, [
        "codex",
        "resume",
        "--worker",
        "quant-reviewer",
        "--task",
        "Continue unresolved checks.",
        "--output",
        "resume.md",
        "--force"
      ]);
      expect(forced.stderr).toContain("Saved Codex resume:");
      expect(await fs.readFile(outputPath, "utf8")).toContain("BriefOps Codex Resume");
    });
  });

  it("runs security doctor from the CLI", async () => {
    await withTempDir(async (dir) => {
      await expectCli(dir, ["init"]);
      await expectCli(dir, ["skill", "create", "risk-review"]);
      await expectCli(dir, ["project", "create", "atlas-q"]);
      await expectCli(dir, [
        "worker",
        "create",
        "quant-reviewer",
        "--project",
        "atlas-q",
        "--skills",
        "risk-review"
      ]);
      await expectCli(dir, ["worker", "use", "quant-reviewer"]);

      const checked = await expectCli(dir, ["doctor", "--security"]);
      expect(checked.stdout).toContain("Default worker");
      expect(checked.stdout).toContain("Stale lock files");

      const fixed = await expectCli(dir, ["doctor", "--security", "--fix-stale-locks"]);
      expect(fixed.stdout).toContain("Stale lock files");
    });
  });

  it("runs privacy doctor and can add .briefops to gitignore", async () => {
    await withTempDir(async (dir) => {
      await expectCli(dir, ["init"]);

      const checked = await expectCli(dir, ["doctor", "--privacy"]);
      expect(checked.stdout).toContain("Gitignore");
      expect(checked.stdout).toContain("warn");

      const fixed = await expectCli(dir, ["doctor", "--privacy", "--fix-gitignore"]);
      expect(fixed.stdout).toContain("Updated gitignore:");
      expect(fixed.stdout).toContain("Gitignore");
      expect(await fs.readFile(path.join(dir, ".gitignore"), "utf8")).toContain(".briefops/");
    });
  });
});
