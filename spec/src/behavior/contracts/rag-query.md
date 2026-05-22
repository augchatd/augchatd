---
id: contract-rag-query
type: behavior-contract
status: proposed
capability: cap-chat
evidence:
  - source: README.md@e562b2b
    section: "README header (tools.rag.backend) / What augchatd does (Runs retrieval) / What augchatd does NOT do (ingest)"
links:
  - relation: satisfies
    target: req-002-rag-scoping
  - relation: depends_on
    target: contract-session-chat
  - relation: constrains
    target: contract-session-create
---

# Contract — RAG retrieval

## Promise

When a session has `tools.rag` provisioned and the LLM invokes the RAG tool during a chat turn, augchatd:

1. Resolves the backend kind: `opensearch` (hybrid BM25 + kNN, native) or `pgvector` (vector-only out of the box).
2. Builds a query constrained to the session's allowed indexes (OpenSearch) or tables (pgvector).
3. Authenticates with the session's RAG-backend credentials.
4. Returns hits to the LLM.

Scope is applied **before** query construction. The LLM cannot express a query that escapes the allowed scope; the tool surface only exposes the allowed set.

## Observable outcomes

- A query captured at the backend lists only allowed indexes/tables.
- Two concurrent sessions with disjoint scopes against the same OpenSearch cluster produce disjoint captured queries.
- An LLM tool call naming a disallowed index produces either a refusal or a query restricted to the allowed set.

## Non-promises

- augchatd does not ingest, chunk, or embed documents.
- augchatd does not blend pgvector with `tsvector` automatically — pgvector is vector-only out of the box; the integrator owns any lexical layer.
- augchatd does not rank or re-rank cross-index; that is the backend's responsibility.

## Tests this contract implies

- OpenSearch hybrid query for a session with two allowed indexes — captured query lists exactly those two.
- pgvector query for a session with one allowed table — captured SQL/query references only that table.
- Negative test: LLM tool call mentioning a disallowed index — assertion that the outbound query does not contain it.
