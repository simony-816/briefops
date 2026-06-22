# Release Checklist

Before publishing BriefOps:

```bash
npm run build
npm test
npm audit --audit-level=moderate
npm pack --dry-run
npm run verify:release
briefops --help
npm whoami
```

`npm audit --audit-level=moderate` is included in `npm run verify:release`. It contacts the npm registry and sends dependency/audit metadata, so run it only from an environment where that network disclosure is acceptable.

Manual smoke test:

```bash
tmpdir="$(mktemp -d)"
cd "$tmpdir"
briefops init
briefops codex install
briefops codex plugin install
briefops skill create risk-review
briefops project create atlas-q
briefops worker create quant-reviewer --project atlas-q --skills risk-review
briefops worker use quant-reviewer
briefops export agents-md --force
briefops export claude-md --force
briefops export cursor-rules --force
briefops prime --task "Start this task." --format codex --max-tokens 800
briefops compare context --worker quant-reviewer --task "Start this task."
briefops obs continuity --worker quant-reviewer --task "Start this task." --json
briefops doctor --stability
briefops doctor --security
briefops doctor --security --fix-stale-locks
briefops doctor --privacy
briefops doctor --strict --json
briefops harness route --task "Review work"
briefops harness matrix
briefops finish --worker quant-reviewer --project atlas-q --skill risk-review --task "Review work" --result "Found unresolved risk." --lesson "Check unresolved risk before finishing." --importance durable
briefops finish --worker quant-reviewer --project atlas-q --skill risk-review --task "Review pending memory path" --result "Created review proposal." --decision "Use review mode only when a pending queue is explicitly desired." --memory-review
briefops memory proposal-apply latest
briefops finish --worker quant-reviewer --task "Fix typo" --result "Fixed typo." --importance trivial
briefops memory hygiene
briefops memory prune --dry-run
```

Confirm:

- `briefops --version` matches `package.json`.
- `docs/file-format.md`, `docs/compatibility.md`, and `docs/privacy-model.md` describe the 2.1 public behavior and current workspace file contract.
- `briefops harness route` returns the workflow depth, artifacts, exit criteria, and final-response contract for the task.
- `briefops obs continuity` reports compression, continuity, queues, and memory hygiene counts without dumping private memory.
- Harness exports are routers, not memory dumps.
- `shared-only` exports omit private memory, local project file details, raw work logs, open risks, local next steps, private worker history, and private metadata counts.
- `finish` applies directory-local durable memory by default, while skill patches still require explicit direction.
- `finish --importance trivial` and `finish --no-memory-proposal` avoid durable memory proposals.
- `memory hygiene` and `memory prune --dry-run` do not mutate memory.
- Memory items and proposals can carry optional evidence anchors without breaking older memory files.
- Proposal generation and application are local file-backed operations protected by workspace locks.
- `doctor --stability` is read-only, bounds detailed examples, and does not add diagnostics to generated prompt artifacts.
- `doctor --security --fix-stale-locks` removes stale locks only.
- `doctor --strict --json` reports `releaseReady: false` when any release-readiness warning or failure remains.
- Explicit output paths do not overwrite without `--force`.
- Generated Codex plugin files do not overwrite local changes without `--force`.
- `.briefops/` is ignored or intentionally curated.
- `npm pack --dry-run` includes docs, examples, plugins, dist, README, LICENSE, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, and CHANGELOG.

Publish:

```bash
git status --short --branch
git tag v<version>
git push origin HEAD
git push origin v<version>
npm publish
```
