# BriefOps File Format Contract

BriefOps stores all user data under `.briefops/`. Version 1.0 treats these files as the durable local data contract.

## Workspace

- `.briefops/config.yaml`
  - `version`: workspace schema version. New 1.0 workspaces use `1.0.0`.
  - `created_at`: ISO datetime.
  - `defaults.project`: optional default project name.
  - `defaults.worker`: optional default worker name.
  - `token_budgets.prime`: default prime budget.
  - `token_budgets.resume`: default resume/pack budget.
  - `memory_categories`: supported memory categories.

## Source Files

- `.briefops/projects/<name>.project.md`
  - Markdown with YAML frontmatter.
  - Stable frontmatter: `name`, `description`, `max_tokens`, `tags`.
  - Body is local project context. Shared-only exports omit it.

- `.briefops/skills/<name>.skill.md`
  - Markdown with YAML frontmatter.
  - Stable frontmatter: `name`, `version`, `description`, `max_tokens`, `tags`.
  - Skill patches append checklist items and changelog entries only after approval.

- `.briefops/workers/<name>.worker.yaml`
  - Stable fields: `name`, `description`, `project`, `default_skills`, `style`, `max_tokens`, `status`.

## Memory And Logs

- `.briefops/memory/<category>.yaml`
  - Shape: `items: MemoryItem[]`.
  - Stable item fields: `id`, `type`, `status`, `project`, `skill`, `content`, `source`, `created_at`, `tags`, `visibility`, `exportable`.
  - Supported statuses: `active`, `stale`, `deprecated`, `superseded`, `archived`.
  - Supported visibility values: `private`, `shared`, `public`.

- `.briefops/logs/*.yaml`
  - Stable fields: `id`, `created_at`, `project`, `skill`, `worker`, `task`, `result`, `lessons`, `open_risks`, `next_steps`, `decisions`, `incidents`, `files_changed`, `commands_run`, `notes`.
  - Logs are private local history. Shared-only exports omit raw logs.

## Review Queues

- `.briefops/memory-proposals/*.memory-proposal.yaml`
  - Stable fields: `id`, `created_at`, `from_log`, `status`, `project`, `skill`, `worker`, `items`, `applied_at`, `rejected_at`.
  - Legacy `proposals` arrays remain readable and are normalized to `items`.
  - Proposal entries use memory item fields plus `category` and `rationale`.

- `.briefops/patches/*.patch.yaml`
  - Stable fields: `id`, `created_at`, `skill`, `from_log`, `status`, `target_section`, `lessons`, `additions`, `applied_at`, `rejected_at`.

## Generated Artifacts

- `.briefops/handoffs/*.md`
- `.briefops/codex/prompts/*.md`
- `.briefops/briefs/*.md`

Generated artifacts are reproducible outputs, not the canonical data store. Their command names, privacy behavior, and frontmatter metadata are stable in 1.0, but users should keep durable facts in source files, memory, logs, proposals, and patches.

## Harness Router Files

- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules/briefops-*.mdc`

`briefops export` generates router files. They contain command routing and safety boundaries only. They must not copy raw memory, logs, worker summaries, handoffs, incidents, or private decisions.
