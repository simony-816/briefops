# Contributing

Thanks for improving BriefOps.

BriefOps is intentionally small:

- local-first
- file-backed
- deterministic
- human-approved
- token-aware
- no hosted service required
- no MCP server required

## Development Setup

```bash
npm install
npm run build
npm test
```

Run the CLI during development:

```bash
npm run dev -- --help
```

## Required Checks

Before opening a pull request:

```bash
npm run build
npm test
npm pack --dry-run
```

## Safety Rules

- Never auto-approve memory proposals or skill patches.
- Do not introduce hosted services, cloud sync, vector databases, or MCP as required runtime dependencies.
- Keep private local memory out of shared exports unless it is explicitly marked `visibility: shared` and `exportable: true`.
- Prefer small deterministic file-backed changes over agent runtime behavior.

## Pull Request Style

Include:

- What changed
- Why it matters for local-first continuity
- Tests run
- Any privacy or export-policy impact
