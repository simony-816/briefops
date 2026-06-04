# Persistent Worker

A BriefOps worker is not roleplay. It is a durable bundle of:

- default project
- default skills
- style constraints
- recent work history
- active lessons
- known failure patterns
- judgment rules

Use `briefops worker refresh-summary <worker>` to compile this into `.briefops/workers/summaries/<worker>.summary.md`.

Handoffs and Codex resume prompts prefer this summary when it exists, so fresh threads inherit worker intelligence without dumping every prior log.
