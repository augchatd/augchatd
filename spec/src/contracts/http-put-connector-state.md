---
id: technical-contract-http-put-connector-state
type: technical-contract
status: proposed
evidence:
  - source: README.md
    section: "Connectors (browser toggle)"
links:
  - relation: supports
    target: contract-connector-toggle
---

# Technical contract — `PUT /connectors/:descriptive_id`

## Auth

**JWT** (Bearer). Same JWT that authorizes `POST /chat`.

## Request

`PUT /connectors/:descriptive_id`
`Content-Type: application/json`

```json
{ "active": true }
```

| Field | Type | Notes |
| --- | --- | --- |
| `active` | boolean | New active state. Required. Extra fields are rejected. |

The `:descriptive_id` path parameter is the connector's `descriptive_id` as declared in the session-creation payload.

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

Returns the same single-entry shape as one element of [`GET /connectors`](http-get-connectors.md).

## Idempotency

A `PUT` with `{ active: <current state> }` is a no-op and returns 200 with the unchanged state. Safe to retry.

## Response — failure modes

- `400` — malformed body (missing `active`, wrong type, extra fields).
- `401` — invalid/expired JWT.
- `404` — `:descriptive_id` is not in this session's connector list.

## Effect on in-flight chat turns

The mutation is **applied immediately** to the session's connector registry. However, [contract-session-chat](../behavior/contracts/session-chat.md) snapshots the active set at the **start** of each turn; an in-flight turn that already chose a tool for an inactive connector is **not** aborted. The next turn observes the new state.

## Related

- Behavior: [contract-connector-toggle](../behavior/contracts/connector-toggle.md)
- Listing: [http-get-connectors](http-get-connectors.md)
