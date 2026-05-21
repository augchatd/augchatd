---
description: Run after edits to files outside spec/ (code, infra, README) — propagate to the spec; flag divergences.
argument-hint: "[optional: file or area that changed]"
---

# /code-changed

You just changed (or were just told about changes to) one or more files outside `spec/`. Code is a derivation; the **spec must reflect what the code now does**. Reconciliation is **explicit work**: propose; do not reconcile silently.

## Inputs to gather first

1. **Which files changed outside `spec/`?**
   - Run `git status -s` and `git diff --stat` and filter out `spec/`.
   - If `$ARGUMENTS` names a file or area, focus there first.
2. **What kind of change?** Classify each:
   - **new code** (no spec entry yet for what it does)
   - **modified behavior** (a contract's observable promise has changed)
   - **infra/config change** (may imply an ADR update)
   - **README/doc change** (may imply a spec text update)
   - **bug fix** (often: the spec was right; the code is finally aligning)

## Steps

### 1. Identify what the change implies for the spec

For each non-spec change:

- Which `spec/src/behavior/contracts/*.md` does it touch? Look for the contract whose observable outcomes match (or no longer match) the new behavior.
- Which `spec/src/behavior/requirements/*.md` does it claim to satisfy?
- Does it imply a new **architecture decision** (ADR)? If yes, an ADR file is needed under `spec/src/architecture/adrs/`.
- Does it imply a new or changed **constraint** (security, observability, durability, …)?

### 2. For each touched spec file: propose, do not edit silently

Two cases:

**Case A — code and spec agree (rare initially):**
- Add a `code-pointers/*.md` entry under `spec/src/evidence/code-pointers/` that points to the new `file:line@commit`.
- Update the spec file's frontmatter `evidence:` list to include the new code-pointer id.
- If the spec file's `status:` was `proposed` and now both code and tests confirm it, promote to `current`.

**Case B — code and spec disagree:**
- Add a `PENDING RECONCILIATION` block at the top of the affected spec file naming the disagreement.
- Propose a direction:
  - "Update the spec — the code's new behavior is correct and the contract is outdated" (most common after a deliberate behavior change).
  - "Revert the code — the contract was right and this is a regression."
  - "Both are right; the contract needs to grow a new case."
- Leave the decision to the human.

### 3. New evidence: route through `/evidence-arrived`

If the change came in via a PR, issue, or discussion that carries *intent* (not just code), also run `/evidence-arrived` to classify and place the discussion under `spec/src/evidence/discussions/`.

### 4. README divergence

If the repo `README.md` was edited:

- The README is public-facing. It must agree with the spec.
- Identify the spec file(s) whose claims the README now restates or contradicts.
- If the README change reveals a real spec gap, propose a spec update (same `PENDING RECONCILIATION` pattern).
- Do **not** silently revert README edits — they may be intentional clarifications that the spec must absorb.

### 5. Tests landed?

If tests were added or changed:

- Add `test-pointers/*.md` entries under `spec/src/evidence/test-pointers/`.
- Link them from the contract(s) they protect.
- This is what justifies a `proposed` → `current` status promotion in step 2 Case A.

### 6. Report

End with:

- Which spec files were touched (added evidence; flagged PENDING RECONCILIATION; status-promoted; new).
- What you intentionally did **not** change.
- Open questions for the human.

## Hard rules

- Do not promote any spec claim to `current` without both a code-pointer and a test-pointer (or an explicit exception with rationale).
- Do not silently rewrite the spec to match new code. Flag, propose, wait.
- Do not silently rewrite the README. Same rule.
- If the change touches nothing the spec covers, that itself is a finding — propose where the spec should grow.
