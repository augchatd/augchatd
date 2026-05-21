---
id: contract-demo-mode
type: behavior-contract
status: proposed
capability: cap-demo
evidence:
  - source: README.md@e562b2b
    section: "Quick Start (demo mode)"
links:
  - relation: refines
    target: contract-session-create
  - relation: refines
    target: contract-ui-handshake
---

# Contract — Demo mode

## Promise

When `AUGCHATD_MODE=demo` is set at boot, augchatd:

1. **Skips mTLS** entirely.
2. Loads a **single fixed session** from environment variables (`DEMO_MODEL_PROVIDER`, `DEMO_MODEL_ID`, `DEMO_MODEL_API_KEY`, `DEMO_SYSTEM_PROMPT`, plus optional `DEMO_MCP_SERVERS` and `DEMO_RAG_*`).
3. Serves a **`GET /demo/jwt`** endpoint that returns a JWT for that fixed session.
4. Serves the bundled UI on the same port; the UI fetches the JWT from `GET /demo/jwt` instead of receiving it via `postMessage` from an integrator.
5. Behaves identically to production mode from the chat path onward.

## Observable outcomes

- `docker run -p 8080:8080 -e AUGCHATD_MODE=demo ...` starts a working chat at `http://localhost:8080`.
- `GET /demo/jwt` returns a JWT only in demo mode; in production mode the endpoint is absent or returns 404.
- The chat works without any mTLS client cert.

## Non-promises

- Demo mode is **single-tenant**.
- Demo mode holds credentials in the process environment (no secret manager).
- Demo mode is for local testing and public demos only — not a production path.

## Tests this contract implies

- Boot with `AUGCHATD_MODE=demo` plus required env vars → UI loads, JWT retrievable, chat works.
- Boot without demo mode → `GET /demo/jwt` is unavailable.
- Graduation: same binary boots production by setting different env / running mTLS — no separate build.
