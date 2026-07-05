# BriefOps Utility Log

Use this local log to judge whether BriefOps made one real task easier to
continue. It is intentionally manual. Do not add telemetry, cloud analytics,
databases, dashboards, or automatic scoring until repeated logs show a concrete
need.

The goal is to capture evidence for practical utility:

- Did BriefOps reduce re-explanation?
- Did it preserve prior decisions, lessons, risks, next steps, and commands?
- Did it produce a better fresh-thread handoff?
- Did routing avoid unnecessary process while still improving verification?

Use one entry per task or fresh-thread continuation. Keep examples short enough
that a maintainer can review them in a few minutes.

## Suggested Local Checks

Run only the checks that fit the task:

```bash
briefops harness route --task "<task>"
briefops prime --format codex --task "<task>" --max-tokens 800
briefops obs continuity --worker <worker> --task "<task>" --json
briefops finish --worker <worker> --task "<task>" --result "<result>"
briefops continue --worker <worker> --task "<next task>" --pack
```

For context-size evidence, prefer `briefops obs continuity`. For broader impact
claims such as token savings, use `docs/impact-report.md` and label anything
without measured evidence as estimated or unmeasured.

## Scoring

Use simple 0 to 3 scores.

Continuity score:

- 0: Fresh thread still needed full re-explanation.
- 1: Some useful context survived, but major decisions or risks were missing.
- 2: Fresh thread could continue with minor clarification.
- 3: Fresh thread could continue without repeating important context.

Relevance score:

- 0: Mostly unrelated context.
- 1: Mixed; useful items were buried in unrelated material.
- 2: Mostly relevant with a little harmless extra context.
- 3: Compact and directly useful for the task.

Noise score:

- 0: No meaningful noise.
- 1: Minor extra context.
- 2: Noticeable bloat or duplicate context.
- 3: Noise likely slowed the task or risked confusion.

Estimated time saved:

- Use minutes.
- Write `unmeasured` when there is no credible estimate.
- Mark estimates as hypotheses unless compared with a similar no-BriefOps run.

## Template

```markdown
# BriefOps Utility Log

date:
evaluator:
project:
task:
fresh thread?: yes/no
BriefOps commands used:
- 

## Context Evidence

raw candidate context:
prime context:
compression ratio:
route:

## Reuse Evidence

reused decisions:
- 

reused lessons:
- 

reused risks:
- 

reused next steps:
- 

reused commands:
- 

## Missing Or Repeated Context

what was still missing:
- 

repeated explanations:
- 

repeated rejected approaches:
- 

## Scores

continuity score:
relevance score:
noise score:
estimated time saved:

## Notes


## Follow-Up

promote to memory?: yes/no
adjust docs or examples?: yes/no
possible product improvement:
```

## Review Cadence

After 5 to 10 logs, review them manually and look for repeated patterns:

- Missing decisions suggest finish or memory extraction wording needs work.
- Missing risks suggest handoff and prime sections need stronger risk selection.
- High noise suggests memory hygiene, quotas, or examples need tightening.
- Repeated over-routing suggests route wording or classification needs tuning.
- Repeated under-routing suggests route risk signals need clearer escalation.

Treat each pattern as a hypothesis until at least two or three logs show it.
