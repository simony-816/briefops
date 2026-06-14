# Changelog

## Unreleased

- No changes yet.

## 2.0.0 - 2026-06-14

- Make `briefops finish` apply durable directory-local memory by default while retaining proposal files as an audit trail.
- Add `--memory-review` for explicit pending memory queues.
- Update Codex/plugin/router guidance to treat `.briefops/` memory as local repo state and reserve confirmation for external sharing or skill patches.

## 1.1.0 - 2026-06-10

- Add `briefops doctor --stability` for bounded read-only workspace integrity checks.
- Detect invalid workspace schemas, duplicate memory ids, broken references, managed-path symlinks, and orphaned review artifacts.
- Keep detailed stability diagnostics out of `prime`, handoff, resume, and pack context so local checks do not increase prompt volume.

## 1.0.2 - 2026-06-10

- Include work-log lessons in local handoff, Codex resume, and worker recent-work context before durable memory approval.
- Keep shared-only handoffs and resumes from exposing raw work-log lessons or other private continuity details.
- Clarify immediate handoff versus human-approved durable memory in docs.

## 1.0.1 - 2026-06-09

- Clarify supported security versions for 1.x and 0.2.x alpha.
- Polish repository discovery metadata, README badges, and npm package keywords.
- Upgrade Commander to 15.0.0.

## 1.0.0 - 2026-06-09

- Add local harness router exports for `AGENTS.md`, `CLAUDE.md`, Cursor rules, and `export all`.
- Add context budget inspection and raw-vs-prime context comparison.
- Add finish importance controls plus read-only memory hygiene and prune dry-run reports.
- Keep `briefops --version` in sync with package metadata through a shared version constant.
- Hide private continuity metadata counts from shared-only prime, handoff, resume, and pack flows.
- Protect memory proposal and skill patch generation with workspace locks.
- Document privacy doctor, stale-lock cleanup, and shared-only export boundaries.
- Document the 1.0 file format, compatibility, and privacy contracts.

## 0.2.1-alpha.0

- Add OSS trust documents.
- Add privacy doctor.
- Protect explicit output paths from accidental overwrite.
- Protect generated Codex plugin files from silent local-change overwrite.
- Add harness integration guidance.
- Add release readiness checks.

## 0.2.0-alpha.0

- Add Codex first-context workflow.
- Add local Codex plugin bundle generation.
- Add `briefops prime` and `briefops codex prime`.
- Add default worker selection with `briefops worker use`.
- Add persistent worker finish/continue flow.
- Add human-approved memory proposal flow.
- Add shared-only export policy.
- Add `doctor --security` and stale lock cleanup.
