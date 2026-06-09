# BriefOps Codex Plugin

This is a skill-only Codex plugin bundle for BriefOps.

It does not run a hosted service and does not sync data. The skills call the local `briefops` CLI and local `.briefops/` workspace.
It does not publish to a marketplace and does not write to global Codex folders by default.

The BriefOps plugin is a local CLI helper. It does not require network access, does not publish to a marketplace, and should not auto-approve memory or skill patches. Use `--export-policy shared-only` before copying context outside the local workspace.

Recommended local setup:

```bash
briefops init
briefops codex install
briefops codex plugin install
briefops worker use <worker>
briefops prime --task "Start this task." --format codex
```

The generated local plugin copy is written to:

```text
.briefops/codex/plugin/briefops
```

BriefOps plugin skills must never auto-approve memory proposals or skill patches.

Use shared-only exports for portable context:

```bash
briefops prime --task "Start this task." --format codex --export-policy shared-only
briefops pack resume --worker <worker> --task "Start this task." --export-policy shared-only
```

`shared-only` omits private memory, raw local work logs, open risks, local next steps, private worker lessons, private incidents, and recent work history.
