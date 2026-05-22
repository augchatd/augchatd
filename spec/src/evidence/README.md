# evidence/

Pointers to the sources that back every claim in `spec/src/`.

## Current state

The **only** evidence at this point is the project's `README.md` at commit `e562b2b` (the initial commit). See [discussions/readme-initial.md](discussions/readme-initial.md) for the pointer.

All other evidence folders are stubs that will fill as the project grows:

- [code-pointers/](code-pointers/) — `file:line@commit` references that prove a contract
- [test-pointers/](test-pointers/) — which tests protect which contract
- [traces/](traces/) — production captures (anonymized) that demonstrate behavior
- [discussions/](discussions/) — PRs, issues, threads, ADR-source decisions

## Convention

Every claim in `spec/src/behavior/`, `spec/src/contracts/`, `spec/src/architecture/`, `spec/src/constraints/` references one or more evidence entries via its frontmatter `evidence:` list.

When the underlying evidence changes (PR closed, test removed, code deleted), the claim that relied on it goes into **review** — flagged with a `PENDING RECONCILIATION` block (see [spec/README.md](../../README.md)).
