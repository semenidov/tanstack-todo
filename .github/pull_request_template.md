<!-- Title: type(scope): summary  (Conventional Commits, becomes the squash commit) -->
<!-- Small PR (docs/chore/config, no logic, < ~50 lines): keep only "Closes", "Before merging" (if any), "Why", "What changed", "How to verify"; delete the rest. -->

Closes #

## ⚠️ Before merging

<!-- Manual actions required: env vars, secrets, dashboard settings. Remove the section if none. -->

## Why

<!-- 1-3 sentences: the problem and the goal. Link a DECISIONS.md entry if relevant. -->

## What changed

<!-- Bullets, grouped by area. -->

## Review guide

<!-- Suggested reading order. Mark generated / mechanical files to skim or skip. -->

## Look closely at

<!-- Risky parts: auth, migrations, security, concurrency. Write "Nothing risky" if so. -->

## How to verify

<!-- Concrete steps on the preview deployment. -->

## Acceptance criteria → tests

<!-- One row per acceptance criterion / edge case from the spec. "red-green" = the test failed before the change. -->

| #   | Criterion | Test | red-green |
| --- | --------- | ---- | --------- |

## Testing

- Run locally (own tests only):
- No test needed (why):
- Not verified:

## Checklist

- [ ] One issue, no unrelated changes
- [ ] Docs updated (`DOCUMENTATION.md` / `DECISIONS.md`) if needed
- [ ] Migration generated and committed if the schema changed
