# Changelog

## Unreleased

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
