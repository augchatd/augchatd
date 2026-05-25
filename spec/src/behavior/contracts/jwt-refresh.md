---
id: contract-jwt-refresh
type: behavior-contract
status: proposed
capability: cap-session-mgmt
evidence:
  - source: README.md@e562b2b
    section: "Token & credential refresh"
links:
  - relation: satisfies
    target: req-006-credential-refresh-via-backend
  - relation: depends_on
    target: contract-session-create
  - relation: refines
    target: contract-session-chat
---

# Contract — JWT and credential refresh (single path)

> [!WARNING] PENDING RECONCILIATION
> - **Detected**: 2026-05-25 by /code-changed (audit consolidation, augchatd/augchatd#9)
> - **Sources in conflict**: this contract's "MCP-401 → browser-401" path vs `src/mcp.ts:79-86` + `src/routes/chat.ts:209-217` (MCP errors land in `streamText.onError`, are written to the trace, and the SSE response stays 200 because the headers were already flushed before the tool call). Also: `src/auth.ts:24-38` exposes a third 401 sub-code `session_gone` (signature-valid JWT for a record the in-memory registry no longer has — happens on process restart since the HMAC secret in `src/jwt.ts:23-27` is regenerated per boot) that this contract does not name.
> - **Nature**: the "single path" promise is half-true. JWT-expiry → 401 → refresh works exactly as written. MCP-401 → 401 is structurally impossible under the current streaming-200 chat architecture: by the time the tool call runs, the chat handler has already emitted `200 OK` and a stream prologue, so it cannot retroactively return 401. The `session_gone` discriminator is a third recovery path that observes the same retry-once shape but is invisible to this contract.
> - **Proposed direction**: issue #9 §C1 picks option (b) — emit a sentinel UI part on the stream (e.g. `{type: "augchatd-error", code: "upstream_unauthorized", connector: "<descriptive_id>"}`) that the bundled UI translates into the same refresh-and-retry the JWT path uses. Separately, document `session_gone` as a third 401 sub-code recovered via the same handshake, and note in [adr-0005-jwt-signature-only](../../architecture/adrs/0005-jwt-signature-only.md) that process restart invalidates every previously-issued JWT.
> - **Decision owner**: project owner.

## Promise

When a chat request reaches augchatd with an expired JWT, or when an upstream MCP call returns 401 during a chat turn, augchatd responds to the browser with **HTTP 401**.

The browser then asks the integrator's backend for a fresh JWT (the integrator re-mints the session with currently-valid credentials), receives the new JWT, and resumes the conversation. Conversation state survives because it lives in hot storage (and in cold if the hot copy was already flushed).

## Observable outcomes

- Both kinds of expiry produce the same HTTP status (401) on the same code path.
- Resumed chat after refresh sees the prior conversation history.
- No OAuth-refresh code lives inside augchatd (verifiable by source-level review).

## Non-promises

- augchatd does not warn the browser before expiry (no soft-expiry signal).
- augchatd does not cache or re-use the old JWT after refresh.
- augchatd does not arbitrate which set of credentials the integrator's re-mint should use.

## Tests this contract implies

- JWT-expiry path: forge an expired JWT → 401; re-mint via fresh `POST /sessions` → resumed chat sees prior history.
- MCP-401 path: mock MCP returns 401 → augchatd returns 401 to the browser; re-mint → resumed chat works.
- Source-grep: no `oauth_refresh`, `refresh_token`, etc. in augchatd code.
