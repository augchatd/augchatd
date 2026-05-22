---
id: adr-0005-jwt-signature-only
type: adr
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "Token & credential refresh"
  - source: README.md
    section: "README header (ttl_seconds note) / Token & credential refresh (forced logout)"
links:
  - relation: supports
    target: contract-session-chat
  - relation: supports
    target: contract-jwt-refresh
  - relation: supports
    target: contract-session-delete
---

# ADR 0005 — JWT validation is signature-only; no DB lookup per message

## Context

Streaming chat replies must be cheap per token. A per-message database hit for session validation would impose latency and load that grows with throughput.

## Decision

The JWT carries enough information to authenticate a chat call by **signature verification alone**. No database lookup per message; no revocation list check on the hot path.

Conversation state lives in hot SQLite (and cold S3); the JWT is purely an authentication proof.

JWT lifetime is **configurable per session** via `ttl_seconds` on `POST /sessions`. The **default is `60` seconds** — deliberately low so the refresh path is exercised frequently in development. Production deployments typically choose a higher value (e.g. `1800` for 30 min) to amortize refresh latency. augchatd does not enforce an upper bound; the integrator picks the value appropriate to their threat model and refresh tolerance.

## Consequences

- Streaming has no per-token validation cost beyond signature.
- Revocation strategy is **short expiry**, set per session via `ttl_seconds`. A revoked session expires shortly thereafter; the integrator simply does not re-mint.
- **Immediate revocation** is available via `DELETE /sessions/:id` (mTLS) — see [contract-session-delete](../../behavior/contracts/session-delete.md). Deletes the in-memory session so subsequent chat calls bearing the JWT return 401, bounded by the TTL window.
- An MCP credential expiry surfaces as a 401 (same path as JWT expiry) — see [jwt-refresh](../../behavior/contracts/jwt-refresh.md).
- The session record in memory is still the source of truth for credentials/scope; the JWT does not carry them.

## Alternatives considered

- **Per-request DB lookup** — too expensive for streaming.
- **Long-lived JWTs with a revocation list** — adds a fast path that must be perfectly fast, defeating the simplicity goal.
- **Single fixed TTL** — picks a poor compromise between dev ergonomics and prod efficiency; configurability lets each deployment pick.
