---
id: technical-contract-http-post-sessions
type: technical-contract
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "README header (curl example) / How it works (step 1)"
  - source: README.md
    section: "README header (ttl_seconds note)"
links:
  - relation: supports
    target: contract-session-create
---

# Technical contract — `POST /sessions`

## Auth

**mTLS.** Client certificate is required and identifies the mTLS tenant — used to partition **hot** storage. Cold storage is specified per session via `storage.s3` and is not partitioned by the mTLS tenant.

## Request

`POST /sessions`
`Content-Type: application/json`

### Body (from README example)

```json
{
  "user_id":     "user_42",
  "ttl_seconds": 60,
  "system_prompt": "You are a helpful assistant.",
  "model": {
    "provider": "anthropic",
    "model_id": "claude-opus-4-7",
    "api_key": "sk-ant-..."
  },
  "connectors": [
    {
      "descriptive_id": "rag_public",
      "name":           "Base de conhecimentos pública",
      "type":           "rag",
      "default_active": true,
      "backend":        "opensearch",
      "cluster":        "https://your-opensearch/",
      "auth":           { "bearer": "..." },
      "indexes":        ["public-docs"]
    },
    {
      "descriptive_id": "mcp_github",
      "name":           "GitHub (user OAuth)",
      "type":           "mcp",
      "default_active": true,
      "url":            "https://your-mcp/",
      "auth":           { "bearer": "ghu_..." }
    }
  ],
  "storage": { "s3": "s3://AKIA...@your-bucket/" }
}
```

### Required fields

- `user_id`
- `system_prompt`
- `model` (`provider`, `model_id`, `api_key`)
- `storage.s3`

### Optional fields

- `ttl_seconds` — JWT lifetime in seconds. **Default `60`**, deliberately low so development exercises the refresh path frequently. Production typically uses ~`1800` (30 min) to amortize refresh latency. The returned `expires_at` reflects the chosen TTL.
- `connectors[]` — list of tools/retrieval providers attached to this session. Each entry carries the common fields (`descriptive_id`, `name`, `type`, `default_active`) plus type-specific fields. See the per-type shapes below. Independently optional — an empty/absent `connectors[]` is a session with no tools or retrieval. See [adr-0010-unified-connector-model](../architecture/adrs/0010-unified-connector-model.md).

### Connector entry — common fields (always required)

| Field | Type | Notes |
| --- | --- | --- |
| `descriptive_id` | string | Unique within the session. Used by the browser to address the connector (e.g. for toggling) and by augchatd in tool-call indicators. Examples: `"rag_public"`, `"mcp_schooldrive_user_session"`. |
| `name` | string | Human-friendly display label shown by the bundled UI. |
| `type` | enum | `"mcp"` \| `"rag"`. Determines the per-type fields required. |
| `default_active` | boolean | Initial active state for this connector when the session starts. |

### Connector entry — `type: "mcp"`

| Field | Type | Notes |
| --- | --- | --- |
| `url` | string | HTTP/SSE endpoint. Stdio MCPs require a bridge (see [adr-0004](../architecture/adrs/0004-http-sse-mcp-only.md)). |
| `auth` | object | Per-call auth (typically `{ "bearer": "..." }`). |

### Connector entry — `type: "rag"`

| Field | Type | Notes |
| --- | --- | --- |
| `backend` | enum | Currently `"opensearch"`. `"pgvector"` is a future option, **not accepted today** — see [pressure-pgvector-backend](../pressure/pgvector-backend.md). A payload with any other value is rejected at session creation. |
| `cluster` | string | Backend URL. |
| `auth` | object | Backend credentials. |
| `indexes` | string[] | OpenSearch indexes this connector is scoped to. |

### Validation rules

- Each `descriptive_id` is unique within the session.
- Each connector's `type` matches a known enum value; per-type required fields are all present.
- For `type: "rag"`, `backend` is `"opensearch"` (other values rejected for now).

## Response — success

`200 OK`
`Content-Type: application/json`

```json
{
  "session_id": "...",
  "jwt": "eyJ...",
  "expires_at": "..."
}
```

## Response — failure modes

- `4xx` on missing required fields.
- `4xx` on S3 write-test failure (no session is created).
- `401`/`403` on mTLS failure.

## Related

- Behavior: [session-create](../behavior/contracts/session-create.md)
- Auth: [security constraint](../constraints/security.md)
