---
description: Run when new evidence arrives (issue, PR, decision, support thread, trace) — classify it and propose where to insert.
argument-hint: "<paste a link, issue id, PR number, or short description>"
---

# /evidence-arrived

A new artifact has appeared that may affect the spec: a GitHub issue, a PR, a design decision, a Slack/email thread, a captured production trace, a customer support message. Classify it; propose where it lives.

## Inputs to gather first

1. **What is `$ARGUMENTS`?** A URL, an issue/PR id, a description.
2. **Pull the source** if needed:
   - GitHub PR/issue → `gh pr view <n>` / `gh issue view <n>` / `gh api`.
   - Internal link / Notion / Linear → use the appropriate MCP if available.
   - Raw text pasted by user → use as-is.
3. **What does it carry?** Extract:
   - Author / source
   - Date
   - Stated intent or observed behavior
   - Links / dependencies it mentions
   - Whether it's about something **current**, **proposed**, or **past**.

## Classification — pick exactly one

| Bucket | Definition | Lands in |
| --- | --- | --- |
| **Pressure** | An expectation, pain, opportunity, or unmet need. Not yet accepted as current behavior. | `spec/src/pressure/` |
| **Updated evidence (current truth)** | Confirms or refines a claim already in `spec/src/`. | `spec/src/evidence/` (and update the relevant `behavior/`, `contracts/`, `architecture/`, `constraints/` file's `evidence:` list) |
| **History** | Past event that **still** explains a current constraint, decision, or risk. If it doesn't explain something live, **don't** add it — git/issue tracker is sufficient. | `spec/src/history/` |
| **New claim** | A behavior, decision, or constraint that the spec doesn't yet cover and the source warrants adding. | `spec/src/behavior/` or `spec/src/architecture/` or `spec/src/constraints/`, depending on shape |

If the artifact spans buckets (e.g. an issue contains both pressure and an accepted decision), split it: propose one entry per bucket.

## Steps

### 1. Snapshot the source (if it could evaporate)

For Slack/email/closed-issue/deleted-comment sources, copy the relevant text into the body of the new evidence file under `spec/src/evidence/discussions/`. Don't trust a link to be there in a year.

### 2. Draft the file (don't commit; propose)

Show the user:

- The proposed **path** (e.g. `spec/src/pressure/early-adopter-asks-for-otel.md`).
- The proposed **frontmatter** (id, type, status, source kind, who/when, links).
- The proposed **body** — short, direct, citing the source.

### 3. Propose graph updates

If the artifact informs an existing spec file:

- Show which spec file(s) should add this evidence to their `evidence:` list.
- Show which file(s) should add a `links:` edge (with the right relation).
- If the artifact reveals a divergence between two existing spec files, add a `PENDING RECONCILIATION` block to the affected file(s) — do not reconcile silently.

### 4. Don't promote pressure to current truth

If the source is a stated expectation, request, or even an integrator commitment, it goes in `pressure/` until:

1. A contract has been added or updated to satisfy it, **and**
2. Code + tests confirm it.

Premature promotion is the most common failure mode of this routine.

### 5. Report

End with:

- Proposed files and frontmatter (concise)
- Proposed updates to existing files (file path + the new line(s))
- Any pending-reconciliation flags raised
- Open questions for the human

## Hard rules

- **Do not invent context that the source does not contain.**
- **Do not promote** an expectation to a current contract on the basis of a source alone — require code + tests.
- **Snapshot evaporating sources** into the file body.
- **One bucket per finding.** If it has two facets, propose two files.
- If unsure which bucket applies, **ask** before placing.
