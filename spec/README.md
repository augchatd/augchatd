# augchatd — spec

This folder is the canonical source of truth for *what augchatd is and why*.
Code, user stories, and any other artifact derive from it.

Built following the [Software Knowledge Playbook](https://github.com/TiagoJacobs/software-knowledge-playbook/blob/main/playbook.md).

## Status of this spec

- **Mode**: prescriptive (new system). No code exists yet; the spec describes what *should* be built.
- **Primary evidence**: `README.md`. Established claims are pinned to `README.md@e562b2b` (initial commit). Claims referencing `README.md` without a commit pin point to content added by an in-flight README edit that has not yet been committed — re-pin them via `/code-changed` after the next commit.
- **Default status of every statement**: `proposed`. Statements become `current` only when implementation and tests confirm them.
- **Maturity**: pre-1.0. README declares "API and storage layout may change before 1.0".

## Layout

```
spec/
├── src/                  # canonical source
│   ├── intent/           # why the system exists
│   ├── domain/           # ubiquitous language, bounded contexts
│   ├── behavior/         # capabilities, requirements, behavior contracts, flows
│   ├── contracts/        # technical surfaces (HTTP, postMessage, streaming)
│   ├── architecture/     # components, ADRs
│   ├── constraints/      # cross-cutting constraints
│   ├── evidence/         # pointers to code, tests, traces, discussions
│   ├── pressure/         # product signals (expectations, pains, opportunities)
│   └── history/          # relevant history (only when it explains a current constraint)
└── views/
    └── user-stories/     # narrative derivation of contracts
```

## File conventions

Every spec file carries YAML frontmatter. Required keys vary by `type`; the common shape:

```yaml
---
id: kebab-case-id            # unique within type
type: intent | domain | capability | requirement | behavior-contract |
      technical-contract | adr | constraint | evidence | pressure |
      history | user-story
status: proposed | current | deprecated
evidence:                    # sources that back this file
  - source: README.md@e562b2b
    section: "How it works"
links:                       # graph edges to other spec files
  - relation: satisfies | supports | constrains | enables | depends_on |
              conflicts_with | refines | protects_compatibility_for
    target: id-of-other-file
---
```

`status` values:

- `proposed` — declared intent; not yet implemented or verified
- `current` — backed by code + tests; reflects what the system does today
- `deprecated` — kept for history or migration; no longer true

## Divergence flag convention

When the spec, code, or a view disagree, do **not** reconcile silently.
Add a block at the top of the affected file:

```markdown
> [!WARNING] PENDING RECONCILIATION
> - **Detected**: 2026-05-21 by /code-changed
> - **Sources in conflict**: spec/src/behavior/contracts/session-create.md vs src/sessions/create.ts
> - **Nature**: behavior contract states X; code does Y
> - **Proposed direction**: update spec to match code (code passes integration tests)
> - **Decision owner**: <human>
```

The block stays until a human approves a direction and the routine command (`/spec-changed`, `/code-changed`, `/view-changed`) carries the propagation.

## Sync routines

Four slash commands keep the artifacts aligned:

- `/spec-changed` — when `spec/src/` changes, propagate to code and views
- `/code-changed` — when code outside `spec/` changes, propagate to spec
- `/view-changed` — when `spec/views/` changes, reconcile with `spec/src/`
- `/evidence-arrived` — when new evidence arrives (issue, PR, decision), classify and place it

Run the relevant command after an edit. Reconciliation is explicit work.

## Rules for AI

Inherited from the playbook:

- do not invent facts
- mark assumptions as `> [!NOTE] Assumption: ...` inline
- start with the smallest useful truth
- detail only what is stable, important, and evidenced
- keep language short and direct
- flag pending reconciliation; never reconcile silently
