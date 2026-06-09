import path from "node:path";
import { listMemory } from "./memory.js";
import { pathExists, readTextFile, writeTextFile } from "./storage.js";
import { requireWorkspace } from "./workspace.js";

export type PrivacyDoctorStatus = "ok" | "warn" | "fail";

export type PrivacyDoctorCheck = {
  name: string;
  status: PrivacyDoctorStatus;
  detail: string;
};

export type PrivacyDoctorResult = {
  ok: boolean;
  checks: PrivacyDoctorCheck[];
};

function check(name: string, status: PrivacyDoctorStatus, detail: string): PrivacyDoctorCheck {
  return { name, status, detail };
}

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bghp_[A-Za-z0-9_]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S+/i
];

async function gitignoreStatus(cwd: string): Promise<PrivacyDoctorCheck> {
  const gitignorePath = path.join(cwd, ".gitignore");
  if (!(await pathExists(gitignorePath))) {
    return check("Gitignore", "warn", ".gitignore not found; add `.briefops/` before public use.");
  }

  const raw = await readTextFile(gitignorePath);
  const ignoresBriefOps = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === ".briefops" || line === ".briefops/" || line === "/.briefops/");

  return ignoresBriefOps
    ? check("Gitignore", "ok", ".briefops is ignored.")
    : check("Gitignore", "warn", ".briefops is not ignored.");
}

export async function fixBriefOpsGitignore(cwd = process.cwd()): Promise<string> {
  const gitignorePath = path.join(cwd, ".gitignore");
  const existing = await pathExists(gitignorePath) ? await readTextFile(gitignorePath) : "";
  const lines = existing.split(/\r?\n/).map((line) => line.trim());
  if (!lines.includes(".briefops/") && !lines.includes(".briefops") && !lines.includes("/.briefops/")) {
    const next = `${existing.trimEnd()}${existing.trim() ? "\n" : ""}.briefops/\n`;
    await writeTextFile(gitignorePath, next, { force: true });
  }
  return gitignorePath;
}

export async function runPrivacyDoctor(options: {
  cwd?: string;
} = {}): Promise<PrivacyDoctorResult> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);

  const memory = await listMemory({ cwd });
  const privateExportable = memory.filter((item) => item.visibility === "private" && item.exportable);
  const secretLike = memory.filter((item) =>
    secretPatterns.some((pattern) => pattern.test(item.content))
  );

  const checks: PrivacyDoctorCheck[] = [
    await gitignoreStatus(cwd),
    privateExportable.length > 0
      ? check("Private exportable memory", "warn", `${privateExportable.length} private item(s) are exportable.`)
      : check("Private exportable memory", "ok", "No private exportable memory."),
    secretLike.length > 0
      ? check("Secret-like local memory", "warn", `${secretLike.length} memory item(s) look like secrets.`)
      : check("Secret-like local memory", "ok", "No secret-like memory found.")
  ];

  return {
    ok: checks.every((item) => item.status !== "fail"),
    checks
  };
}
