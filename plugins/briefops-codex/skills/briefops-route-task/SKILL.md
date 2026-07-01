---
name: briefops-route-task
description: Use when starting Codex development work to classify the task and choose the smallest sufficient BriefOps Master Harness workflow
---

# BriefOps Route Task

The BriefOps plugin is a local CLI helper. It does not require network access and does not publish to a marketplace.

Before any BriefOps command, run `command -v briefops`. If `briefops` is not on `PATH`, stop and report `Status: setup-required`. Do not continue by silently skipping BriefOps. Ask the user to install `briefops`, use `npx briefops@latest`, or explicitly continue from an already supplied Brief/Spec/Plan.

BriefOps may update directory-local `.briefops/` memory. Use `--export-policy shared-only` before copying context outside the local workspace, and ask before applying skill patches.

Use this before implementation when the task may need memory, specification, planning, findings, verification, or handoff discipline.

Run:

```bash
briefops harness route --task "<current user task>"
```

For explicit routing, pass a task type:

```bash
briefops harness route --task "<current user task>" --type large-feature
```

Use the route as a workflow contract:

- Do not force full specification on tiny tasks.
- Do not skip goal ledgers, findings, visual evidence, or handoff when the route requires them.
- If repository evidence contradicts the inferred route, choose the safer route and say why.
- Treat `briefops prime` as the memory intake step and `briefops finish` as the work-log/memory closeout step.

Supported task types: small-bug-fix, medium-feature, large-feature, refactor, dependency-upgrade, ui-change, test-repair, production-incident, documentation-task, architecture-decision, exploratory-research, code-review, release-preparation.
