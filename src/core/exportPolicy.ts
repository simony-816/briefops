import { BriefOpsError } from "./errors.js";
import type { MemoryItem } from "../schemas/memory.js";

export type ExportPolicy = "local-private" | "shared-only";

export const defaultExportPolicy: ExportPolicy = "local-private";

export const sharedOnlyOmissionNote =
  "Shared-only export policy is active. Private local memory, raw work logs, open risks, local next steps, and private worker history are omitted.";

export function normalizeExportPolicy(value?: string): ExportPolicy {
  const policy = (value ?? defaultExportPolicy).trim().toLowerCase();
  if (policy === "local-private" || policy === "shared-only") {
    return policy;
  }

  throw new BriefOpsError(`Invalid export policy: ${value}`);
}

export function isSharedExportableMemory(item: MemoryItem): boolean {
  return item.visibility === "shared" && item.exportable === true;
}

export function filterMemoryForExport(
  items: MemoryItem[],
  exportPolicy: ExportPolicy
): MemoryItem[] {
  return exportPolicy === "shared-only" ? items.filter(isSharedExportableMemory) : items;
}
