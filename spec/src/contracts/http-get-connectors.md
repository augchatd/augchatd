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

Each entry has exactly these four fields. **No credentials, no upstream URLs, no `auth`, no `cluster`, no `indexes` are returned** — those are server-side state only.

## Response — failure modes

- `401` if the JWT is invalid or expired.

## Ordering

The response preserves the order of the `connectors[]` array as it appeared in the session-creation payload. This lets the bundled UI render a stable list.

## Related

- Behavior: [contract-connector-toggle](../behavior/contracts/connector-toggle.md)
- Mutation: [http-put-connector-state](http-put-connector-state.md)
