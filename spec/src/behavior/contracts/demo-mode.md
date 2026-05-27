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
3. **Loads the demo session config once at boot** from `local/demo_session.json` (a fixed path; the demo config doubles as the canonical local-dev entry point, so the location is not configurable). The file's shape is the same as the production `POST /sessions` body — so the demo config is a literal preview of what an integrator would send over HTTP. Required top-level fields: `user_id` (matching `^[a-zA-Z0-9._-]{1,100}$` — see [contract-storage-hot](storage-hot.md) §"Identifier alphabet"), `model.{provider,model_id,api_key}`, `system_prompt`. Optional: `storage` (cold-storage credentials — absent ⇒ hot-only, history lost on restart), `connectors[]` (typed MCP / RAG entries, same shape as production), `theme` (`"light"` default or `"dark"`). **The file is read exactly once at boot** and held in memory; subsequent file-system changes do not affect the running process. If the file is missing or malformed (invalid JSON, missing required field, bad connector entry, `user_id` outside the safe alphabet, or `model.api_key` still equal to the committed template placeholder), augchatd refuses to boot and prints a single human-readable line (no Bun stack trace, exit 1) — for the missing-file case the line includes the copy-paste `cp local/demo_session.json.example …` hint.

   **Deployment-level env vars** (not per-session):
   - `DEMO_TTL_SECONDS` — JWT lifetime in seconds (default `60`). Low default so the refresh path stays exercised in dev. Empty string (`""`) and any non-numeric / non-positive value fall back to the default.

   **Mode-agnostic operational env vars** (read in both demo and production):
   - `AUGCHATD_MODE` — set to `demo` (case-insensitive — `Demo`, `DEMO` work too) to enable the demo path. Any other value (or unset) boots production mode; per [http-get-healthz](../../contracts/http-get-healthz.md) this is the *only* discriminator. A typo (`demmo`, `demo-mode`) silently boots production — operators rely on the `mode` field in `/healthz` to detect this.
   - `AUGCHATD_PORT` (or `PORT`) — listen port. Default `8080`. Must be a plain non-negative integer (`8080`, not `8080abc`); boot refuses an invalid value.
   - `AUGCHATD_DATA_DIR` — hot-storage root. Default `./data`. The per-`(tenant, user)` SQLite file lands at `<root>/<tenantId>/<userId>.sqlite` (see [contract-storage-hot](storage-hot.md)).
   - `AUGCHATD_TRACE_DIR` — when set, each `POST /chat` appends a per-conversation JSONL trace at `<dir>/<conversation_id>.jsonl`. Unset (or empty string `""`) ⇒ off (zero filesystem cost). See [constraint-observability](../../constraints/observability.md).
4. **Probes the LLM credential** by calling the provider's list-models endpoint with `model.api_key`. A non-2xx upstream response prints a single-line error (`LLM credential probe failed for <provider>: …`) and refuses the boot (exit 1). Mirrors the S3 writability check from [contract-session-create](session-create.md); catches a bad key at boot instead of at first chat.
5. **Initializes MCP/RAG connector clients once at boot** (they are expensive — MCP handshake, RAG client setup). Subsequent demo sessions share these clients via the module-level connector registry keyed by `descriptive_id`.
6. Serves a **`POST /demo/sessions`** endpoint (no auth) that mints a **fresh session per call** — same response shape as production `POST /sessions`: `{ session_id, jwt, expires_at, theme }`. Each call creates a new `session_id` (UUID); all such sessions share the single `(tenant="demo", user=<user_id from local/demo_session.json>)` hot SQLite — mirroring what production does when one user has multiple concurrent sessions.
7. Serves a **`GET /demo/`** (and the wildcard `GET /demo/*`) **wrapper page** that exercises the same iframe + postMessage handshake an integrator will use in production (see [contract-ui-handshake](ui-handshake.md)). The wrapper is the "fake integrator": it POSTs `/demo/sessions` for the JWT and then postMessages it to the iframe. The wildcard so `/demo/c/<cid>` resolves to the same wrapper — the iframe's internal route is mirrored to the parent's URL pathname so a hard reload preserves the conversation.
8. Behaves identically to production mode from the chat path onward — same tool-use loop, same connector dispatch, same storage rules.

> Demo's only difference from production is the source of session config: a JSON file on disk (consumed by `POST /demo/sessions`) instead of an mTLS-authenticated integrator payload (consumed by `POST /sessions`). The two share the same JSON shape; only the transport differs. Everything from the iframe handshake forward is identical — the same code paths in the same binary.

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

- Demo mode is **single-tenant** (`tenantId` hardcoded to `"demo"`); `userId` flows through from `local/demo_session.json` so multiple developers can keep their own per-user hot SQLite under `<AUGCHATD_DATA_DIR>/demo/<userId>.sqlite`.
- Demo mode holds credentials in process memory, loaded once at boot from a JSON file on disk (no secret manager).
- Demo mode does not negotiate per-end-user provisioning — every `POST /demo/sessions` returns a session bound to the same config-supplied model/connectors/system prompt.
- Demo mode is for local testing and public demos only — not a production path.
- Demo sessions accumulate in the in-memory registry over the process lifetime (one per `POST /demo/sessions` call). Eviction is out of scope for demo; in production, the lifecycle contract handles this (see [contract-storage-hot](storage-hot.md)).

## Tests this contract implies

- Boot with `AUGCHATD_MODE=demo` and a valid `local/demo_session.json` → wrapper page loads at `/demo/`, handshake completes, chat works.
- Boot without demo mode → `POST /demo/sessions`, `GET /demo/`, `GET /demo/*` are all absent (404).
- In demo mode, `POST /sessions` (with or without mTLS) returns 404.
- In demo mode, `DELETE /sessions/:id` returns 404.
- Session config file missing → process fails to boot, prints **only** the `cp local/demo_session.json.example …` hint paragraph (no Bun stack trace), exits 1.
- Session config file malformed (invalid JSON, missing required fields, bad connector entry) → process fails to boot with a single-line error pointing at the offending field (e.g. `local/demo_session.json: "model.api_key" must be a non-empty string`); no stack trace; exits 1.
- `model.api_key` still equals the committed template placeholder (`sk-replace-me` or `REPLACE_ME`) → process fails to boot with a placeholder-detection error naming the file to edit; exits 1. (Catches the most common first-run mistake: `cp .example` then forget to fill in the key.)
- `model.api_key` is a well-formed but invalid key (e.g. revoked, wrong provider, typo) → boot prints `LLM credential probe failed for <provider>: <upstream error>` and exits 1 — same posture, different cause.
- `connectors[]` containing valid MCP / RAG entries → those connectors are present at chat time and toggleable per conversation.
- `storage` omitted → boot succeeds; conversation history is hot-only for the lifetime of the process.
- Two sequential `POST /demo/sessions` calls return distinct `session_id`s; both JWTs validate against the in-memory registry; both can chat against the same SQLite hot store.
- Visiting `/demo/c/<existing-cid>` and then hard-reloading lands the iframe on `/c/<existing-cid>` and hydrates the conversation's messages.
- Graduation: same binary boots production by setting different env / running mTLS — no separate build.
