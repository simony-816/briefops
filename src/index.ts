#!/usr/bin/env node
import { main } from "./cli.js";
import { BriefOpsError } from "./core/errors.js";

main(process.argv).catch((error: unknown) => {
  if (error instanceof BriefOpsError) {
    console.error(`Error: ${error.message}`);
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }

  process.exitCode = 1;
});
