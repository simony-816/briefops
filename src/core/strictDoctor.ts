import { inspectMemoryHygiene } from "./memoryHygiene.js";
import { runPrivacyDoctor } from "./privacyDoctor.js";
import { runSecurityDoctor } from "./securityDoctor.js";
import { runStabilityDoctor } from "./stabilityDoctor.js";
import { runRuntimeDoctor } from "./runtimeDoctor.js";

export type StrictDoctorStatus = "ok" | "warn" | "fail";

export type StrictDoctorCheck = {
  source: "stability" | "security" | "privacy" | "memory-hygiene" | "runtime";
  name: string;
  status: StrictDoctorStatus;
  detail: string;
};

export type StrictDoctorResult = {
  ok: boolean;
  releaseReady: boolean;
  summary: {
    checks: number;
    ok: number;
    warn: number;
    fail: number;
  };
  checks: StrictDoctorCheck[];
};

function summarize(checks: StrictDoctorCheck[]): StrictDoctorResult["summary"] {
  return {
    checks: checks.length,
    ok: checks.filter((check) => check.status === "ok").length,
    warn: checks.filter((check) => check.status === "warn").length,
    fail: checks.filter((check) => check.status === "fail").length
  };
}

function failure(source: StrictDoctorCheck["source"], error: unknown): StrictDoctorCheck {
  return {
    source,
    name: "Runtime",
    status: "fail",
    detail: error instanceof Error ? error.message : String(error)
  };
}

export async function runStrictDoctor(options: {
  cwd?: string;
  maxExamples?: number;
} = {}): Promise<StrictDoctorResult> {
  const cwd = options.cwd ?? process.cwd();
  const checks: StrictDoctorCheck[] = [];

  try {
    const runtime = await runRuntimeDoctor({ cwd });
    checks.push(...runtime.checks.map((check) => ({ source: "runtime" as const, ...check })));
  } catch (error) { checks.push(failure("runtime", error)); }

  try {
    const stability = await runStabilityDoctor({
      cwd,
      maxExamples: options.maxExamples
    });
    checks.push(
      ...stability.checks.map((check) => ({
        source: "stability" as const,
        name: check.name,
        status: check.status,
        detail: check.detail
      }))
    );
  } catch (error) {
    checks.push(failure("stability", error));
  }

  try {
    const security = await runSecurityDoctor({ cwd });
    checks.push(
      ...security.checks.map((check) => ({
        source: "security" as const,
        name: check.name,
        status: check.status,
        detail: check.detail
      }))
    );
  } catch (error) {
    checks.push(failure("security", error));
  }

  try {
    const privacy = await runPrivacyDoctor({ cwd });
    checks.push(
      ...privacy.checks.map((check) => ({
        source: "privacy" as const,
        name: check.name,
        status: check.status,
        detail: check.detail
      }))
    );
  } catch (error) {
    checks.push(failure("privacy", error));
  }

  try {
    const hygiene = await inspectMemoryHygiene({ cwd });
    checks.push({
      source: "memory-hygiene",
      name: "Memory hygiene",
      status: hygiene.warnings.length > 0 ? "warn" : "ok",
      detail: hygiene.warnings.length > 0 ? hygiene.warnings.join("; ") : "No memory hygiene warnings."
    });
    checks.push({
      source: "memory-hygiene",
      name: "Potential decision conflicts",
      status: hygiene.potentialConflicts.length > 0 ? "warn" : "ok",
      detail: `${hygiene.potentialConflicts.length} potential conflict(s).`
    });
    checks.push({
      source: "memory-hygiene",
      name: "Old active memory",
      status: hygiene.oldActive.length > 0 ? "warn" : "ok",
      detail: `${hygiene.oldActive.length} old active item(s).`
    });
  } catch (error) {
    checks.push(failure("memory-hygiene", error));
  }

  const summary = summarize(checks);
  return {
    ok: summary.fail === 0,
    releaseReady: summary.fail === 0 && summary.warn === 0,
    summary,
    checks
  };
}
