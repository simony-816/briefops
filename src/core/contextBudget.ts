export const defaultContextBudgets = {
  exportAgentsMd: 500,
  exportClaudeMd: 700,
  exportCursorRule: 350,
  exportCursorTotal: 1200,
  prime: 800,
  handoff: 2500,
  resumePack: 3000
} as const;

export type BudgetStatus = "ok" | "warn" | "over";

export function budgetStatus(used: number, budget: number): BudgetStatus {
  if (used <= budget) {
    return "ok";
  }
  if (used <= Math.ceil(budget * 1.6)) {
    return "warn";
  }
  return "over";
}

export function formatBudgetLine(label: string, used: number, budget: number): string {
  return `${label}: ${used} / ${budget} tokens (${budgetStatus(used, budget)})`;
}
