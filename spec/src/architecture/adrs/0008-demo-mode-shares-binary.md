---
id: adr-0008-demo-mode-shares-binary
type: adr
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "Quick Start (demo mode)"
links:
  - relation: supports
    target: contract-demo-mode
---

# ADR 0008 — Demo mode is the same binary, gated by `AUGCHATD_MODE`

## Context

Two needs in tension:

- Lower the friction of trying augchatd to "one `docker run` + browser open".
- Keep the production path real — credentials provisioned via mTLS, not env vars.

## Decision

The **same binary** boots both modes:

- `AUGCHATD_MODE=demo` → single-tenant, env-driven session, `GET /demo/jwt` exposed, mTLS bypassed.
- Default → production: mTLS for `POST /sessions`, no `GET /demo/jwt`, no env-vars-as-credentials.

The chat code path is identical from session-loaded-in-memory onward.

## Consequences

- "Graduate from demo to production" = environment / boot flags change, not a different artifact.
- Bugs in the chat path affect both, which means demo serves as a continuous smoke test.
- Demo mode must be self-evidently for testing only — documented as not for production (single-tenant, env-held credentials).

## Alternatives considered

- **Separate demo artifact** — drifts from production; reduces the value of demo as smoke test.
- **Demo mode as a runtime mode toggle without env-vars-as-credentials** — would require still going through `POST /sessions`, defeating the "one docker run" goal.
