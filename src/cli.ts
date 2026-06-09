import { Command } from "commander";
import { registerApproveCommand } from "./commands/approve.js";
import { registerBriefCommands } from "./commands/brief.js";
import { registerCodexCommands } from "./commands/codex.js";
import { registerCompareCommands } from "./commands/compare.js";
import { registerContinueCommand } from "./commands/continue.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerEvalCommands } from "./commands/eval.js";
import { registerExportCommands } from "./commands/export.js";
import { registerFinishCommand } from "./commands/finish.js";
import { registerInitCommand } from "./commands/init.js";
import { registerHandoffCommands } from "./commands/handoff.js";
import { registerInboxCommand } from "./commands/inbox.js";
import { registerInspectCommands } from "./commands/inspect.js";
import { registerLogCommands } from "./commands/log.js";
import { registerMemoryCommands } from "./commands/memory.js";
import { registerPackCommands } from "./commands/pack.js";
import { registerPrimeCommand } from "./commands/prime.js";
import { registerProjectCommands } from "./commands/project.js";
import { registerSkillCommands } from "./commands/skill.js";
import { registerWorkerCommands } from "./commands/worker.js";
import { briefopsVersion } from "./version.js";

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("briefops")
    .description("Local-first, token-aware brief compiler for AI coding workflows.")
    .version(briefopsVersion);

  registerInitCommand(program);
  registerDoctorCommand(program);
  registerPrimeCommand(program);
  registerApproveCommand(program);
  registerFinishCommand(program);
  registerContinueCommand(program);
  registerExportCommands(program);
  registerInboxCommand(program);
  registerSkillCommands(program);
  registerProjectCommands(program);
  registerMemoryCommands(program);
  registerBriefCommands(program);
  registerHandoffCommands(program);
  registerCodexCommands(program);
  registerPackCommands(program);
  registerLogCommands(program);
  registerEvalCommands(program);
  registerWorkerCommands(program);
  registerInspectCommands(program);
  registerCompareCommands(program);

  return program;
}

export async function main(argv: string[]): Promise<void> {
  await buildProgram().parseAsync(argv);
}
