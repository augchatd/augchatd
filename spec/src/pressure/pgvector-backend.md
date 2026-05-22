---
id: pressure-pgvector-backend
type: pressure
status: open
category: opportunity
who: "Architectural review with the maintainer (2026-05-22)"
touches:
  - cap-chat
  - cap-connectors
related_contracts:
  - contract-rag-query
  - technical-contract-http-post-sessions
satisfied_by_current_behavior: false
evidence:
  - source: "this chat / architectural review 2026-05-22"
---

# Pressure — pgvector backend for RAG-type connectors

## Signal

The current RAG-type connector contract accepts only `backend: "opensearch"`. Integrators who already run **Postgres + pgvector** for embeddings currently have to:

- Stand up an OpenSearch cluster just for chat retrieval, **or**
- Build an OpenSearch-compatible facade over pgvector, **or**
- Skip RAG with augchatd entirely.

Earlier draft conversations envisioned both backends; pgvector was **deferred** so the initial implementation could ship with one backend it could test thoroughly.

## Why it matters

- pgvector is the most common embedding store outside the search-engine world — many B2B SaaS shops default to Postgres for everything.
- Adding it removes a real category of integration friction without adding much complexity (pgvector is vector-only; the surface is a SELECT with a `<=>` operator scoped to a column and an allowed list of tables).
- The connector shape is **almost** ready: only `backend: "pgvector"` parsing and a pgvector-flavored query builder are missing. No payload reshaping is required.

## What would satisfy it

- `backend: "pgvector"` accepted in a RAG-type connector entry.
- A pgvector connection-string field (PostgreSQL-style URI; exact shape to be confirmed when implementation lands).
- A query builder that emits SQL with the appropriate vector-distance operator, scoped to the connector's allowed `tables[]` (analogous to `indexes[]` for OpenSearch).
- Optional: BYO lexical column (`tsvector`) the integrator can combine — augchatd does not own the lexical layer for pgvector.

## Why it's not in scope yet

- One backend (OpenSearch) was enough to validate the connector model.
- pgvector adds a SQL layer; mixing OpenSearch and pgvector clients in the same process is a non-trivial dependency addition.
- No customer has asked yet.

## Trigger to revisit

- An integrator who already runs pgvector + embeddings asks for it.
- A second RAG backend type appears with a similar enough shape that the cost of generalizing the SQL/HTTP split is justified.

## Current treatment

The session-creation contract **rejects** `backend: "pgvector"` today — see [contract-session-create](../behavior/contracts/session-create.md) and [contract-rag-query](../behavior/contracts/rag-query.md). The README's stack note flags pgvector as a future option without claiming current support.
