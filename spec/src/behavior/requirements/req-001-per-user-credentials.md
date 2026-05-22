---
id: req-001-per-user-credentials
type: requirement
status: proposed
capability: cap-session-mgmt
evidence:
  - source: README.md@e562b2b
    section: "The problem augchatd solves / What augchatd does"
links:
  - relation: depends_on
    target: req-003-server-side-secrets
---

# Req 001 — Per-user credentials at session setup

## Statement

Each session carries its own end-user-specific credentials, supplied by the integrator at `POST /sessions`:

- the LLM key (may be the integrator's shared key or the end user's enterprise key)
- the **per-connector credentials** for each entry in `connectors[]` (typically the end user's own OAuth tokens for MCP-type connectors; backend credentials for RAG-type connectors)
- the cold-storage S3 bucket + credentials

augchatd routes every LLM call, connector call (MCP, RAG, future types), and storage operation for that session through *only* those credentials — never another session's, and never the credentials of an inactive connector.

The integrator's application **resolves** which credentials a session uses; augchatd does not decide.

## Why

Without per-session credential isolation, a backend that handles multiple end users either ends up with one shared identity to every external system (no per-user audit, no tier separation, no per-user rate limits at the provider) or rebuilds the routing logic itself (and risks cross-tenant leaks).

## How it is observed

- A session for `user_42` calls the GitHub MCP with `user_42`'s OAuth token.
- A second concurrent session for `user_99` calls the same MCP URL with `user_99`'s OAuth token.
- Logs and traces show distinct credentials per session; the in-process memory for one session is never readable by code holding another session's context.

## Acceptance

Implementation must demonstrate two concurrent sessions for different users hitting the same MCP URL and the same RAG backend with disjoint credentials and (for RAG) disjoint scopes.
