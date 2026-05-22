---
id: contract-connector-toggle
type: behavior-contract
status: proposed
capability: cap-connectors
evidence:
  - source: README.md
    section: "README header (connectors paragraph)"
links:
  - relation: depends_on
    target: technical-contract-http-get-conversation-connectors
  - relation: depends_on
    target: technical-contract-http-put-conversation-connector-state
  - relation: refines
    target: contract-session-chat
  - relation: refines
    target: adr-0010-unified-connector-model
---

# Contract — Connector toggle (per conversation)

## Promise

For each conversation in a live session, the browser can:

1. **List a conversation's connectors with their active state** via `GET /conversations/:conversation_id/connectors`.
2. **Toggle** an individual connector's active state **for that conversation** via `PUT /conversations/:conversation_id/connectors/:descriptive_id { active: bool }`.

Both responses are free of credentials, URLs, and auth.

Active state is **persisted as part of the conversation**:

- A conversation's saved flag for a connector is captured **once**, at first observation of that connector in the conversation's purview (`POST /conversations` for connectors in scope at creation; first `GET` / chat for connectors that enter scope later). After capture, only explicit `PUT`s mutate it.
- Toggle changes are saved alongside the conversation in hot SQLite and flushed to cold S3 (see [contract-storage-hot](storage-hot.md), [contract-storage-flush](storage-flush.md)).
- A future session loading the same conversation — after JWT expiry, idle disconnect, forced delete + re-mint, or any other path — sees the saved active states. The user does not have to retoggle.
- Different conversations of the same user have independent active states.
- Full reconciliation rules when the resolved scope changes between sessions live in [adr-0010-unified-connector-model](../../architecture/adrs/0010-unified-connector-model.md#persistence-of-active-state-per-conversation).

Subsequent chat turns observe the conversation's current active set. The active set is **captured at the start of each chat turn** ([contract-session-chat](session-chat.md)); toggling that races with an in-flight turn does **not** abort tool calls already running.

The end user can only **narrow** the resolved scope by turning connectors off **for the current conversation**. They cannot add a connector — the session's connector list is fixed at session creation by the integrator (see [adr-0010](../../architecture/adrs/0010-unified-connector-model.md)).

## Observable outcomes

- `GET /conversations/:cid/connectors` returns the per-conversation active list with `active` flags.
- A `POST /conversations` snapshots `default_active` into saved state for every connector then in scope; the immediate `GET /conversations/:cid/connectors` returns those values.
- `PUT /conversations/:cid/connectors/:descriptive_id { active: false }` flips the connector off **for that conversation**; the next `POST /chat` against that conversation does not expose its tools.
- A `PUT` with an extra field beyond `{ active }`, or a wrong-typed `active`, returns `400`; no state changes.
- After a forced re-mint (`DELETE /sessions/:id` then `POST /sessions`) the next session re-loads the same `:cid` and serves it with its previously-saved active states.
- `PUT /conversations/:unknown_cid/...` or `PUT /conversations/:cid/connectors/:unknown_id` returns `404`; no state is changed.
- `DELETE /conversations/:cid` removes the conversation's saved active states along with the rest of its data.

## Non-promises

- Toggling does not abort in-flight tool calls already issued in the current turn.
- Toggling does not modify the connector's configuration (credentials, URL, indexes). Only the per-conversation active flag changes.
- The end user cannot **add** a connector via toggling. The session's connector list is fixed at session creation.

## Tests this contract implies

- A fresh conversation: `GET /conversations/:cid/connectors` returns each in-scope connector with `active = default_active` (matching the snapshot taken at `POST /conversations`).
- `PUT /conversations/:cid/connectors/X { active: false }` then `POST /chat` against `:cid`: X's tool is not invoked.
- `PUT /conversations/:cidA/connectors/X { active: false }` then `POST /chat` against `:cidB` (a different conversation of the same user): X's tool IS invoked for `:cidB`.
- Save state on `:cid` with `rag_internal = false`; force re-mint; reload `:cid`; `GET /conversations/:cid/connectors` still shows `rag_internal: false`.
