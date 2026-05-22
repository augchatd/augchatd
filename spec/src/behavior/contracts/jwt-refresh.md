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
