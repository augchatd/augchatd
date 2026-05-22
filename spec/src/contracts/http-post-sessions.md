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
  "mcp_servers": [
    { "url": "https://your-mcp/", "auth": { "bearer": "..." } }
  ],
  "tools": {
    "rag": {
      "backend": "opensearch",
      "cluster": "https://your-opensearch/",
      "indexes": ["docs"]
    }
  },
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
- `mcp_servers[]` — each entry `{ url, auth }`. Independently optional.
- `tools.rag` — `{ backend: "opensearch" | "pgvector", cluster, indexes }` (OpenSearch shape; pgvector shape **not yet specified in evidence — see assumption below**). Independently optional.

> [!NOTE] Assumption
> The pgvector connection-string shape is not given in the README. The shape will be specified once code introduces it; for now it is an evidence gap.

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
