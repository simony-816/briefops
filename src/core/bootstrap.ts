import { installCodexPack } from "./codex.js";
import { installCodexPlugin } from "./codexPlugin.js";
import { fixBriefOpsGitignore, runPrivacyDoctor, type PrivacyDoctorResult } from "./privacyDoctor.js";
import { runStabilityDoctor, type StabilityDoctorResult } from "./stabilityDoctor.js";
import { initWorkspace } from "./workspace.js";

export type BootstrapOptions = {
  cwd?: string;
  force?: boolean;
  codex?: boolean;
  plugin?: boolean;
  fixGitignore?: boolean;
  doctor?: boolean;
};

export type BootstrapResult = {
  root: string;
  created: string[];
  existing: string[];
  agentsPath?: string;
  promptDir?: string;
  pluginRoot?: string;
  pluginFiles: string[];
  gitignorePath?: string;
  stability?: StabilityDoctorResult;
  privacy?: PrivacyDoctorResult;
  nextCommands: string[];
  warnings: string[];
};

function warningDetails(result?: StabilityDoctorResult | PrivacyDoctorResult): string[] {
  return result
    ? result.checks
        .filter((check) => check.status !== "ok")
        .map((check) => `${check.name}: ${check.detail}`)
    : [];
}

export async function bootstrapWorkspace(options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const cwd = options.cwd ?? process.cwd();
  const shouldInstallCodex = options.codex ?? true;
  const shouldInstallPlugin = options.plugin ?? true;
  const shouldFixGitignore = options.fixGitignore ?? true;
  const shouldRunDoctor = options.doctor ?? true;

  const init = await initWorkspace(cwd);
  const codex = shouldInstallCodex
    ? await installCodexPack({
        cwd,
        force: options.force
      })
    : undefined;
  const plugin = shouldInstallPlugin
    ? await installCodexPlugin({
        cwd,
        force: options.force
      })
    : undefined;
  const gitignorePath = shouldFixGitignore ? await fixBriefOpsGitignore(cwd) : undefined;
  const stability = shouldRunDoctor
    ? await runStabilityDoctor({
        cwd,
        maxExamples: 5
      })
    : undefined;
  const privacy = shouldRunDoctor
    ? await runPrivacyDoctor({
        cwd
      })
    : undefined;
  const warnings = [
    ...warningDetails(stability),
    ...warningDetails(privacy)
  ];

  return {
    root: init.root,
    created: init.created,
    existing: init.existing,
    agentsPath: codex?.agentsPath,
    promptDir: codex?.promptDir,
    pluginRoot: plugin?.root,
    pluginFiles: plugin?.files ?? [],
    gitignorePath,
    stability,
    privacy,
    nextCommands: [
      "briefops skill create <skill> --description \"<working protocol>\"",
      "briefops project create <project> --description \"<repo constraints>\"",
      "briefops worker create <worker> --project <project> --skills \"<skill>\"",
      "briefops worker use <worker>",
      "briefops prime --format codex --task \"<current task>\" --max-tokens 800"
    ],
    warnings
  };
}
