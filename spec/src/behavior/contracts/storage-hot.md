---
id: contract-storage-hot
type: behavior-contract
status: proposed
capability: cap-storage
evidence:
  - source: README.md@e562b2b
    section: "Storage / Status (Bun embedded SQLite)"
  - source: README.md
    section: "Storage (per-user layout)"
links:
  - relation: satisfies
    target: req-004-tier-stored-history
  - relation: depends_on
    target: contract-session-create
  - relation: enables
    target: contract-storage-flush
---

# Contract — Hot storage (embedded SQLite, one DB per (tenant, user))

> [!WARNING] PENDING RECONCILIATION — identifier sanitization
> - **Detected**: 2026-05-25 by /code-changed (audit consolidation, augchatd/augchatd#9 §H1)
> - **Sources in conflict**: this contract's "one file per (tenantId, userId) pair" + the tenant-isolation invariant vs `src/storage.ts:56-58` (`sanitize()` replaces any non-`[a-zA-Z0-9._-]` char with `_` and truncates at 100 chars). Two distinct integrator-supplied `user_id` values (e.g. `"a/b"` vs `"a_b"`, or two long IDs sharing the first 100 chars) collapse onto the same SQLite file — cross-user data mixing within the same tenant.
> - **Nature**: in demo this is moot (tenant + user are both literal `"demo"`). With production session minting, an integrator passing an `id` containing `/`, spaces, or any other non-alphanumeric char silently lands in a shared file. The sanitize was added as a safety belt against malicious paths; what it actually does is convert one safety problem (path traversal) into another (silent collision).
> - **Proposed direction**: reject unsupported characters at session creation (`POST /sessions` 4xx with `invalid_user_id` / `invalid_tenant_id`) instead of sanitizing — same posture as the demo-config validator. Once that lands the sanitize is defense-in-depth, not the user-facing rule. No integrators today, so the tightening is safe.
> - **Decision owner**: project owner.

> [!NOTE] Implementation status (partial)
> Implemented on branch `trace-conversations` for the demo path:
>
> - Layout `<AUGCHATD_DATA_DIR>/<tenantId>/<userId>.sqlite` with `bun:sqlite`
>   (`PRAGMA journal_mode = WAL`, `PRAGMA synchronous = NORMAL` — the
>   WAL-appropriate setting; trades a tiny crash-window for throughput vs.
>   `synchronous = FULL`).
> - Schema covers `conversation` (id, session_id, model_id_override),
>   `connector_state` (the canonical per-conversation active map), and
>   `message` (UIMessage history, `parts_json` + `metadata_json` — the
>   metadata column carries per-assistant-message provenance
>   `{model_id, provider}` rendered by the UI as a model chip).
> - Writes are atomic; failures throw `HotWriteError` and the chat /
>   connectors / model handlers surface them as `503
>   X-Augchatd-Reason: hot-write-failed` per spec.
> - `data/` is gitignored.
>
> **Still PENDING:**
>
> - **Flush to cold S3** ([contract-storage-flush](storage-flush.md)) — not implemented.
> - **Multi-session file lifecycle** — the demo runs one process with one
>   session, so file-removal-after-all-sessions-end is not exercised.
>   Will land with prod `POST /sessions` + session bookkeeping.
> - **Production routing** (lazy-open per session for arbitrary tenants/users)
>   — the demo opens one DB at boot and reuses it. The `openHotDb` helper
>   already keys by `(tenant, user)`; prod just needs to call it on session
>   bind instead of at boot.
> - **UI-side message hydration on page reload** — RESOLVED for the
>   demo path. The bundled UI uses `/c/<conversation_id>` as the URL
>   convention: on boot it parses the path, GETs
>   `/conversations/<cid>/messages` to hydrate the runtime, and falls
>   back to mint+`replaceState` on 404. The auth boundary stays
>   implicit (per-`(tenant, user)` SQLite partition). Tracked as item
>   10 in augchatd/augchatd#5 for spec write-up.
>
> Status stays `proposed` (no test-pointers yet; partial implementation).

## Promise

While any session for a given (tenant, user) is live, that user's conversation state lives in an **internal SQLite database** managed by augchatd, using Bun's embedded SQLite.

- Layout on disk: `data/<tenantId>/<userId>.sqlite` — one file per `(tenantId, userId)` pair.
- The file is created when the first session for that user (under that tenant) connects.
- **Lifecycle (hard rule):** the file lives while **any** session for `(tenantId, userId)` is alive. It is closed and deleted only after **all** sessions for that user have ended **and** the user's conversations have been flushed to cold (see [storage-flush](storage-flush.md)).
- A tenant folder with no remaining user files is removed.

This partitioning eliminates write contention between concurrent end users of the same tenant — each user has their own SQLite writer lock.

Each conversation in the file holds, alongside its messages, the **per-conversation connector active state** (a map `descriptive_id → active boolean`). See [contract-connector-toggle](connector-toggle.md) and [adr-0010](../../architecture/adrs/0010-unified-connector-model.md).

## Observable outcomes

- A live chat turn reads and writes through the hot DB.
- Two end users of the same tenant chatting concurrently write to two distinct SQLite files; neither blocks the other on a writer lock.
- Two mTLS tenants run under two distinct subdirectories (`data/<A>/...` vs `data/<B>/...`) with no shared files.
- A second session for the same `(tenant, user)` while the first is still alive **reuses** the existing file — it is not recreated.
- A session ending while another for the same user remains alive does **not** remove the file.
- Process restart preserves the hot DB (it is on disk, not memory-only).

## Canonical row, no per-session cache

A single conversation's per-connector active state (and the messages alongside it) lives in **one** row per `(cid, descriptive_id)` in the user's SQLite file. `PUT /conversations/:cid/connectors/:descriptive_id` writes to that canonical row; idle/disconnect flush reads the canonical row at flush time. Implementations MUST NOT carry a per-session in-memory cache of the active map that flush could write back over a recent `PUT`. This makes multi-device toggles (same user, two device sessions, one toggling while the other is about to flush) behave under the same last-write-wins rule as concurrent toggles on a single device.

## Hot-write failure surface

A hot SQLite write failure during a `PUT /conversations/:cid/connectors/:descriptive_id` or during a first-observation snapshot surfaces to the caller as `503` with `X-Augchatd-Reason: hot-write-failed`. No partial state is committed. This is distinct from the cold-flush stall (`X-Augchatd-Reason: flush-stalled`, see [storage-flush](storage-flush.md)) — they can co-occur on a degraded node but they have different causes and different retry strategies.

## Schema evolution

The schema lives in `src/storage.ts` as a single `CREATE TABLE IF NOT EXISTS …` block plus a `MIGRATIONS` array of forward-only statements (`ALTER TABLE … ADD COLUMN …`). On every `openHotDb`, the block runs (idempotent for already-created tables) and each migration runs inside a swallowing try/catch — SQLite has no `ADD COLUMN IF NOT EXISTS`, so the second-run "duplicate column" error is the expected idempotency signal. Adding a column means appending one statement to `MIGRATIONS`; dropping a column is not supported (forward-only). The schema is not versioned (no `schema_version` row); on-disk databases either have the column or get it on next boot.

## Non-promises

- augchatd does not expose the SQLite files to integrators; they are internal.
- augchatd does not encrypt SQLite files at rest. (Disk encryption is the operator's concern.)
- augchatd does not run an external database; no Postgres/MySQL/Redis dependency.
- augchatd does not guarantee a maximum number of open file handles — operators size `ulimit -n` per their concurrency profile.

## Tests this contract implies

- A live read returns previously-written messages of the same session.
- A second end user (same tenant) writing concurrently does not block the first.
- A second mTLS tenant's chat does not appear in the first tenant's subdirectory.
- A user with two concurrent sessions: ending one session leaves the file in place; ending both (after flush) removes the file.
- After a forced flush + idle, the hot row for the flushed conversation is gone (cleaned up post-success) but the file persists as long as any session for that user lives.
- A tenant subdirectory becomes empty (no user files) and is removed.
