---
description: Run after edits in spec/src/ — propagate to code and views, flag divergences (do not reconcile silently).
argument-hint: "[optional: file or area that changed]"
---

# /spec-changed

You just changed (or were just told about changes to) one or more files under `spec/src/`. The spec is canonical — the change must propagate. Reconciliation is **explicit work**: propose; do not reconcile silently.

## Inputs to gather first

1. **Which files changed in `spec/src/`?**
   - Run `git status -s spec/src/` and `git diff --stat spec/src/`.
   - If `$ARGUMENTS` names a file or area, focus there first.
2. **What kind of change?** Classify each changed file as one of:
   - **new claim** (a contract, requirement, ADR, etc. that didn't exist)
   - **modified claim** (existing file edited)
   - **deletion** (file removed → make sure nothing still links to it)
   - **status promotion** (e.g. `proposed` → `current` after code + tests landed)

## Steps

### 1. Re-check the graph links in the changed file(s)

For each changed `behavior/contracts/*.md`, `behavior/requirements/*.md`, `contracts/*.md`, `architecture/adrs/*.md`, or `constraints/*.md`:

- Are the frontmatter `links:` still accurate? (relations: satisfies, supports, constrains, enables, depends_on, conflicts_with, refines, protects_compatibility_for)
- Are the `evidence:` entries still pointing to a real source?
- Did this change invalidate a link in **another** spec file? Search for the file's `id:` in the rest of `spec/`.

### 2. Propagate to code

For each modified contract or requirement:

- Find code that implements it. Use the contract's id (e.g. `contract-session-create`) to grep for references in source (when source exists).
- If code exists and now disagrees with the new spec content, do **not** silently update either side. Insert a `PENDING RECONCILIATION` block in both files (the spec file and the affected code file or a sibling doc), name the conflict, propose a direction, leave the decision to the human.
- If code does **not** exist yet (current state of this project), note that propagation is deferred — no code-side action required, but record the spec change in a brief commit message hint.

### 3. Propagate to views

For each changed contract or requirement, find user stories in `spec/views/user-stories/` whose frontmatter `derived_from:` lists the changed id.

- If the story still reflects the new contract, leave it.
- If the story now contradicts the contract, add a `PENDING RECONCILIATION` block at the top of the story file, naming the conflict.
- If the change implies a new story is warranted (a newly-observable behavior, a new failure mode), propose the story (do not write it without asking).

### 4. Update the README

The repo `README.md` is the public-facing description. If a changed contract or constraint contradicts a sentence in the README, propose an edit. Do **not** silently edit the README — surface the diff and let the human approve.

### 5. Status promotion check

If a file's `status:` moved from `proposed` to `current`:

- Confirm `evidence:` lists at least one `code-pointers/*` and one `test-pointers/*` entry (or explain why an exception is acceptable).
- If no code/test evidence exists, revert to `proposed` and explain why.

### 6. Report

End with a short, plain summary:

- What you propagated
- What you flagged as PENDING RECONCILIATION (and where)
- What you intentionally deferred (and why)

Do not exceed what the spec change actually justifies. If nothing else needs to change, say so.

## Hard rules

- Do not invent facts to fill gaps in the changed files. If a gap was created, mark it `> [!NOTE] Assumption: ...`.
- Do not reconcile divergences without human approval. Flag, propose, wait.
- Update the same routine you're running — if the trigger generated a new claim, ensure its evidence entry is present in `spec/src/evidence/`.
