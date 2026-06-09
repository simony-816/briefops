# Security Policy

BriefOps is a local-first CLI. It stores project memory, work logs, generated prompts, and plugin assets under `.briefops/` in the current repository.

## Supported Versions

| Version | Supported |
| --- | --- |
| 0.2.x alpha | Security fixes accepted |

## Reporting A Vulnerability

Please report suspected vulnerabilities through GitHub Security Advisories when available. If advisories are not enabled, open a GitHub issue with a minimal description and avoid posting secrets, private logs, or exploit payloads.

Include:

- BriefOps version
- Operating system
- Command used
- Whether `.briefops/` contains private project data
- Expected behavior
- Observed behavior

## Local Data Policy

BriefOps does not require a hosted service, MCP server, vector database, or network access.

Do not commit `.briefops/` unless you intentionally curated the contents for sharing. Use:

```bash
briefops doctor --privacy
briefops prime --export-policy shared-only
briefops pack resume --export-policy shared-only
```

before sharing generated context outside your local machine.

`shared-only` omits private memory, local project file details, raw work logs, open risks, local next steps, private worker history, and private metadata counts. `doctor --privacy` checks local memory sharing hazards. `doctor --security --fix-stale-locks` removes stale locks only.
