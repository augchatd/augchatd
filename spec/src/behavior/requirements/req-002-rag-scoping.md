---
id: req-002-rag-scoping
type: requirement
status: proposed
capability: cap-chat
evidence:
  - source: README.md@e562b2b
    section: "The problem augchatd solves / What augchatd does (Runs retrieval)"
links:
  - relation: depends_on
    target: req-001-per-user-credentials
---

# Req 002 — RAG queries scoped before the LLM asks

## Statement

When a session has one or more **active RAG-type connectors**, every retrieval request augchatd executes is constrained to that connector's declared `indexes[]`. Currently the only supported `backend` is `"opensearch"` (pgvector is a future option — see [pressure-pgvector-backend](../../pressure/pgvector-backend.md)). The scope applies *before* the query reaches the backend — not as a post-filter on results.

The LLM is given a tool surface that only exposes the indexes from active connectors; it cannot construct a query that escapes them. **Inactive** RAG-type connectors are not exposed to the LLM at all.

The integrator's application is the sole authority on which connectors a session gets (the *resolved scope*); augchatd enforces that scope on every retrieval call without re-deciding it.

## Why

A scope-as-post-filter design is one MCP-driven typo or prompt-injected query away from leaking another tenant's documents. Pre-query scoping makes the bad query unrepresentable. Moving scoping to a per-connector field (rather than a single session-wide one) lets the end user further narrow the scope mid-conversation by toggling specific connectors off — without rebuilding session state.

## How it is observed

- A session whose `rag_engineering` connector allows `["engineering-docs", "private-42"]` can search those indexes via that connector and no others.
- A second session whose `rag_sales` connector allows `["sales-docs"]` running concurrently against the same OpenSearch cluster searches `sales-docs` and no others.
- An LLM attempt to express "search everything" reaches the backend only as queries against the active connectors' allowed indexes.
- A connector toggled off for a conversation via `PUT /conversations/:cid/connectors/:descriptive_id` is not exposed to the LLM on the next turn of that conversation, so no query references its indexes — while the same connector remains exposed for other conversations where it is active.

## Acceptance

Implementation must show a captured query (server log or trace) for each test (session, conversation) pair that contains only the conversation's active connector's allowed indexes. Negative tests:

- LLM tool call mentioning an index not in any active connector's `indexes[]` → query refused or restricted to the active set; the disallowed index name never appears in the outbound query.
- Connector toggled off then chat → no query for that connector observed.
