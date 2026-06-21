# BriefOps Impact Report v0

Use this template to record whether BriefOps impact is measured, estimated, or
unmeasured for one project task or reporting period. Keep the field names stable.

## Report Values

project:
task_or_period:
briefops_adoption_point:
token_usage_status: unmeasured
input_tokens:
output_tokens:
total_tokens:
context_baseline:
context_used:
context_reduction_estimate:
artifact_coverage:
handoff_status:
validation_status:
conclusion: unmeasured

## Field Definitions

`project`: Project, repository, workspace, or product area being reported.

`task_or_period`: The task, milestone, sprint, date range, or release covered by
this report. Use one report per task or period.

`briefops_adoption_point`: Where BriefOps entered the workflow, such as before
planning, before implementation, during handoff, or after validation.

`token_usage_status`: Evidence level for token usage values. Allowed values:
`measured`, `estimated`, `unmeasured`.

`input_tokens`: Input token count for the covered task or period. Leave blank or
write `unmeasured` when no credible value exists.

`output_tokens`: Output token count for the covered task or period. Leave blank
or write `unmeasured` when no credible value exists.

`total_tokens`: Input plus output tokens for the covered task or period. Leave
blank or write `unmeasured` when no credible value exists.

`context_baseline`: The size of the context that would otherwise have been used,
limited to the whole repo, whole document set, full history dump, or other
bounded source context. Include the unit used.

`context_used`: The size of the actual BriefOps brief, spec, context pack, or
other bounded context supplied to the agent. Use the same unit as
`context_baseline`.

`context_reduction_estimate`: Estimated context reduction, calculated only from
`context_baseline` and `context_used`.

`artifact_coverage`: Existence-only coverage for these eight artifacts:
`brief`, `spec`, `plan`, `tasks`, `validation`, `review`, `handoff`,
`decision-log`. Record as `<present_count>/8` plus present and missing names.

`handoff_status`: Handoff readiness for the covered task or period. Suggested
values: `complete`, `partial`, `absent`, `not_applicable`.

`validation_status`: Validation evidence for the covered task or period.
Suggested values: `validated`, `partial`, `unvalidated`, `blocked`,
`not_applicable`.

`conclusion`: Overall evidence conclusion. Allowed values only: `proven`,
`partially supported`, `unmeasured`, `not supported`.

## Measurement Rules

### Token Usage And Token Savings

- Mark `token_usage_status` as `measured` only when actual token usage logs exist
  for the covered task or period.
- Mark `token_usage_status` as `estimated` only when token counts are derived
  from a deterministic approximation, such as a tokenizer or transcript count.
- Mark `token_usage_status` as `unmeasured` when neither actual logs nor a
  deterministic approximation are available.
- If actual token usage logs do not exist, token savings must be reported as
  `unmeasured`.
- Do not use `context_reduction_estimate` as evidence of token savings.
- Do not combine input, output, and total tokens from different tasks, agents, or
  reporting periods.

### Context Management

- Treat context management as separate from token savings.
- Estimate context reduction only by comparing `context_baseline` with
  `context_used`.
- Use the same unit for `context_baseline` and `context_used`, preferably tokens.
  Bytes, lines, files, or pages are acceptable only when both values use the same
  unit.
- Calculate:
  `(context_baseline - context_used) / context_baseline`.
- Mark `context_reduction_estimate` as `unmeasured` when either side of the
  comparison is unavailable or uses incompatible units.
- A context reduction estimate supports a context management claim only. It does
  not prove token savings or quality improvement.

### Artifact Coverage

- Calculate `artifact_coverage` only from whether each named artifact exists.
- Do not score artifact quality, length, freshness, or correctness in
  `artifact_coverage`.
- Count an artifact as present only when it is discoverable in the project files
  or attached work record for the covered task or period.
- If an artifact has multiple files, count the artifact type once.

### Conclusion

- Use `proven` only when the claimed impact is backed by direct measured
  evidence. Token savings can be `proven` only with actual token usage logs.
- Use `partially supported` when measured evidence is incomplete, but deterministic
  context comparison, artifact coverage, handoff status, or validation status
  supports a narrower BriefOps benefit.
- Use `unmeasured` when the report records adoption but lacks enough evidence to
  support or reject impact.
- Use `not supported` when the available evidence contradicts the claimed impact
  or shows no meaningful BriefOps effect.
- If token savings are unmeasured but context management is estimated, the
  conclusion must not imply proven token savings.

## 30-Minute Fill Procedure

1. Identify the project and covered task or period.
2. Check whether actual token usage logs exist.
3. Fill token fields as measured, estimated, or unmeasured.
4. Compare only the bounded baseline context with the actual BriefOps context
   used.
5. Count the eight artifact types by existence only.
6. Record handoff and validation status from available work records.
7. Choose exactly one allowed conclusion without merging token savings and
   context management evidence.

## Non-Goals

This template does not define automatic collection, JSON schema, dashboards,
cross-project comparison, migration guidance, sample reports, scoring, or a full
Spec Kit workflow.
