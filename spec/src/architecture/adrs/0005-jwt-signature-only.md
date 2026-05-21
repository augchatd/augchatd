---
id: adr-0005-jwt-signature-only
type: adr
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "Token & credential refresh"
links:
  - relation: supports
    target: contract-session-chat
  - relation: supports
    target: contract-jwt-refresh
---

# ADR 0005 — JWT validation is signature-only; no DB lookup per message

## Context

Streaming chat replies must be cheap per token. A per-message database hit for session validation would impose latency and load that grows with throughput.

## Decision

The JWT carries enough information to authenticate a chat call by **signature verification alone**. No database lookup per message; no revocation list check on the hot path.

Conversation state lives in hot SQLite (and cold S3); the JWT is purely an authentication proof.

## Consequences

- Streaming has no per-token validation cost beyond signature.
- Revocation strategy = **short expiry** (minutes). A revoked session expires shortly thereafter; the integrator simply does not re-mint.
- An MCP credential expiry surfaces as a 401 (same path as JWT expiry) — see [jwt-refresh](../../behavior/contracts/jwt-refresh.md).
- The session record in memory is still the source of truth for credentials/scope; the JWT does not carry them.

## Alternatives considered

- **Per-request DB lookup** — too expensive for streaming.
- **Long-lived JWTs with a revocation list** — adds a fast path that must be perfectly fast, defeating the simplicity goal.
