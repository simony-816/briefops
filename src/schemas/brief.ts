export type TokenReportLine = {
  label: string;
  used: number;
  budget: number;
};

export type GeneratedBrief = {
  content: string;
  warnings: string[];
  report: TokenReportLine[];
  totalTokens: number;
  budget: number;
};
