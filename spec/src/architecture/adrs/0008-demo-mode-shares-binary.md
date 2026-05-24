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

The **same binary** boots both modes — and they share not just the chat code path but the **entire session-creation protocol** (iframe + postMessage handshake, JWT-bearer chat):

- `AUGCHATD_MODE=demo` → single-tenant, mTLS bypassed. The wrapper page at `GET /demo/` plays the role of the integrator: it `POST`s `/demo/sessions` (which mints a session from env vars) and postMessages the JWT to the iframe — the same handshake the iframe runs against a real integrator in production.
- Default → production: mTLS for `POST /sessions`, no `/demo/*` routes, no env-vars-as-credentials. The integrator's own page is the parent of the iframe.

The chat code path AND the session-creation handshake are identical from `POST /{demo/,}sessions` onward — only the *source* of session config differs (env vs payload).

## Consequences

- "Graduate from demo to production" = environment / boot flags change plus the integrator wires their own backend to `POST /sessions`. The bundled UI is unchanged.
- Bugs in the chat path AND in the session-creation handshake affect both modes — demo serves as a continuous smoke test of the prod protocol shape, not just the chat loop.
- Demo mode must be self-evidently for testing only — documented as not for production (single-tenant, env-held credentials, no integrator authority).

## Alternatives considered

- **Separate demo artifact** — drifts from production; reduces the value of demo as smoke test.
- **Demo mode as a runtime mode toggle without env-vars-as-credentials** — would require still going through `POST /sessions`, defeating the "one docker run" goal.
