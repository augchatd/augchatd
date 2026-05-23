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
2. **Does not accept `POST /sessions` or `DELETE /sessions/:id`** — both return `404`. The demo session is bound **at process boot from environment variables**, not minted per request, and demo has no integrator authority to forcibly delete (no mTLS). The integrator-facing surface is closed in demo mode.
3. Loads a **single fixed session** from environment variables:
   - `DEMO_MODEL_PROVIDER`, `DEMO_MODEL_ID`, `DEMO_MODEL_API_KEY`, `DEMO_SYSTEM_PROMPT` — required for the model.
   - `DEMO_CONNECTORS` (a JSON string) **or** `DEMO_CONNECTORS_FILE` (a filesystem path to a JSON file with the same shape) — optional. Same shape as the production session payload's `connectors[]`. Absent ⇒ no connectors (plain chat). The file variant is recommended whenever the JSON carries credentials (env vars leak to shell history, process listings, and committed compose files). **The file is read exactly once at boot** and held in memory; subsequent file-system changes do not affect the running process.
   - `DEMO_S3_URI` — optional, the cold-storage bucket (same format as the production `storage.s3` field). Absent ⇒ hot storage only; conversations live for the lifetime of the process and are lost on restart. Acceptable for local demos.
   - `DEMO_THEME` — optional, `"light"` (default) or `"dark"`. Sets the UI color palette the bundled UI applies on first paint. **PENDING RECONCILIATION** — implemented; spec write-up tracked as item in augchatd/augchatd#5 ("Per-session UI theme"). Production equivalent will be a `theme` field on `POST /sessions`.
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
- The browser API (`GET /conversations`, `POST /chat`, `GET /conversations/:cid/connectors`, `PUT /conversations/:cid/connectors/:descriptive_id`, etc.) works exactly as in production once the demo JWT is held.

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
- `DEMO_CONNECTORS` with a valid JSON `connectors[]` array → those connectors are present at chat time and toggleable per conversation.
- `DEMO_CONNECTORS_FILE` pointing to a readable JSON file → same as above; the file's content is the array.
- Both `DEMO_CONNECTORS` and `DEMO_CONNECTORS_FILE` set → process fails to boot with a clear error (no precedence; integrator must pick one).
- Either variant malformed → process fails to boot with a clear error (no silent fallback to no-connectors).
- `DEMO_S3_URI` absent → boot succeeds; the flush path is disabled and conversation history is hot-only for the lifetime of the process.
- Graduation: same binary boots production by setting different env / running mTLS — no separate build.
