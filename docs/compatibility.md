# BriefOps 1.0 Compatibility Policy

BriefOps follows semantic versioning for the public CLI and local file formats.

## Stable In 1.0

- Public commands documented in `README.md`.
- `.briefops/` source file formats documented in `docs/file-format.md`.
- `shared-only` and `local-private` export policy names.
- Human-approved memory proposal and skill patch flow.
- Workspace lock behavior for local write operations.
- Harness router export targets: `agents-md`, `claude-md`, `cursor-rules`, and `all`.

## Compatible Changes

Minor and patch releases may:

- Add optional fields with safe defaults.
- Add new commands or flags.
- Add new generated artifact sections.
- Improve deterministic selection, trimming, and warnings.
- Add new doctor checks that warn without rewriting user data.

## Breaking Changes

Breaking changes require a new major version. Examples:

- Removing or renaming stable CLI commands or flags.
- Changing required fields in documented `.briefops/` source formats.
- Changing `shared-only` so it includes private local content or private metadata counts.
- Auto-applying memory proposals or skill patches.
- Requiring a hosted service, network dependency, agent runtime, MCP server, vector database, or cloud sync.

## Workspace Version Support

New 1.0 workspaces write `version: 1.0.0` in `.briefops/config.yaml`.

BriefOps 1.0 can read legacy `0.x` workspace configs on a best-effort compatibility basis. Future `2.x` workspace configs fail with an explicit upgrade error instead of silently reading incompatible data.

## Migration Policy

BriefOps does not rewrite workspace data during normal reads. Commands that mutate user data are explicit, local, file-backed, and protected by workspace locks.

If a future release needs a migration, it must provide:

- a documented command or manual procedure,
- dry-run or inspection guidance,
- no automatic approval of memory or skill patches,
- tests covering old fixtures.
