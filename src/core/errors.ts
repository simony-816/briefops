export class BriefOpsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BriefOpsError";
  }
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new BriefOpsError(message);
  }
}
