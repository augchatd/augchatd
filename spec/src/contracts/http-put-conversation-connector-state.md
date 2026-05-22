---
id: technical-contract-http-put-conversation-connector-state
type: technical-contract
status: proposed
evidence:
  - source: README.md
    section: "README header (connectors paragraph)"
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

`204 No Content`

No body. The caller already knows `descriptive_id`, `name`, and `type` (from the prior `GET /conversations/:cid/connectors`); the only mutating value is the boolean it just sent, and a successful `204` confirms it was committed.

## Concurrency

**Last write wins.** augchatd does not coordinate concurrent `PUT`s against the same `(conversation_id, descriptive_id)` (e.g. two browser tabs toggling at once). The bundled UI must not assume its `PUT` reflects the absolute final state — re-fetch via `GET /conversations/:cid/connectors` to observe the committed value when concurrent writers are expected.

## Idempotency

A `PUT` with `{ active: <current state> }` is a no-op (still returns `204`). Safe to retry.

## Response — failure modes

- `400` — malformed body (missing `active`, wrong type, extra fields).
- `401` — invalid/expired JWT.
- `404` — `:conversation_id` unknown for this user, `:descriptive_id` not in this session's resolved scope, **or** the conversation was deleted concurrently. The delete and the rejection are atomic from the caller's point of view: a `204` means the value was committed to a still-live conversation; a `404` means nothing was changed.

## Effect on in-flight chat turns

The mutation is **applied immediately** to the conversation's saved state. However, [contract-session-chat](../behavior/contracts/session-chat.md) snapshots the active set at the **start** of each turn for the conversation being chatted with; an in-flight turn that already chose a tool for an inactive connector is **not** aborted. The next turn against the same conversation observes the new state.

Toggling a connector in conversation A does **not** affect conversation B's saved state — each conversation is independent.

## Related

- Behavior: [contract-connector-toggle](../behavior/contracts/connector-toggle.md)
- Listing: [http-get-conversation-connectors](http-get-conversation-connectors.md)
