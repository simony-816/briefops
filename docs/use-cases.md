# Use Cases

BriefOps helps developers keep useful AI coding context across fresh threads without turning the repository into a context dump.

Use it when a task depends on prior decisions, recent work, project-specific constraints, or open risks that should survive beyond one chat session.

## Fresh Thread Priming

Use `prime` at the start of a new AI coding thread when the agent needs project context before reading broadly.

```bash
briefops prime --task "Continue the release readiness review." --format codex --max-tokens 800
```

This is useful for:

- starting a new thread with a compact project and worker summary
- avoiding a manual paste of old chat history
- keeping the first context small enough to inspect
- applying the same worker style across related tasks

Use a resume pack only when the next thread needs more continuity than `prime` should carry:

```bash
briefops continue --worker repo-worker --task "Continue the release readiness review." --pack
```

## Pull Request Review

Use BriefOps when a review has findings, follow-up checks, or risks that may outlive the current thread.

```bash
briefops harness route --task "Review this pull request." --type code-review
briefops prime --task "Review this pull request." --format codex --max-tokens 800
```

After review work finishes, record the result and any unresolved risk:

```bash
briefops finish \
  --worker repo-worker \
  --task "Review this pull request." \
  --result "Found a blocking regression in the release readiness path." \
  --open-risk "Strict doctor JSON output still needs targeted verification." \
  --next-step "Run the strict doctor check and update the review."
```

This keeps the next review thread focused on unresolved work instead of rediscovering the same findings.

## Release Readiness

Use BriefOps for release work when commands, package contents, privacy checks, and remaining blockers need a durable trail.

```bash
briefops harness route --task "Prepare this release." --type release-preparation
npm run build
npm test
briefops doctor --strict --json
npm pack --dry-run
```

Then close the loop:

```bash
briefops finish \
  --worker repo-worker \
  --task "Prepare this release." \
  --result "Build, tests, strict doctor, and dry-run package review completed." \
  --decision "Release package contents are ready for publish." \
  --commands "npm run build,npm test,briefops doctor --strict --json,npm pack --dry-run"
```

Run commands that contact external registries only from an environment where that disclosure is acceptable.

## Long-Running Maintenance

Use workers and memory when cleanup, dependency work, or refactors span multiple sessions.

```bash
briefops skill create repo-review \
  --description "Review maintenance work for regressions, stale assumptions, and release risk."

briefops project create briefops \
  --description "Local-first CLI for AI coding agent context continuity."

briefops worker create repo-worker \
  --project briefops \
  --skills "repo-review" \
  --style "small scoped diffs, verify before completion, record durable decisions"

briefops worker use repo-worker
```

During the work:

```bash
briefops obs continuity --worker repo-worker --task "Continue dependency cleanup." --json
briefops prime --worker repo-worker --task "Continue dependency cleanup." --format codex --max-tokens 800
```

Record only reusable knowledge as durable memory. Use low-importance or no-memory paths for one-off exploration:

```bash
briefops finish --task "Fix typo" --result "Fixed typo." --importance trivial
briefops finish --task "Try discarded approach" --result "Discarded." --no-memory-proposal
```

## Incident Follow-Up

Use the incident route when a regression, outage, or release blocker needs findings, mitigation evidence, and a follow-up trail.

```bash
briefops harness route --task "Investigate the release regression." --type production-incident
briefops prime --task "Investigate the release regression." --format codex --max-tokens 800
```

After mitigation:

```bash
briefops finish \
  --worker repo-worker \
  --task "Investigate the release regression." \
  --result "Mitigated the failing package check." \
  --incident "Release dry-run failed because generated files were missing from dist." \
  --decision "Release verification must include npm pack dry-run before publish." \
  --next-step "Add the package check to the release checklist."
```

## Privacy-Safe Sharing

Use `shared-only` when generated context may leave the local workspace.

```bash
briefops prime --task "Review this pull request." --format codex --export-policy shared-only
briefops pack resume --worker repo-worker --task "Continue the review." --export-policy shared-only
```

`shared-only` includes only memory marked `visibility: shared` and `exportable: true`. It omits private memory, raw work logs, open risks, local next steps, private worker history, incidents, and private metadata counts.

Before publishing a repository or sharing generated context, run:

```bash
briefops doctor --privacy
briefops doctor --stability
briefops doctor --strict --json
```

Router exports are safe to commit when reviewed because they point tools at BriefOps commands instead of copying `.briefops/` memory:

```bash
briefops export all
```
