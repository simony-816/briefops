import { Command } from "commander";
import { registerBriefCommands } from "./commands/brief.js";
import { registerCodexCommands } from "./commands/codex.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerEvalCommands } from "./commands/eval.js";
import { registerInitCommand } from "./commands/init.js";
import { registerInspectCommands } from "./commands/inspect.js";
import { registerLogCommands } from "./commands/log.js";
import { registerMemoryCommands } from "./commands/memory.js";
import { registerProjectCommands } from "./commands/project.js";
import { registerSkillCommands } from "./commands/skill.js";
import { registerWorkerCommands } from "./commands/worker.js";

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("briefops")
    .description("Local-first, token-aware brief compiler for AI coding workflows.")
    .version("0.1.0");

  registerInitCommand(program);
  registerDoctorCommand(program);
  registerSkillCommands(program);
  registerProjectCommands(program);
  registerMemoryCommands(program);
  registerBriefCommands(program);
  registerCodexCommands(program);
  registerLogCommands(program);
  registerEvalCommands(program);
  registerWorkerCommands(program);
  registerInspectCommands(program);

  return program;
}

export async function main(argv: string[]): Promise<void> {
  await buildProgram().parseAsync(argv);
}
