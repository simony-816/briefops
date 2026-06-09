import { BriefOpsError } from "./errors.js";

export const workspaceSchemaVersion = "1.0.0";

function parseMajorVersion(version: string): number | undefined {
  const match = version.trim().match(/^(\d+)(?:\.|$)/);
  return match ? Number(match[1]) : undefined;
}

export function assertCompatibleWorkspaceVersion(version: string): void {
  const major = parseMajorVersion(version);
  if (major === undefined) {
    throw new BriefOpsError(`Invalid BriefOps workspace version: ${version}`);
  }
  if (major > 1) {
    throw new BriefOpsError(
      `Unsupported BriefOps workspace version: ${version}. Upgrade BriefOps before using this workspace.`
    );
  }
}
