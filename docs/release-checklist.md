# Release Checklist

Before publishing BriefOps:

```bash
npm run build
npm test
npm audit --audit-level=moderate
npm pack --dry-run
npm run verify:release
briefops --help
```

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
briefops prime --task "Start this task." --format codex --max-tokens 800
briefops doctor --security
briefops doctor --security --fix-stale-locks
briefops doctor --privacy
```

Confirm:

- `shared-only` exports omit private memory, local project file details, raw work logs, open risks, local next steps, private worker history, and private metadata counts.
- Memory and skill patches require human approval.
- Proposal generation and approval are local file-backed operations protected by workspace locks.
- `doctor --security --fix-stale-locks` removes stale locks only.
- Explicit output paths do not overwrite without `--force`.
- Generated Codex plugin files do not overwrite local changes without `--force`.
- `.briefops/` is ignored or intentionally curated.
- `npm pack --dry-run` includes docs, examples, plugins, dist, README, LICENSE, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, and CHANGELOG.
