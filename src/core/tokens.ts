export function estimateTokens(value: string): number {
  if (value.length === 0) {
    return 0;
  }

  return Math.ceil(value.length / 4);
}

export function truncateToTokenBudget(
  value: string,
  maxTokens: number
): { text: string; trimmed: boolean } {
  if (maxTokens <= 0) {
    return { text: "", trimmed: value.length > 0 };
  }

  if (estimateTokens(value) <= maxTokens) {
    return { text: value, trimmed: false };
  }

  const suffix = "\n\n[Trimmed to fit token budget.]";
  const maxChars = Math.max(1, maxTokens * 4 - suffix.length);
  const slice = value.slice(0, maxChars);
  const boundary = slice.lastIndexOf("\n") > 80 ? slice.lastIndexOf("\n") : slice.lastIndexOf(" ");
  const trimmed = slice.slice(0, boundary > 40 ? boundary : maxChars).trimEnd();

  return {
    text: `${trimmed}${suffix}`,
    trimmed: true
  };
}
