import { describe, expect, it } from "vitest";
import { estimateTokens, truncateToTokenBudget } from "../src/core/tokens.js";

describe("token estimation", () => {
  it("estimates tokens with a character-count approximation", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });

  it("truncates text to a token budget", () => {
    const result = truncateToTokenBudget("x".repeat(100), 10);

    expect(result.trimmed).toBe(true);
    expect(result.text).toContain("Trimmed to fit token budget");
  });
});
