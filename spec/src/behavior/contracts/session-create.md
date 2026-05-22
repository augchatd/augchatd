---
id: contract-session-create
type: behavior-contract
status: proposed
capability: cap-session-mgmt
evidence:
  - source: README.md@e562b2b
    section: "README header / How it works (step 1) / Storage"
links:
  - relation: satisfies
    target: req-001-per-user-credentials
  - relation: satisfies
    target: req-003-server-side-secrets
  - relation: depends_on
    target: technical-contract-http-post-sessions
  - relation: enables
    target: contract-session-chat
---

# Contract — Session creation

## Promise

Given a valid mTLS client cert and a JSON payload containing at minimum `user_id`, `system_prompt`, `model`, and `storage.s3`, augchatd:

1. **Validates** the payload shape.
2. **Tests S3 writability** against the supplied bucket and credentials. If it cannot write, the request fails with a 4xx and **no session is created**.
3. **Stores** the credentials in process memory keyed by a new `session_id`.
4. **Mints** a JWT (signature-validated, short-lived, minutes).
5. **Returns** `{ session_id, jwt, expires_at }`.

If `mcp_servers` is present, those servers (with their per-server auth) are stored alongside the session. If `tools.rag` is present, the RAG backend address, credentials, and scope are stored. Both are independently optional.

## Observable outcomes

- A 2xx response on success carrying the three fields.
- A 4xx on a setup that cannot reach S3 — no session exists in memory afterwards.
- A 4xx on missing required fields (`user_id`, `system_prompt`, `model`, `storage.s3`).
- A successful response after which the same `session_id` is unknown to a second augchatd process (sessions are per-process).

## Non-promises

- augchatd does not validate that the LLM key works (provider call only happens at chat time).
- augchatd does not validate that MCP servers are reachable (failure surfaces during chat).
- augchatd does not enforce that `user_id` is unique across sessions — concurrent sessions for the same user are allowed.

## Tests this contract implies

- mTLS challenge-response with a valid cert succeeds.
- mTLS without a cert or with an untrusted cert is rejected.
- S3 unreachable → 4xx, no session created.
- Minimal payload (just `model + storage`) creates a working session.
- Payload with `mcp_servers` and `rag` creates a session that exposes those at chat time.
