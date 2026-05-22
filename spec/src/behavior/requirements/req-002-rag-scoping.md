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

When a session has `tools.rag` provisioned, every retrieval request augchatd executes is constrained to the indexes (OpenSearch) or tables (pgvector) declared at session setup. The scope applies *before* the query reaches the backend — not as a post-filter on results.

The LLM is given a tool whose surface only exposes the allowed scope; it cannot construct a query that escapes it.

## Why

A scope-as-post-filter design is one MCP-driven typo or prompt-injected query away from leaking another tenant's documents. Pre-query scoping makes the bad query unrepresentable.

## How it is observed

- A session that allows `["engineering-docs", "private-42"]` can search those indexes and no others.
- A second session that allows `["sales-docs"]` running concurrently against the same OpenSearch cluster can search `sales-docs` and no others.
- An LLM attempt to express "search everything" reaches the backend only as a query against the allowed scope.

## Acceptance

Implementation must show a captured query (server log or trace) for each test session that contains only the allowed indexes/tables. Negative test: an LLM tool call that mentions a disallowed index returns either a refusal or a query restricted to the allowed set — never a query that includes the disallowed name.
