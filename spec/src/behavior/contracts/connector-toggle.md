---
id: contract-connector-toggle
type: behavior-contract
status: proposed
capability: cap-connectors
evidence:
  - source: README.md
    section: "Connectors (per-conversation active state)"
links:
  - relation: depends_on
    target: contract-session-create
  - relation: depends_on
    target: technical-contract-http-get-connectors
  - relation: depends_on
    target: technical-contract-http-get-conversation-connectors
  - relation: depends_on
    target: technical-contract-http-put-conversation-connector-state
  - relation: refines
    target: contract-session-chat
  - relation: refines
    target: contract-storage-hot
  - relation: refines
    target: adr-0010-unified-connector-model
---

# Contract — Connector toggle (per conversation)

## Promise

For each conversation in a live session, the browser can:

1. **List the session's resolved scope** (provisioned connectors, no active flag) via `GET /connectors`.
2. **List a conversation's connectors with active state** via `GET /conversations/:conversation_id/connectors`.
3. **Toggle** an individual connector's active state **for that conversation** via `PUT /conversations/:conversation_id/connectors/:descriptive_id { active: bool }`.

All three responses are free of credentials, URLs, and auth.

Active state is **persisted as part of the conversation**:

- A new conversation starts with active states equal to each connector's `default_active`.
- Toggle changes are saved alongside the conversation in hot SQLite and flushed to cold S3 (see [contract-storage-hot](storage-hot.md), [contract-storage-flush](storage-flush.md)).
- A future session loading the same conversation — after JWT expiry, idle disconnect, forced delete + re-mint, or any other path — sees the saved active states. The user does not have to retoggle.
- Different conversations of the same user have independent active states.

Subsequent chat turns observe the conversation's current active set. The active set is **captured at the start of each chat turn** ([contract-session-chat](session-chat.md)); toggling that races with an in-flight turn does **not** abort tool calls already running.

The end user can only **narrow** the resolved scope by turning connectors off **for the current conversation**. They cannot add a connector — the session's connector list is fixed at session creation by the integrator (see [adr-0010](../../architecture/adrs/0010-unified-connector-model.md)).

## Scope reconciliation across re-mints

When a conversation is loaded into a session whose resolved scope has changed since the conversation was last touched:

- **In saved state AND in current scope** → restored to the saved active flag.
- **In current scope AND not in saved state** (new connector since last session) → starts at the connector's current `default_active`.
- **In saved state AND no longer in current scope** (connector removed by the integrator) → silently dropped at restore time. If the integrator later re-adds the same `descriptive_id`, the previously-saved active flag returns.

## Observable outcomes

- `GET /connectors` returns the resolved scope (descriptive_id, name, type) with **no** `active` field.
- `GET /conversations/:cid/connectors` returns the per-conversation active list with `active` flags.
- A new conversation created via `POST /conversations` immediately answers `GET /conversations/:cid/connectors` with `active = default_active` for every connector in the resolved scope.
- `PUT /conversations/:cid/connectors/:descriptive_id { active: false }` flips the connector off **for that conversation**; the next `POST /chat` against that conversation does not expose its tools.
- A simultaneous chat against a different conversation `:other_cid` is unaffected — its saved active states are independent.
- After a forced re-mint (`DELETE /sessions/:id` then `POST /sessions`) the next session re-loads the same `:cid` and serves it with its previously-saved active states.
- `PUT /conversations/:unknown_cid/...` or `PUT /conversations/:cid/connectors/:unknown_id` returns 404; no state is changed.
- `DELETE /conversations/:cid` removes the conversation's saved active states along with the rest of its data.

## Non-promises

- Toggling does not abort in-flight tool calls already issued in the current turn.
- Toggling does not modify the connector's configuration (credentials, URL, indexes). Only the per-conversation active flag changes.
- The end user cannot **add** a connector via toggling. The session's connector list is fixed at session creation; only the per-conversation active flag changes.
- augchatd does not synchronize active state across conversations of the same user. Each conversation is independent.
- augchatd does not expose a "user default active set" separate from per-conversation state. New conversations always start at `default_active`; if the integrator wants different defaults per user, they pass different `default_active` per session.

## Tests this contract implies

- `GET /connectors` returns entries with `{descriptive_id, name, type}` only; no `active` field present.
- `GET /conversations/:cid/connectors` for a newly-created conversation returns each connector with `active = default_active`.
- `PUT /conversations/:cid/connectors/X { active: false }` then `POST /chat` against `:cid`: X's tool is not invoked.
- `PUT /conversations/:cidA/connectors/X { active: false }` then `POST /chat` against `:cidB` (different conversation): X's tool IS invoked for `:cidB`.
- Save state on `:cid` with `rag_internal = false`; force re-mint; reload `:cid`; `GET /conversations/:cid/connectors` still shows `rag_internal: false`.
- Save state on `:cid` with `rag_internal = false`; integrator re-mints without `rag_internal`; `GET /conversations/:cid/connectors` omits `rag_internal`. Integrator re-mints again WITH `rag_internal`; reloading `:cid` shows `rag_internal: false` (saved state honored).
- `PUT /conversations/:cid/connectors/:unknown_id` → 404.
- `PUT /conversations/:unknown_cid/connectors/:descriptive_id` → 404.
- Listing response contains no field whose name appears in the session payload's connector secrets (e.g. `auth`, `api_key`, `cluster`).
