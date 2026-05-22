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
2. **Does not accept `POST /sessions`** (the endpoint is not exposed — see [Failure modes](#failure-modes) below). The demo session is bound **at process boot from environment variables**, not minted per request.
3. Loads a **single fixed session** from environment variables:
   - `DEMO_MODEL_PROVIDER`, `DEMO_MODEL_ID`, `DEMO_MODEL_API_KEY`, `DEMO_SYSTEM_PROMPT` — required for the model.
   - `DEMO_CONNECTORS` — optional, a JSON-encoded `connectors[]` array (same shape as the production session payload's `connectors[]`). Absent ⇒ no connectors (plain chat).
   - `DEMO_S3_URI` — required, the cold-storage bucket (same format as the production `storage.s3` field).
4. Serves a **`GET /demo/jwt`** endpoint (no auth) that returns a JWT for that fixed session.
5. Serves the bundled UI on the same port; the UI fetches the JWT from `GET /demo/jwt` instead of receiving it via `postMessage` from an integrator.
6. Behaves identically to production mode from the chat path onward — same tool-use loop, same connector dispatch, same storage rules.

> Demo mode is **boot-time configuration**, not a runtime session protocol. Everything that production negotiates over mTLS is hard-coded into the process for the lifetime of the boot.

## Observable outcomes

- `docker run -p 8080:8080 -e AUGCHATD_MODE=demo ...` starts a working chat at `http://localhost:8080`.
- `GET /demo/jwt` returns a JWT only in demo mode; in production mode the endpoint is absent or returns 404.
- `GET /healthz` returns `"mode": "demo"` (see [http-get-healthz](../../contracts/http-get-healthz.md)) — operators rely on this to fail accidental production deploys.
- The bundled UI displays a visible **"Demo session — not authenticated"** banner on every page. The banner is rendered from inside the augchatd origin (iframe content); an integrator's parent page cannot style or hide it, by browser same-origin policy.
- The chat works without any mTLS client cert.
- The browser API (`GET /conversations`, `POST /chat`, `GET /connectors`, `GET /conversations/:cid/connectors`, `PUT /conversations/:cid/connectors/:descriptive_id`, etc.) works exactly as in production once the demo JWT is held.

## Failure modes

In demo mode, the following endpoints are **absent** (404):

- `POST /sessions` — session minting is bypassed; demo's fixed session is the only one.
- `DELETE /sessions/:id` — forced logout has no integrator authority in demo (no mTLS).

Calls to either return `404 Not Found`. The integrator-facing surface is closed in demo mode.

## Non-promises

- Demo mode is **single-tenant** (`tenantId = "demo"`).
- Demo mode holds credentials in the process environment (no secret manager).
- Demo mode does not negotiate per-end-user provisioning — only the one session that booted is available.
- Demo mode is for local testing and public demos only — not a production path.

## Tests this contract implies

- Boot with `AUGCHATD_MODE=demo` plus required env vars → UI loads, JWT retrievable, chat works.
- Boot without demo mode → `GET /demo/jwt` is unavailable.
- In demo mode, `POST /sessions` (with or without mTLS) returns 404.
- In demo mode, `DELETE /sessions/:id` returns 404.
- `DEMO_CONNECTORS` with a valid JSON `connectors[]` array → those connectors are present at chat time and toggleable via `GET/PUT /connectors`.
- `DEMO_CONNECTORS` malformed → process fails to boot with a clear error (no silent fallback to no-connectors).
- Graduation: same binary boots production by setting different env / running mTLS — no separate build.
