---
id: req-006-credential-refresh-via-backend
type: requirement
status: proposed
capability: cap-session-mgmt
evidence:
  - source: README.md@e562b2b
    section: "Token & credential refresh"
---

# Req 006 — One refresh path for JWT and MCP-credential expiry

## Statement

When either:

- the JWT expires mid-conversation, or
- an upstream MCP returns 401 (the end user's OAuth token has expired)

…augchatd surfaces a **401** to the browser. The browser asks the integrator's backend for a new JWT; the backend re-mints the session with currently-valid credentials from its own token vault; the conversation resumes.

augchatd holds no refresh logic of its own.

## Why

The integrator's backend already owns the token vault (it has to — see [req-001](req-001-per-user-credentials.md)). Re-implementing refresh inside augchatd would duplicate vault knowledge and create a second source of truth that can drift. One mechanism handles both kinds of expiry.

## How it is observed

- JWT-expiry test: kill time forward; next chat call returns 401; the browser obtains a fresh JWT from the integrator; the conversation continues with state intact (loaded from hot or cold).
- MCP-expiry test: simulate an MCP 401; augchatd's response to the browser is also 401; the same refresh path runs.
- augchatd has no OAuth-refresh code path.

## Acceptance

Both expiry tests pass. Source-level review confirms no OAuth refresh logic inside augchatd.
