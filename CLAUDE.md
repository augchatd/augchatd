# augchatd — project instructions

## Spec is canonical

This project follows the [Software Knowledge Playbook](https://github.com/TiagoJacobs/software-knowledge-playbook/blob/main/playbook.md). The canonical source of truth is [`spec/`](spec/README.md):

- `spec/src/` — canonical source (intent, domain, behavior, contracts, architecture, constraints, evidence, pressure, history)
- `spec/views/` — derived perspectives (user-stories, …)
- Code, when it exists, derives from the spec.

Read [`spec/README.md`](spec/README.md) before any non-trivial work — it documents the layout, the frontmatter convention, the divergence-flag convention, and the status of the spec (currently prescriptive; no code yet).

## The four sync routines

When any of these things happen, run the matching slash command:

| Trigger | Command | What it does |
| --- | --- | --- |
| Files in `spec/src/` changed | `/spec-changed` | Propagate to affected code (when code exists) and views; flag divergences |
| Files outside `spec/` (code, infra, README) changed | `/code-changed` | Propagate to spec; flag divergences |
| Files in `spec/views/` changed | `/view-changed` | Reconcile with the corresponding `spec/src/` |
| New evidence arrives (issue, PR, decision, support thread) | `/evidence-arrived` | Classify as pressure / updated evidence / history; propose where to insert |

The commands' definitions live in [`.claude/commands/`](.claude/commands/). Each is a short checklist; you read it, you apply it.

## Git workflow

These rules prevent direct-to-main churn that caused early-iteration mistakes.

- **Never push direct commits to `main`** (in either `origin` or `upstream`). The only writes to `main` come from merged PRs.
- **All work happens on a feature branch.** Branch from `main`, commit there, push the branch.
- **PRs are always opened on the upstream repo (`augchatd/augchatd`), never on the fork (`TiagoJacobs/augchatd`).** The fork holds your feature branch; the conversation, review, and merge happen upstream.
- **After a PR merges**, sync the fork's main from upstream: `git fetch upstream && git checkout main && git reset --hard upstream/main && git push origin main --force-with-lease`. This is a sync of squashed upstream history, not new work — the only legitimate force-push to `main`.

## Hard rules (inherited from the playbook)

- **Do not invent facts.** If something is not in the evidence, it is a gap; mark it.
- **Mark assumptions as assumptions.** Use `> [!NOTE] Assumption: ...` blocks inline.
- **Start with the smallest useful truth.** Detail only what is stable, important, and evidenced.
- **Keep language short and direct.**
- **Never reconcile silently.** When spec, code, or a view disagree, add a `PENDING RECONCILIATION` block (see [spec/README.md](spec/README.md)) and propose a direction; the human decides.
- **Update the spec in the same change as the code.** If you edit code, run `/code-changed`. If you edit the spec, run `/spec-changed`. Reconciliation is explicit work, not a final cleanup task.

## Current project status (read this before doing anything load-bearing)

- **Prescriptive spec, no implementation yet.** Every spec file's `status:` is `proposed`. They become `current` only when implementation and tests confirm them.
- **Only evidence: `README.md` at commit `e562b2b`.** Every claim's `evidence:` list points to it. When code lands, add `evidence/code-pointers/*` and `evidence/test-pointers/*` and update the affected spec files' `status:` to `current`.
- **README.md is also a derivation in practice.** It happens to be the *source* today because nothing else exists. Once the spec is the canonical source, README updates run through `/code-changed` (it's a public-facing doc that must agree with the spec).

## Useful entry points

- [`spec/README.md`](spec/README.md) — spec layout and conventions
- [`spec/src/intent/`](spec/src/intent/) — why augchatd exists
- [`spec/src/behavior/capabilities.md`](spec/src/behavior/capabilities.md) — index of capabilities → requirements → contracts
- [`spec/src/architecture/components.md`](spec/src/architecture/components.md) — components, stack, ADR index
- [`spec/views/user-stories/`](spec/views/user-stories/) — narrative validation of contracts
