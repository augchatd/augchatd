---
id: technical-contract-http-get-conversation-connectors
type: technical-contract
status: proposed
evidence:
  - source: README.md
    section: "Connectors (per-conversation active state)"
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

The `active` flag for each entry comes from:

- the conversation's **saved state** for that connector, if present and the connector is still in the session's resolved scope, **or**
- the connector's **`default_active`** from the session payload, if the conversation has no saved state for that connector (i.e. the conversation is new, or the connector is new since the conversation was last touched).

Connectors that were saved in the conversation but are **no longer in the session's resolved scope** are dropped from the response **and from the conversation's saved state** — they do not reappear with their old flag if the integrator re-adds them later (they start fresh at `default_active`).

## Response — failure modes

- `401` if the JWT is invalid or expired.
- `404` if `:conversation_id` is unknown for this user.

## Ordering

The response preserves the order of the session's `connectors[]` payload. Connectors absent from the current resolved scope do not appear; new-in-scope connectors appear in their session-payload position.

## Related

- Behavior: [contract-connector-toggle](../behavior/contracts/connector-toggle.md)
- Mutation: [http-put-conversation-connector-state](http-put-conversation-connector-state.md)
