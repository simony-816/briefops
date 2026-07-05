# BriefOps Utility Log: Harness Continuity

date: 2026-07-05
evaluator: maintainer example
project: briefops
task: Continue Master Harness product review in a fresh Codex thread.
fresh thread?: yes
BriefOps commands used:
- `briefops harness route --task "Review BriefOps 2.1.x product improvement opportunities."`
- `briefops prime --format codex --task "Review BriefOps 2.1.x product improvement opportunities." --max-tokens 800`
- `briefops obs continuity --worker briefops-maintainer --task "Review BriefOps 2.1.x product improvement opportunities." --json`

## Context Evidence

raw candidate context: observed through `obs continuity`
prime context: compact Codex-format context under the requested budget
compression ratio: copy from `obs continuity` when running the example
route: code-review or exploratory-research, depending on exact task wording

## Reuse Evidence

reused decisions:
- Missing `briefops` on PATH should be `Status: setup-required`.
- BriefOps should preserve local-first memory and avoid becoming an agent runtime.

reused lessons:
- Keep plugin cache and local plugin path synchronized during release work.

reused risks:
- npm publish may remain blocked by npm authentication.

reused next steps:
- Verify release-readiness behavior before publishing.

reused commands:
- `briefops prime --format codex --task "<task>" --max-tokens 800`
- `briefops continue --worker briefops-maintainer --task "<task>" --pack`

## Missing Or Repeated Context

what was still missing:
- Whether the previous route classification was correct for a product-review task.

repeated explanations:
- The reviewer still had to restate the product boundary from the user prompt.

repeated rejected approaches:
- MCP server, dashboard, database, vector search, and cloud sync remained out of scope.

## Scores

continuity score: 2
relevance score: 3
noise score: 1
estimated time saved: 10 minutes, hypothesis

## Notes

Prime carried release and setup context well. The product boundary still came
from the task prompt, which is appropriate because it is user-specified scope.

## Follow-Up

promote to memory?: no
adjust docs or examples?: yes
possible product improvement: Add a lightweight utility log so this judgment is repeatable.
