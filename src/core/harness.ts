import { BriefOpsError } from "./errors.js";

export type HarnessTaskType =
  | "small-bug-fix"
  | "medium-feature"
  | "large-feature"
  | "refactor"
  | "dependency-upgrade"
  | "ui-change"
  | "test-repair"
  | "production-incident"
  | "documentation-task"
  | "architecture-decision"
  | "exploratory-research"
  | "code-review"
  | "release-preparation";

export type HarnessRoute = {
  taskType: HarnessTaskType;
  label: string;
  spec: string;
  plan: string;
  goalLedger: string;
  findings: string;
  verification: string;
  memoryUpdate: string;
  artifacts: string[];
  exitCriteria: string[];
  finalResponse: string[];
};

export type HarnessRouteResult = {
  task: string;
  route: HarnessRoute;
  inferred: boolean;
  signals: string[];
};

const routeTable: Record<HarnessTaskType, HarnessRoute> = {
  "small-bug-fix": {
    taskType: "small-bug-fix",
    label: "Small bug fix",
    spec: "No",
    plan: "Light",
    goalLedger: "Optional",
    findings: "Yes if debugging",
    verification: "Level 2 targeted test",
    memoryUpdate: "Work log",
    artifacts: ["work log", "targeted verification evidence"],
    exitCriteria: [
      "Root cause or bounded symptom is understood.",
      "Patch is scoped to the failing behavior.",
      "Targeted verification passes or the limitation is explicit."
    ],
    finalResponse: ["changed behavior", "files changed", "targeted verification", "residual risk"]
  },
  "medium-feature": {
    taskType: "medium-feature",
    label: "Medium feature",
    spec: "Light",
    plan: "Yes",
    goalLedger: "Yes",
    findings: "Optional",
    verification: "Level 2 or 3 based on surface area",
    memoryUpdate: "Work log plus decisions",
    artifacts: ["brief spec", "plan", "goal ledger", "verification evidence"],
    exitCriteria: [
      "Acceptance criteria are explicit.",
      "Implementation follows repo conventions.",
      "Relevant tests or checks pass."
    ],
    finalResponse: ["summary", "files changed", "acceptance coverage", "verification", "risks"]
  },
  "large-feature": {
    taskType: "large-feature",
    label: "Large feature",
    spec: "Yes",
    plan: "Yes",
    goalLedger: "Yes",
    findings: "Yes",
    verification: "Level 3 full project verification",
    memoryUpdate: "Decision, project state, handoff",
    artifacts: ["spec", "plan", "tasks", "goal ledger", "findings log", "handoff"],
    exitCriteria: [
      "Spec and task decomposition exist.",
      "All blocking findings are resolved.",
      "Full relevant project verification has evidence."
    ],
    finalResponse: ["feature outcome", "files changed", "verification evidence", "open risks", "handoff"]
  },
  refactor: {
    taskType: "refactor",
    label: "Refactor",
    spec: "No unless behavior changes",
    plan: "Yes",
    goalLedger: "Yes for multi-file",
    findings: "Optional",
    verification: "Level 3 regression verification",
    memoryUpdate: "Work log plus decision if architecture changes",
    artifacts: ["scope boundary", "risk notes", "goal ledger", "regression evidence"],
    exitCriteria: [
      "Behavior-preservation boundary is clear.",
      "Diff is incremental and reviewable.",
      "Regression checks cover touched behavior."
    ],
    finalResponse: ["refactor scope", "behavior preserved", "verification", "risks"]
  },
  "dependency-upgrade": {
    taskType: "dependency-upgrade",
    label: "Dependency upgrade",
    spec: "No",
    plan: "Yes",
    goalLedger: "Yes",
    findings: "Yes if breakage appears",
    verification: "Level 3 full project verification",
    memoryUpdate: "Decision plus work log",
    artifacts: ["upgrade plan", "compatibility notes", "verification evidence"],
    exitCriteria: [
      "Upgrade scope and migration notes are recorded.",
      "Lockfile/package changes are intentional.",
      "Build, tests, and relevant runtime checks pass."
    ],
    finalResponse: ["dependency changes", "migration notes", "verification", "known risks"]
  },
  "ui-change": {
    taskType: "ui-change",
    label: "UI change",
    spec: "Light",
    plan: "Light",
    goalLedger: "Optional",
    findings: "Yes for visual defects",
    verification: "Level 4 visual evidence",
    memoryUpdate: "Work log, decision if design pattern changes",
    artifacts: ["visual target", "screenshot or render evidence", "verification notes"],
    exitCriteria: [
      "UI renders in its natural environment.",
      "Responsive or target viewport behavior is inspected.",
      "Visual evidence backs the completion claim."
    ],
    finalResponse: ["UI outcome", "files changed", "visual evidence", "remaining visual risk"]
  },
  "test-repair": {
    taskType: "test-repair",
    label: "Test repair",
    spec: "No",
    plan: "Light",
    goalLedger: "Optional",
    findings: "Yes if failure cause is uncertain",
    verification: "Level 2 targeted test",
    memoryUpdate: "Work log",
    artifacts: ["failure reproduction", "targeted test output"],
    exitCriteria: [
      "Failure is reproduced or clearly explained.",
      "The test now asserts intended behavior.",
      "Targeted test command passes."
    ],
    finalResponse: ["failure fixed", "tests changed", "verification", "risk of brittleness"]
  },
  "production-incident": {
    taskType: "production-incident",
    label: "Production incident",
    spec: "No",
    plan: "Incident plan",
    goalLedger: "Yes",
    findings: "Yes",
    verification: "Level 4 evidence-based verification",
    memoryUpdate: "Incident, decision, handoff",
    artifacts: ["incident log", "findings log", "mitigation evidence", "handoff"],
    exitCriteria: [
      "Impact and mitigation are explicit.",
      "Blocking findings are tracked.",
      "Verification evidence matches the incident risk."
    ],
    finalResponse: ["impact", "mitigation", "verification evidence", "follow-up risks"]
  },
  "documentation-task": {
    taskType: "documentation-task",
    label: "Documentation task",
    spec: "No",
    plan: "No or light",
    goalLedger: "No",
    findings: "No",
    verification: "Level 0 or 1 static inspection",
    memoryUpdate: "Work log only if durable",
    artifacts: ["doc diff", "link or render check if relevant"],
    exitCriteria: [
      "Docs match current behavior.",
      "Links, examples, or commands are checked when practical."
    ],
    finalResponse: ["doc change", "files changed", "inspection or skipped verification reason"]
  },
  "architecture-decision": {
    taskType: "architecture-decision",
    label: "Architecture decision",
    spec: "Yes",
    plan: "Yes",
    goalLedger: "Optional",
    findings: "Research findings",
    verification: "Level 1 source inspection",
    memoryUpdate: "Decision plus architecture memory",
    artifacts: ["decision record", "tradeoff table", "source evidence"],
    exitCriteria: [
      "Options and tradeoffs are explicit.",
      "Decision is grounded in repo constraints.",
      "Durable rationale is recorded."
    ],
    finalResponse: ["decision", "rationale", "sources", "follow-up implementation step"]
  },
  "exploratory-research": {
    taskType: "exploratory-research",
    label: "Exploratory research",
    spec: "No",
    plan: "Research plan",
    goalLedger: "Optional",
    findings: "Yes",
    verification: "Level 1 source inspection",
    memoryUpdate: "Findings or decision if durable",
    artifacts: ["source notes", "findings", "recommendation"],
    exitCriteria: [
      "Sources are inspected directly.",
      "Confirmed facts and interpretation are separated.",
      "Recommendation names uncertainty."
    ],
    finalResponse: ["findings", "sources", "recommendation", "open questions"]
  },
  "code-review": {
    taskType: "code-review",
    label: "Code review",
    spec: "No",
    plan: "Review plan",
    goalLedger: "Optional",
    findings: "Yes",
    verification: "Level 1 or 2 depending on reviewed change",
    memoryUpdate: "Known issue if durable",
    artifacts: ["findings log", "file and line evidence"],
    exitCriteria: [
      "Findings are actionable and severity-ordered.",
      "No open finding is hidden in the summary.",
      "Verification gaps are explicit."
    ],
    finalResponse: ["findings first", "open questions", "test gaps", "brief summary"]
  },
  "release-preparation": {
    taskType: "release-preparation",
    label: "Release preparation",
    spec: "No",
    plan: "Yes",
    goalLedger: "Yes",
    findings: "Yes",
    verification: "Level 4 evidence-based verification",
    memoryUpdate: "Project state plus handoff",
    artifacts: ["release checklist", "verification evidence", "handoff"],
    exitCriteria: [
      "Release checklist is complete or exceptions are approved.",
      "Build/test/audit evidence is recorded.",
      "Remaining risks and rollback notes are clear."
    ],
    finalResponse: ["release readiness", "checks run", "evidence", "remaining blockers"]
  }
};

const taskTypeAliases: Record<string, HarnessTaskType> = {
  bug: "small-bug-fix",
  fix: "small-bug-fix",
  "small-bug": "small-bug-fix",
  feature: "medium-feature",
  "medium-feature": "medium-feature",
  "large-feature": "large-feature",
  refactor: "refactor",
  dependency: "dependency-upgrade",
  deps: "dependency-upgrade",
  "dependency-upgrade": "dependency-upgrade",
  ui: "ui-change",
  "ui-change": "ui-change",
  test: "test-repair",
  "test-repair": "test-repair",
  incident: "production-incident",
  "production-incident": "production-incident",
  docs: "documentation-task",
  documentation: "documentation-task",
  "documentation-task": "documentation-task",
  architecture: "architecture-decision",
  adr: "architecture-decision",
  "architecture-decision": "architecture-decision",
  research: "exploratory-research",
  "exploratory-research": "exploratory-research",
  review: "code-review",
  "code-review": "code-review",
  release: "release-preparation",
  "release-preparation": "release-preparation"
};

export function harnessRoutes(): HarnessRoute[] {
  return Object.values(routeTable);
}

export function normalizeHarnessTaskType(value: string): HarnessTaskType {
  const key = value.trim().toLowerCase().replace(/_/g, "-");
  const taskType = taskTypeAliases[key];
  if (!taskType) {
    throw new BriefOpsError(`Unknown harness task type: ${value}`);
  }

  return taskType;
}

function matchTask(task: string): { taskType: HarnessTaskType; signals: string[] } {
  const text = task.toLowerCase();
  const checks: Array<[HarnessTaskType, RegExp, string]> = [
    ["production-incident", /\b(prod|production|incident|outage|rollback|hotfix|sev[0-9])\b/, "incident signal"],
    ["release-preparation", /\b(release|ship|publish|npm pack|changelog|version bump|cut a release)\b/, "release signal"],
    ["code-review", /\b(review|audit|pr|pull request|diff)\b/, "review signal"],
    ["dependency-upgrade", /\b(upgrade|bump|dependency|dependencies|lockfile|package-lock|npm update|pnpm update|yarn upgrade)\b/, "dependency signal"],
    ["ui-change", /\b(ui|visual|css|style|layout|responsive|screenshot|frontend|component)\b/, "ui signal"],
    ["test-repair", /\b(test failure|failing test|flake|vitest|jest|pytest|unit test|integration test)\b/, "test signal"],
    ["refactor", /\b(refactor|cleanup|restructure|rename|extract|split)\b/, "refactor signal"],
    ["architecture-decision", /\b(architecture|adr|design decision|tradeoff|system design)\b/, "architecture signal"],
    ["exploratory-research", /\b(research|investigate|compare|evaluate|look up|survey)\b/, "research signal"],
    ["documentation-task", /\b(docs|documentation|readme|guide|manual)\b/, "documentation signal"],
    ["large-feature", /\b(large feature|new module|major feature|multi-phase|end-to-end)\b/, "large feature signal"],
    ["medium-feature", /\b(feature|add support|implement|build)\b/, "feature signal"],
    ["small-bug-fix", /\b(bug|fix|broken|error|crash|regression)\b/, "bug signal"]
  ];

  for (const [taskType, pattern, signal] of checks) {
    if (pattern.test(text)) {
      return { taskType, signals: [signal] };
    }
  }

  return { taskType: "medium-feature", signals: ["default medium-feature route"] };
}

export function routeHarnessTask(options: {
  task: string;
  taskType?: string;
}): HarnessRouteResult {
  const task = options.task.trim();
  if (!task) {
    throw new BriefOpsError("Harness routing requires --task.");
  }

  if (options.taskType) {
    const taskType = normalizeHarnessTaskType(options.taskType);
    return {
      task,
      route: routeTable[taskType],
      inferred: false,
      signals: ["explicit task type"]
    };
  }

  const matched = matchTask(task);
  return {
    task,
    route: routeTable[matched.taskType],
    inferred: true,
    signals: matched.signals
  };
}

export function renderHarnessRoute(result: HarnessRouteResult): string {
  return [
    "# BriefOps Harness Route",
    "",
    `Task: ${result.task}`,
    `Route: ${result.route.label}${result.inferred ? " (inferred)" : ""}`,
    `Signals: ${result.signals.join(", ")}`,
    "",
    "## Workflow Depth",
    "",
    `- Spec: ${result.route.spec}`,
    `- Plan: ${result.route.plan}`,
    `- Goal ledger: ${result.route.goalLedger}`,
    `- Findings: ${result.route.findings}`,
    `- Verification: ${result.route.verification}`,
    `- Memory update: ${result.route.memoryUpdate}`,
    "",
    "## Required Artifacts",
    "",
    ...result.route.artifacts.map((artifact) => `- ${artifact}`),
    "",
    "## Exit Criteria",
    "",
    ...result.route.exitCriteria.map((criterion) => `- ${criterion}`),
    "",
    "## Final Response Must Include",
    "",
    ...result.route.finalResponse.map((item) => `- ${item}`),
    ""
  ].join("\n");
}
