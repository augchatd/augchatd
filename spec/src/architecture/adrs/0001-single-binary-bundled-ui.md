---
id: adr-0001-single-binary-bundled-ui
type: adr
status: current
evidence:
  - source: README.md@e562b2b
    section: "README header / What augchatd does (bundled UI) / UI integration"
  - source: src/routes/static-ui.ts@06313ae
    section: "mountStaticUi — serves ui/dist on the same origin"
  - source: src/server.ts@06313ae
    section: "createApp wires static-ui under non-API paths"
links:
  - relation: supports
    target: req-007-bundled-ui
---

# ADR 0001 — Single binary serves API and bundled UI on the same origin

## Context

Integrators want chat in their B2B SaaS but do not want to host another frontend (asset pipeline, deploy step, version), and JWT exposure across origins is an unnecessary risk surface.

## Decision

augchatd is **one binary** that serves:

- the JSON HTTP API (mTLS for setup; JWT for browser chat)
- the bundled chat UI (built on [assistant-ui](https://github.com/assistant-ui/assistant-ui))

…on the **same origin**. Integrators embed the UI as an `<iframe>` and pass the JWT via `postMessage`.

## Consequences

- The integrator has no separate UI to host.
- The JWT travels iframe ↔ augchatd on a single origin; no CORS configuration for the JWT API.
- The bundled UI is the only supported client; the JWT API is not a public surface (see [req-007](../../behavior/requirements/req-007-bundled-ui.md)).
- Releasing UI improvements ships in the same binary as backend changes.

## Alternatives considered

- **Headless backend, integrator ships UI** — duplicates work and ties integrator release cycles to chat iteration.
- **Separate UI deployment** — adds an asset pipeline and a CORS surface that does not need to exist.
