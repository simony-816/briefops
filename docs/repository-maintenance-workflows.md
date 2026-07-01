# Repository Maintenance Workflows

BriefOps supports recurring repository maintenance work: issue triage, pull request review, release preparation, incident follow-up, documentation updates, dependency changes, and long-running cleanup.

The workflow pattern is simple:

```text
prime -> route -> work -> verify -> finish -> continue when needed
```

Use durable memory for decisions, lessons, incidents, and recurring project constraints. Keep transient notes in work logs or out of memory entirely.

## Workspace Setup

Create a repository-oriented skill, project, and worker once per repository.

```bash
briefops bootstrap

briefops skill create repo-review \
  --description "Review repository work for regressions, release risk, privacy boundaries, and missing verification." \
  --tags "maintenance,review,release"

briefops project create briefops \
  --description "Local-first CLI for AI coding agent context continuity." \
  --tags "cli,local-first,ai-agents"

briefops worker create repo-worker \
  --project briefops \
  --skills "repo-review" \
  --style "verify before completion, keep changes scoped, record durable decisions"

briefops worker use repo-worker
```

Check the workspace before relying on it:

```bash
briefops doctor --privacy
briefops doctor --stability
briefops inspect budget
```

## Issue Triage

Use this workflow when bugs, support requests, or feature proposals need project context.

```bash
briefops prime --worker repo-worker --task "Triage new issues." --format codex --max-tokens 800
briefops harness route --task "Triage new issues."
```

During triage, record only facts that will help future work:

```bash
briefops finish \
  --worker repo-worker \
  --task "Triage new issues." \
  --result "Confirmed one reproducible CLI regression and one duplicate support request." \
  --lesson "Ask for command output and BriefOps version before diagnosing CLI setup failures." \
  --next-step "Reproduce the regression in a temporary workspace."
```

Good durable memory candidates:

- supported version boundaries
- common duplicate reports
- required reproduction details
- recurring release or privacy pitfalls

## Pull Request Review

Use the review route when work needs actionable findings, severity ordering, and explicit verification gaps.

```bash
briefops harness route --task "Review this pull request." --type code-review
briefops prime --worker repo-worker --task "Review this pull request." --format codex --max-tokens 800
```

After review, preserve the next useful step:

```bash
briefops finish \
  --worker repo-worker \
  --task "Review this pull request." \
  --result "Found one blocking issue and one missing test." \
  --open-risk "The workspace-lock path is not covered by a regression test." \
  --next-step "Request a targeted regression test before merge."
```

If review needs to continue in another thread:

```bash
briefops continue \
  --worker repo-worker \
  --task "Finish unresolved PR review checks." \
  --pack
```

## Release Preparation

Use the release route when a task needs evidence across build, test, package contents, privacy checks, and release notes.

```bash
briefops harness route --task "Prepare this release." --type release-preparation
npm run build
npm test
briefops doctor --strict --json
npm pack --dry-run
```

If dependency audit or registry checks are part of the release, run them only from an environment where registry metadata disclosure is acceptable:

```bash
npm audit --audit-level=moderate
npm view briefops versions --json
```

Record the release outcome:

```bash
briefops finish \
  --worker repo-worker \
  --task "Prepare this release." \
  --result "Release verification completed with no blocking failures." \
  --decision "The package is ready for publish after version confirmation." \
  --commands "npm run build,npm test,briefops doctor --strict --json,npm pack --dry-run"
```

Use [Release Checklist](release-checklist.md) for the full local release gate.

## Dependency And Refactor Work

Use routing before broad maintenance changes so the next thread can see the intended depth.

```bash
briefops harness route --task "Upgrade dependencies and verify compatibility." --type dependency-upgrade
briefops harness route --task "Refactor memory proposal handling." --type refactor
```

Before ending a session, record the behavior boundary and verification:

```bash
briefops finish \
  --worker repo-worker \
  --task "Refactor memory proposal handling." \
  --result "Separated proposal formatting from application without changing public CLI behavior." \
  --decision "Keep proposal application file-backed and protected by workspace locks." \
  --commands "npm run build,npm test"
```

Durable memory should explain the reusable rule, not the mechanics of every edit.

## Documentation Maintenance

Use the documentation route when updating README, guides, or examples.

```bash
briefops harness route --task "Update documentation for release readiness." --type documentation-task
briefops prime --worker repo-worker --task "Update documentation for release readiness." --format codex --max-tokens 800
```

Before finishing, check that commands and links match current behavior:

```bash
briefops finish \
  --worker repo-worker \
  --task "Update documentation for release readiness." \
  --result "Updated release readiness documentation and linked related guides." \
  --commands "rg \"doctor --strict|verify:release\" README.md docs"
```

## Incident Follow-Up

Use the incident route for regressions, broken releases, privacy hazards, or any failure that needs explicit mitigation evidence.

```bash
briefops harness route --task "Investigate the package release failure." --type production-incident
briefops prime --worker repo-worker --task "Investigate the package release failure." --format codex --max-tokens 800
```

Close with an incident, decision, and next step:

```bash
briefops finish \
  --worker repo-worker \
  --task "Investigate the package release failure." \
  --result "Identified missing dist files in the dry-run package." \
  --incident "Release candidate omitted generated dist output." \
  --decision "Run npm pack dry-run after build and before publish." \
  --next-step "Update release checklist and rerun package verification."
```

## Sharing Repository Context

Keep `.briefops/` local unless the contents are intentionally curated.

Use `shared-only` for context that may be pasted, attached, or committed:

```bash
briefops prime --worker repo-worker --task "Review this pull request." --format codex --export-policy shared-only
briefops pack resume --worker repo-worker --task "Continue review." --export-policy shared-only
```

Router exports point tools at BriefOps commands and do not copy local memory:

```bash
briefops export agents-md
briefops export claude-md
briefops export cursor-rules
```

Before publishing or sharing generated context:

```bash
briefops doctor --privacy
briefops doctor --strict --json
```
