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

> [!NOTE] Implementation status
> Fully implemented on branch `trace-conversations`: request/response
> shapes, all status codes (204/400/401/404/**503 + `X-Augchatd-Reason:
> hot-write-failed`**), last-write-wins. The backing store is hot SQLite
> per (tenant, user) — see [contract-storage-hot](../behavior/contracts/storage-hot.md).

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

No body. The caller already knows `descriptive_id`, `name`, and `type` (from the prior `GET /conversations/:cid/connectors`); the only mutating value is the boolean it just sent, and a successful `204` confirms it was committed. A `PUT` with `{ active: <current state> }` is a no-op and still returns `204` — safe to retry.

## Concurrency

**Last write wins.** augchatd does not coordinate concurrent `PUT`s against the same `(conversation_id, descriptive_id)` (e.g. two browser tabs toggling at once, or one device toggling while another is idle-flushing — see [contract-storage-hot](../behavior/contracts/storage-hot.md) on the canonical-row rule). The bundled UI must not assume its `PUT` reflects the absolute final state — re-fetch via `GET /conversations/:cid/connectors` to observe the committed value when concurrent writers are expected.

## Response — failure modes

- `400` — malformed body. Distinct error tokens: `invalid_json` (body is not valid JSON), `body_must_be_object` (top-level not an object), `only_active_field_allowed` (extra keys present or `active` missing), `active_must_be_boolean` (wrong type).
- `401` — invalid/expired JWT.
- `404` — `{ "error": "conversation_not_found" }` if `:conversation_id` is unknown for this user, or `{ "error": "<reason>" }` (e.g. `connector_not_in_scope`) if the cid exists but `:descriptive_id` is not in this session's resolved scope, or the conversation was deleted concurrently. PUTs do **not** auto-create the conversation — unlike `POST /chat` (which captures-on-first-observation), this endpoint requires a cid that has already been registered via `POST /conversations` or seen by a prior `POST /chat`.
- `503` with `X-Augchatd-Reason: hot-write-failed` — the hot SQLite write failed (disk full, file locked, transient I/O error). No state is committed; the client may retry. Distinct from `flush-stalled` (cold-storage stall), which the session may already be in for unrelated reasons.

## Effect on in-flight chat turns

The mutation is **applied immediately** to the conversation's saved state. However, [contract-session-chat](../behavior/contracts/session-chat.md) snapshots the active set at the **start** of each turn for the conversation being chatted with; an in-flight turn that already chose a tool for an inactive connector is **not** aborted. The next turn against the same conversation observes the new state.

Toggling a connector in conversation A does **not** affect conversation B's saved state — each conversation is independent.

## Related

- Behavior: [contract-connector-toggle](../behavior/contracts/connector-toggle.md)
- Listing: [http-get-conversation-connectors](http-get-conversation-connectors.md)
