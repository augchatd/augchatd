---
id: domain-bounded-contexts
type: domain
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "How it works / What augchatd does / Storage"
---

# Bounded contexts

augchatd is small. Four top-level contexts cover everything in the README; the third splits into two type-specific sub-contexts.

## 1. Session lifecycle

Owns: minting a session from a setup payload, issuing a JWT, validating JWT on chat requests, re-minting after expiry, releasing on disconnect.

Boundaries:
- Receives `POST /sessions` (mTLS) from the integrator's backend.
- Returns `{ session_id, jwt, expires_at }`.
- Holds session credentials in memory for the session's lifetime.

Does **not** decide policy (which user, which MCPs, which indexes) — the integrator supplies that.

## 2. Chat (tool-use loop)

Owns: turning an end-user message into a streamed reply, looping the LLM with the **conversation's** active connectors (MCP tools, RAG retrieval, …). Active state is per-conversation; the same connector can be active in one conversation and inactive in another.

Boundaries:
- Receives chat messages over the browser-facing JWT API.
- Streams replies in the assistant-ui native protocol (Vercel AI SDK data stream).
- Uses *only* the session's provisioned credentials and scope.

## 3. Connector lifecycle and dispatch

Owns: per-session connector registry; list/toggle endpoints for the browser; routing each chat-turn tool call to the right connector type. Each connector is either MCP-type or RAG-type (extensible).

Boundaries:
- Only **active** connectors are exposed to the LLM at the start of a chat turn.
- The integrator declares the connector list at session creation; the end user can only narrow it via toggles, not extend.
- Credentials live in the session's connector registry (in-memory); never exposed to the browser.

## 3a. MCP-type connector

Owns: making per-call MCP requests with that connector's credentials.

Boundaries:
- HTTP/SSE only.
- Stateless per call; credentials pulled from the connector's slot in the session registry.
- 401 from an MCP surfaces as 401 to the browser (triggers JWT refresh path).

## 3b. RAG-type connector

Owns: running a retrieval query, scoped to that connector's allowed indexes, against an OpenSearch backend (pgvector is a future option — see [pressure-pgvector-backend](../pressure/pgvector-backend.md)).

Boundaries:
- Scope applied *before* query construction, not as a post-filter.
- augchatd does not ingest, chunk, or embed; the backend must already be populated.

## 4. Storage (hot + cold)

Owns: keeping conversation state hot in embedded SQLite while a session is live, flushing to the integrator's S3 bucket on disconnect or 5-minute idle, hydrating from S3 on resume.

Boundaries:
- One SQLite database per `(mTLS tenant, user)`, laid out as `data/<tenantId>/<userId>.sqlite`.
- Hot data is not dropped until cold has it (flush retried indefinitely on failure).
- Setup fails fast if S3 cannot be written at session creation.

## What is *not* a bounded context here

- **Auth** — owned by the integrator.
- **Policy** — owned by the integrator.
- **Document ingestion** — owned by the integrator's RAG pipeline.
- **LLM billing** — owned by the LLM provider.
