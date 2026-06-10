# BriefOps Privacy Model

BriefOps is local-first. It stores work history, memory, proposals, patches, generated prompts, and plugin assets under `.briefops/` in the current repository.

## Export Policies

`local-private` is for local terminal and local Codex/Claude/Cursor use. It may include private project details, approved private memory, local work logs, risks, next steps, worker history, and metadata counts.

`shared-only` is for artifacts that may leave the local workspace. It includes only memory items marked `visibility: shared` and `exportable: true`.

Shared-only omits:

- private memory,
- local project file details,
- raw work logs,
- open risks,
- local next steps,
- private worker lessons,
- private incidents,
- recent work history,
- private worker history,
- private metadata counts.

## Router Exports

`briefops export agents-md`, `briefops export claude-md`, `briefops export cursor-rules`, and `briefops export all` generate router files. Router files point AI harnesses to BriefOps commands. They do not copy `.briefops` memory, logs, worker summaries, handoffs, incidents, or private decisions.

## Human Approval

BriefOps never auto-approves memory proposals or skill patches. Approval is always an explicit user action through `briefops approve`, `briefops memory proposal-apply`, or `briefops skill apply-patch`.

## Doctor Checks

`briefops doctor --privacy` checks local memory sharing hazards:

- `.briefops/` gitignore coverage,
- private memory marked exportable,
- secret-like local memory strings.

`briefops doctor --stability` checks local workspace integrity, including schema validity, duplicate memory ids, broken references, managed-path symlinks, and orphaned review artifacts. It is read-only, reports bounded examples, and does not add detailed doctor output to generated prompt artifacts.

`briefops doctor --security --fix-stale-locks` removes stale lock files only. It does not remove fresh locks or other workspace files.
