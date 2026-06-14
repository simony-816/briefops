# BriefOps Codex Plugin

This is a skill-only Codex plugin bundle for BriefOps.

It does not run a hosted service and does not sync data. The skills call the local `briefops` CLI and local `.briefops/` workspace.
It does not publish to a marketplace and does not write to global Codex folders by default.

The BriefOps plugin is a local CLI helper. It does not require network access and does not publish to a marketplace. It may update directory-local `.briefops/` memory; use `--export-policy shared-only` before copying context outside the local workspace, and ask before applying skill patches.

Recommended local setup:

```bash
briefops bootstrap
briefops worker use <worker>
briefops prime --task "Start this task." --format codex
```

`briefops bootstrap` initializes `.briefops/`, installs `AGENTS.md` first-context guidance, writes local Codex prompt/plugin assets, keeps `.briefops/` ignored by default, and runs bounded privacy/stability checks.

The generated local plugin copy is written to:

```text
.briefops/codex/plugin/briefops
```

BriefOps plugin skills treat `.briefops/` memory as local repo state. Explicit confirmation is reserved for exporting private memory outside the workspace or applying skill patches.

For repo-level harness guidance, generate router files:

```bash
briefops export agents-md
briefops export all
```

These exports route local harnesses back to `briefops prime`, `briefops finish`, and `briefops continue --pack`. They do not copy `.briefops` memory, logs, handoffs, or worker summaries.

Use shared-only exports for portable context:

```bash
briefops prime --task "Start this task." --format codex --export-policy shared-only
briefops pack resume --worker <worker> --task "Start this task." --export-policy shared-only
```

`shared-only` omits private memory, local project file details, raw work logs, open risks, local next steps, private worker lessons, private incidents, recent work history, and private metadata counts.
