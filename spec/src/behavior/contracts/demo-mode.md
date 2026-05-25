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
2. **Does not accept `POST /sessions` or `DELETE /sessions/:id`** — both return `404`. The integrator-facing surface is closed in demo mode.
3. **Loads the demo config once at boot** from environment variables:
   - `DEMO_MODEL_PROVIDER`, `DEMO_MODEL_ID`, `DEMO_MODEL_API_KEY`, `DEMO_SYSTEM_PROMPT` — required for the model.
   - `DEMO_CONNECTORS` (JSON string) **or** `DEMO_CONNECTORS_FILE` (filesystem path to a JSON file with the same shape) — optional. Same shape as the production session payload's `connectors[]`. Absent ⇒ no connectors (plain chat). The file variant is recommended whenever the JSON carries credentials. **The file is read exactly once at boot** and held in memory; subsequent file-system changes do not affect the running process.
   - `DEMO_S3_URI` — optional cold-storage bucket. Absent ⇒ hot-only; history lost on restart.
   - `DEMO_THEME` — optional, `"light"` (default) or `"dark"`. Production equivalent will be a `theme` field on `POST /sessions`.
   - `DEMO_TTL_SECONDS` — optional JWT lifetime in seconds (default `60`). Low default so the refresh path stays exercised in dev.

   **Mode-agnostic operational env vars** (read in both demo and production):
   - `AUGCHATD_PORT` (or `PORT`) — listen port. Default `8080`.
   - `AUGCHATD_DATA_DIR` — hot-storage root. Default `./data`. The per-`(tenant, user)` SQLite file lands at `<root>/<tenantId>/<userId>.sqlite` (see [contract-storage-hot](storage-hot.md)).
   - `AUGCHATD_TRACE_DIR` — when set, each `POST /chat` appends a per-conversation JSONL trace at `<dir>/<conversation_id>.jsonl`. Unset ⇒ off (zero filesystem cost). See [constraint-observability](../../constraints/observability.md).
4. **Initializes MCP/RAG connector clients once at boot** (they are expensive — MCP handshake, RAG client setup). Subsequent demo sessions share these clients via the module-level connector registry keyed by `descriptive_id`.
5. Serves a **`POST /demo/sessions`** endpoint (no auth) that mints a **fresh session per call** — same response shape as production `POST /sessions`: `{ session_id, jwt, expires_at, theme }`. Each call creates a new `session_id` (UUID); all such sessions share the single `(tenant="demo", user="demo")` hot SQLite — mirroring what production does when one user has multiple concurrent sessions.
6. Serves a **`GET /demo/`** (and the wildcard `GET /demo/*`) **wrapper page** that exercises the same iframe + postMessage handshake an integrator will use in production (see [contract-ui-handshake](ui-handshake.md)). The wrapper is the "fake integrator": it POSTs `/demo/sessions` for the JWT and then postMessages it to the iframe. The wildcard so `/demo/c/<cid>` resolves to the same wrapper — the iframe's internal route is mirrored to the parent's URL pathname so a hard reload preserves the conversation.
7. Behaves identically to production mode from the chat path onward — same tool-use loop, same connector dispatch, same storage rules.

> Demo's only difference from production is the source of session config: env vars (consumed by `POST /demo/sessions`) instead of an mTLS-authenticated integrator payload (consumed by `POST /sessions`). Everything from the iframe handshake forward is identical — the same code paths in the same binary.

## Observable outcomes

- `docker run -p 8080:8080 -e AUGCHATD_MODE=demo ...` starts a working chat at `http://localhost:8080/demo/`.
- `POST /demo/sessions` returns a JSON `{ session_id, jwt, expires_at, theme }` only in demo mode; in production it is absent (returns 404).
- `GET /demo/`, `GET /demo`, `GET /demo/c/<anything>` all return the wrapper HTML in demo mode; absent in production.
- Each `POST /demo/sessions` returns a **distinct** `session_id` (UUIDs), and the in-memory session registry holds them as separate records.
- `GET /healthz` returns `"mode": "demo"` (see [http-get-healthz](../../contracts/http-get-healthz.md)) — operators rely on this to fail accidental production deploys.
- The bundled UI displays a visible **"Demo session — not authenticated"** banner on every page. The banner is rendered from inside the augchatd origin (iframe content); an integrator's parent page cannot style or hide it, by browser same-origin policy.
- The chat works without any mTLS client cert.
- The browser API (`POST /chat`, `GET /conversations`, `PUT /conversations/:cid/connectors/:descriptive_id`, etc.) works exactly as in production once the demo JWT is held.
- Internal route changes inside the iframe (e.g. minting a fresh conversation produces `/c/<cid>`) are mirrored to the parent URL as `/demo/c/<cid>`, so the conversation id appears in server logs and survives a hard reload.

## Non-promises

- Demo mode is **single-tenant** (`tenantId = "demo"`, `userId = "demo"`).
- Demo mode holds credentials in the process environment (no secret manager).
- Demo mode does not negotiate per-end-user provisioning — every `POST /demo/sessions` returns a session bound to the same env-supplied model/connectors/system prompt.
- Demo mode is for local testing and public demos only — not a production path.
- Demo sessions accumulate in the in-memory registry over the process lifetime (one per `POST /demo/sessions` call). Eviction is out of scope for demo; in production, the lifecycle contract handles this (see [contract-storage-hot](storage-hot.md)).

## Tests this contract implies

- Boot with `AUGCHATD_MODE=demo` plus required env vars → wrapper page loads at `/demo/`, handshake completes, chat works.
- Boot without demo mode → `POST /demo/sessions`, `GET /demo/`, `GET /demo/*` are all absent (404).
- In demo mode, `POST /sessions` (with or without mTLS) returns 404.
- In demo mode, `DELETE /sessions/:id` returns 404.
- `DEMO_CONNECTORS` with a valid JSON `connectors[]` array → those connectors are present at chat time and toggleable per conversation.
- `DEMO_CONNECTORS_FILE` pointing to a readable JSON file → same as above.
- Both `DEMO_CONNECTORS` and `DEMO_CONNECTORS_FILE` set → process fails to boot with a clear error.
- Either variant malformed → process fails to boot with a clear error.
- `DEMO_S3_URI` absent → boot succeeds; conversation history is hot-only for the lifetime of the process.
- Two sequential `POST /demo/sessions` calls return distinct `session_id`s; both JWTs validate against the in-memory registry; both can chat against the same SQLite hot store.
- Visiting `/demo/c/<existing-cid>` and then hard-reloading lands the iframe on `/c/<existing-cid>` and hydrates the conversation's messages.
- Graduation: same binary boots production by setting different env / running mTLS — no separate build.
