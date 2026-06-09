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
briefops doctor --security
briefops doctor --security --fix-stale-locks
briefops doctor --privacy
briefops finish --worker quant-reviewer --project atlas-q --skill risk-review --task "Review work" --result "Found unresolved risk." --lesson "Check unresolved risk before finishing." --importance durable
briefops approve latest
briefops finish --worker quant-reviewer --task "Fix typo" --result "Fixed typo." --importance trivial
briefops memory hygiene
briefops memory prune --dry-run
```

Confirm:

- `briefops --version` matches `package.json`.
- `docs/file-format.md`, `docs/compatibility.md`, and `docs/privacy-model.md` describe the 1.0 public contract.
- Harness exports are routers, not memory dumps.
- `shared-only` exports omit private memory, local project file details, raw work logs, open risks, local next steps, private worker history, and private metadata counts.
- Memory and skill patches require human approval.
- `finish --importance trivial` and `finish --no-memory-proposal` avoid durable memory proposals.
- `memory hygiene` and `memory prune --dry-run` do not mutate memory.
- Proposal generation and approval are local file-backed operations protected by workspace locks.
- `doctor --security --fix-stale-locks` removes stale locks only.
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
