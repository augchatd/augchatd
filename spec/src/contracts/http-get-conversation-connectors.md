---
id: technical-contract-http-get-conversation-connectors
type: technical-contract
status: proposed
evidence:
  - source: README.md
    section: "README header (connectors paragraph)"
links:
  - relation: supports
    target: contract-connector-toggle
---

# Technical contract — `GET /conversations/:conversation_id/connectors`

## Purpose

Returns the **per-conversation connector active state** for one conversation. The list reflects the session's resolved scope intersected with the conversation's saved active flags (with reconciliation rules — see below).

## Auth

**JWT** (Bearer). Same JWT that authorizes `POST /chat` and the conversation CRUD endpoints.

## Request

`GET /conversations/:conversation_id/connectors`

The `:conversation_id` path parameter is a conversation owned by the current session's user.

## Response — success

`200 OK`
`Content-Type: application/json`

```json
[
  {
    "descriptive_id": "rag_public",
    "name":           "Base de conhecimentos pública",
    "type":           "rag",
    "active":         true
  },
  {
    "descriptive_id": "mcp_github",
    "name":           "GitHub (user OAuth)",
    "type":           "mcp",
    "active":         false
  }
]
```

The `active` flag for each entry comes from the conversation's **saved state**. The saved state is captured the first time the connector is observed in the conversation's purview (snapshotting the current `default_active`) and is thereafter authoritative — see [adr-0010, "Persistence of active state"](../architecture/adrs/0010-unified-connector-model.md#persistence-of-active-state-per-conversation) for full reconciliation rules when the resolved scope changes.

Connectors not in the current resolved scope are omitted from the response.

## Response — failure modes

- `401` if the JWT is invalid or expired.
- `404` if `:conversation_id` is unknown for this user.

## Ordering

The response preserves the order of the session's `connectors[]` payload. Connectors absent from the current resolved scope do not appear; new-in-scope connectors appear in their session-payload position.

## Related

- Behavior: [contract-connector-toggle](../behavior/contracts/connector-toggle.md)
- Mutation: [http-put-conversation-connector-state](http-put-conversation-connector-state.md)
