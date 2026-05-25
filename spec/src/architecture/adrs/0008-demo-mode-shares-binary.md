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

> [!WARNING] PENDING RECONCILIATION
> - **Detected**: 2026-05-25 by /code-changed (audit consolidation, augchatd/augchatd#9)
> - **Sources in conflict**: this ADR's Decision §"Default → production: mTLS for `POST /sessions`, no `/demo/*` routes" vs `src/server.ts:36-39` ("Production mode (placeholder until session minting lands)" — only `/healthz` is mounted in prod) and `src/jwt.ts:16-18` ("Production minting (forthcoming with POST /sessions) … not in this commit").
> - **Nature**: the demo half of the symmetry claim is shipped end-to-end. The production half — mTLS, `POST /sessions`, `DELETE /sessions/:id`, the integrator-page handshake variant — is unimplemented. The "same binary, shared protocol" framing is therefore aspirational on one side. The shape claim ("session-creation payload is identical in demo and prod, only the transport differs") is verifiable today because `local/demo_session.json` does mirror the documented `POST /sessions` body shape.
> - **Proposed direction**: keep the ADR as the design decision. When production session minting lands (mTLS termination + `POST /sessions` mount + production JWT secret strategy), remove this block. Until then this block makes the half-shipped state visible — a reader trying to integrate against augchatd today gets the demo path and nothing else.
> - **Decision owner**: project owner.

## Context

Two needs in tension:

- Lower the friction of trying augchatd to "edit one JSON file + one `docker run` + browser open".
- Keep the production path real — credentials provisioned via mTLS, not loaded from disk.

## Decision

The **same binary** boots both modes — and they share not just the chat code path but the **entire session-creation protocol** (iframe + postMessage handshake, JWT-bearer chat):

- `AUGCHATD_MODE=demo` → single-tenant, mTLS bypassed. The wrapper page at `GET /demo/` plays the role of the integrator: it `POST`s `/demo/sessions` (which mints a session from the boot-loaded `local/demo_session.json`) and postMessages the JWT to the iframe — the same handshake the iframe runs against a real integrator in production.
- Default → production: mTLS for `POST /sessions`, no `/demo/*` routes, no on-disk credentials. The integrator's own page is the parent of the iframe.

The chat code path AND the session-creation handshake are identical from `POST /{demo/,}sessions` onward — only the *transport* of the session config differs (disk file vs HTTPS payload, same JSON shape).

## Consequences

- "Graduate from demo to production" = environment / boot flags change plus the integrator wires their own backend to `POST /sessions`. The bundled UI is unchanged.
- Bugs in the chat path AND in the session-creation handshake affect both modes — demo serves as a continuous smoke test of the prod protocol shape, not just the chat loop.
- Demo mode must be self-evidently for testing only — documented as not for production (single-tenant, disk-held credentials, no integrator authority).

## Alternatives considered

- **Separate demo artifact** — drifts from production; reduces the value of demo as smoke test.
- **Demo mode as a runtime mode toggle without on-disk credentials** — would require still going through `POST /sessions`, defeating the "edit one file + one docker run" goal.
