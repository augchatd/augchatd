---
id: technical-contract-http-put-conversation-connector-state
type: technical-contract
status: proposed
evidence:
  - source: README.md
    section: "Connectors (per-conversation toggle)"
links:
  - relation: supports
    target: contract-connector-toggle
---

# Technical contract — `PUT /conversations/:conversation_id/connectors/:descriptive_id`

## Purpose

Sets the active state of one connector **for one conversation**. The change is persisted as part of the conversation (hot SQLite, flushed to cold S3 like any other conversation state) so it survives session re-mints.

## Auth

**JWT** (Bearer). Same JWT that authorizes `POST /chat`.

## Request

`PUT /conversations/:conversation_id/connectors/:descriptive_id`
`Content-Type: application/json`

```json
{ "active": true }
```

| Field | Type | Notes |
| --- | --- | --- |
| `active` | boolean | New active state. Required. Extra fields are rejected. |

| Path parameter | Notes |
| --- | --- |
| `:conversation_id` | A conversation owned by the current session's user. |
| `:descriptive_id` | A connector currently in the session's resolved scope. |

## Response — success

`200 OK`
`Content-Type: application/json`

```json
{
  "descriptive_id": "rag_public",
  "name":           "Base de conhecimentos pública",
  "type":           "rag",
  "active":         true
}
```

Returns the same single-entry shape as one element of [`GET /conversations/:cid/connectors`](http-get-conversation-connectors.md).

## Persistence

The new active state is written to the conversation's storage on the same path as messages (hot SQLite → cold S3 on flush). A subsequent session that loads this conversation sees the saved state — the user does not have to retoggle.

## Idempotency

A `PUT` with `{ active: <current state> }` is a no-op and returns 200 with the unchanged state. Safe to retry.

## Response — failure modes

- `400` — malformed body (missing `active`, wrong type, extra fields).
- `401` — invalid/expired JWT.
- `404` — `:conversation_id` unknown for this user, or `:descriptive_id` not in this session's resolved scope.

## Effect on in-flight chat turns

The mutation is **applied immediately** to the conversation's saved state. However, [contract-session-chat](../behavior/contracts/session-chat.md) snapshots the active set at the **start** of each turn for the conversation being chatted with; an in-flight turn that already chose a tool for an inactive connector is **not** aborted. The next turn against the same conversation observes the new state.

Toggling a connector in conversation A does **not** affect conversation B's saved state — each conversation is independent.

## Related

- Behavior: [contract-connector-toggle](../behavior/contracts/connector-toggle.md)
- Listing: [http-get-conversation-connectors](http-get-conversation-connectors.md)
- Resolved scope: [http-get-connectors](http-get-connectors.md)
