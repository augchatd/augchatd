---
id: technical-contract-http-get-connectors
type: technical-contract
status: proposed
evidence:
  - source: README.md
    section: "Connectors (browser API)"
links:
  - relation: supports
    target: contract-connector-toggle
---

# Technical contract — `GET /connectors`

## Purpose

Returns the session's **resolved scope** — the list of connectors the integrator provisioned for this session, without per-conversation active state. Useful for previewing what's available before creating a conversation, or for rendering a connector reference in the UI.

For per-conversation active state, use [`GET /conversations/:conversation_id/connectors`](http-get-conversation-connectors.md).

## Auth

**JWT** (Bearer). Same JWT that authorizes `POST /chat` and the conversation CRUD endpoints.

## Request

`GET /connectors`

No body.

## Response — success

`200 OK`
`Content-Type: application/json`

```json
[
  {
    "descriptive_id": "rag_public",
    "name":           "Base de conhecimentos pública",
    "type":           "rag"
  },
  {
    "descriptive_id": "mcp_github",
    "name":           "GitHub (user OAuth)",
    "type":           "mcp"
  }
]
```

Each entry has exactly these three fields. **No `active` flag** (active state is per-conversation; see [`GET /conversations/:cid/connectors`](http-get-conversation-connectors.md)). **No credentials, no upstream URLs, no `auth`, no `cluster`, no `indexes` are returned** — those are server-side state only.

## Response — failure modes

- `401` if the JWT is invalid or expired.

## Ordering

The response preserves the order of the `connectors[]` array as it appeared in the session-creation payload. This lets the bundled UI render a stable list.

## Related

- Behavior: [contract-connector-toggle](../behavior/contracts/connector-toggle.md)
- Per-conversation active state: [http-get-conversation-connectors](http-get-conversation-connectors.md)
- Per-conversation toggle: [http-put-conversation-connector-state](http-put-conversation-connector-state.md)
