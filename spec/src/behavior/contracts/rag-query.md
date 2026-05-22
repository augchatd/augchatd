---
id: contract-rag-query
type: behavior-contract
status: proposed
capability: cap-chat
evidence:
  - source: README.md@e562b2b
    section: "What augchatd does (Runs retrieval) / What augchatd does NOT do (ingest)"
  - source: README.md
    section: "README header (connectors paragraph)"
links:
  - relation: satisfies
    target: req-002-rag-scoping
  - relation: depends_on
    target: contract-session-chat
  - relation: depends_on
    target: contract-connector-toggle
  - relation: constrains
    target: contract-session-create
  - relation: refines
    target: adr-0010-unified-connector-model
---

# Contract — RAG retrieval

## Promise

When a session has one or more **active RAG-type connectors** and the LLM invokes the retrieval tool exposed by one of them during a chat turn, augchatd:

1. Resolves the backend kind from the connector's `backend` field — currently always `"opensearch"` (hybrid BM25 + kNN, native). pgvector is a future option (see [pressure-pgvector-backend](../../pressure/pgvector-backend.md)).
2. Builds a query constrained to **that connector's `indexes[]`**.
3. Authenticates with that connector's `auth` credentials against the connector's `cluster`.
4. Returns hits to the LLM, tagged with the connector's `descriptive_id` so the LLM (and the streamed indicator) know which knowledge base they came from.

Scope is applied **before** query construction. The LLM cannot express a query that escapes the connector's `indexes[]`; the tool surface only exposes that set. RAG-type connectors **inactive for the current conversation** are not exposed to the LLM at the start of the turn (active state is per-conversation; see [contract-connector-toggle](connector-toggle.md)).

## Observable outcomes

- A query captured at the backend lists only the connector's allowed indexes.
- Two concurrent sessions with disjoint RAG connectors against the same OpenSearch cluster produce disjoint captured queries.
- An LLM tool call naming a disallowed index produces either a refusal or a query restricted to the active connector's allowed set.
- A session with two active RAG connectors (e.g. `rag_public` and `rag_internal`) exposes two distinct retrieval tools (or one tool with a connector-selector parameter, implementation detail); each query is scoped to its connector's indexes.
- A RAG-type connector toggled off is absent from the tool list of the next chat turn.

## Non-promises

- augchatd does not ingest, chunk, or embed documents.
- augchatd does not rank or re-rank cross-connector; that is the backend's (or the LLM's) responsibility.
- augchatd does not support pgvector today; the `backend` enum only accepts `"opensearch"`.

## Tests this contract implies

- OpenSearch hybrid query for a connector with two allowed indexes — captured query lists exactly those two.
- A session with two active RAG connectors hits each backend independently with its own credentials and indexes.
- Negative test: LLM tool call mentioning an index not in any active connector's `indexes[]` — assertion that no outbound query contains it.
- Toggling a RAG-type connector off for a conversation via `PUT /conversations/:cid/connectors/:descriptive_id` removes its retrieval tool from the next turn of that conversation; it remains exposed for chat against other conversations where the connector is active.
- A connector with `backend: "pgvector"` in the session payload is **rejected at session creation** (unknown backend) — see [contract-session-create](session-create.md).
