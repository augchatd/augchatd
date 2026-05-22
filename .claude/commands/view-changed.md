---
description: Run after edits in spec/views/ — reconcile with the corresponding spec/src/; flag divergences.
argument-hint: "[optional: view file that changed]"
---

# /view-changed

You just changed (or were just told about changes to) one or more files under `spec/views/` (typically `spec/views/user-stories/*.md`). Views are derivations — when one diverges from `spec/src/`, the **canonical source has to absorb the change or the view has to revert**. Reconciliation is **explicit work**.

## Inputs to gather first

1. **Which view file(s) changed?**
   - `git status -s spec/views/` and `git diff -- spec/views/`.
2. **What's the `derived_from:` of each changed view?**
   - Read the frontmatter; collect the contract / requirement ids the story is derived from.

## Steps

### 1. Find the source(s) the view derives from

For each changed view file:

- Open every spec file listed in the view's `derived_from:` frontmatter.
- Compare: does the changed view still describe the contract accurately?

### 2. Classify the change

- **Cosmetic** — phrasing, names, examples. No source impact. Safe to leave.
- **Adds a scenario** — the view now describes a case the contract doesn't. Either the contract is missing it (update the contract) or the scenario is out-of-scope (revert the view).
- **Contradicts the contract** — the view asserts something the contract refuses. Real reconciliation needed.
- **Renames or rescopes** — the view now talks about a different audience, capability, or trigger. The contract may need its own scope clarified.

### 3. Propose (don't act)

For non-cosmetic changes:

- Add a `PENDING RECONCILIATION` block at the top of the **source** file (the spec/src/ contract or requirement), naming the divergence.
- Propose a direction:
  - "Update contract X to add this scenario."
  - "Revert the view; the scenario is out of scope."
  - "Both are right; split contract X into X1 + X2 with sharper scope."
- Also flag the view file with the same block, naming the proposed resolution.
- Leave the decision to the human.

### 4. New story implied by an existing contract change

Sometimes a view edit reveals that a recent contract change *should* have produced a new story. If so:

- Propose the new story (do not write it without asking).
- Name the contract id it would be `derived_from`.

### 5. Versioning

`spec/views/user-stories/` files are sequentially numbered (0001, 0002, …). If the change introduces a new story, propose the next number and the slug.

### 6. Report

End with:

- Which view files changed
- Which sources were flagged with `PENDING RECONCILIATION` and the proposed direction
- Any new story you'd propose adding
- Open questions for the human

## Hard rules

- Stories are **not** canonical. Do not let a story edit silently override a contract — that's a one-way leak from narrative phrasing into specified behavior.
- Stories **are** real input. If editing a story exposes a gap in the contract, the contract is the file that has to change.
- Mark assumptions inline (`> [!NOTE] Assumption: ...`). Don't fill story gaps with invented behavior.
