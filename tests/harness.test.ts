import { describe, expect, it } from "vitest";
import {
  harnessRoutes,
  renderHarnessRoute,
  routeHarnessTask
} from "../src/core/harness.js";

describe("Master Harness routing", () => {
  it("prints all MVP routing categories", () => {
    expect(harnessRoutes().map((route) => route.taskType)).toEqual([
      "small-bug-fix",
      "medium-feature",
      "large-feature",
      "refactor",
      "dependency-upgrade",
      "ui-change",
      "test-repair",
      "production-incident",
      "documentation-task",
      "architecture-decision",
      "exploratory-research",
      "code-review",
      "release-preparation"
    ]);
  });

  it("routes UI work to visual evidence", () => {
    const result = routeHarnessTask({
      task: "Update the dashboard layout and verify the responsive UI."
    });

    expect(result.route.taskType).toBe("ui-change");
    expect(result.route.verification).toContain("Level 4");
    expect(result.route.artifacts).toContain("screenshot or render evidence");
  });

  it("allows explicit task type overrides", () => {
    const result = routeHarnessTask({
      task: "Fix typo in release notes.",
      taskType: "release"
    });

    expect(result.inferred).toBe(false);
    expect(result.route.taskType).toBe("release-preparation");
  });

  it("renders a human-readable workflow contract", () => {
    const result = routeHarnessTask({
      task: "Investigate a failing test.",
      taskType: "test-repair"
    });
    const rendered = renderHarnessRoute(result);

    expect(rendered).toContain("# BriefOps Harness Route");
    expect(rendered).toContain("Route: Test repair");
    expect(rendered).toContain("Final Response Must Include");
  });
});
