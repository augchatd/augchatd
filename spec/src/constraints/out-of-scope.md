---
id: constraint-out-of-scope
type: constraint
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "What augchatd does NOT do"
---

# Constraint — Out of scope

This is the consolidated list of what augchatd refuses to do, by category. See [intent/non-goals.md](../intent/non-goals.md) for the same list framed as intent.

## Identity & policy

- Manage users.
- **Decide** which user can use which connector / index / tool. The integrating application resolves this; augchatd applies the resolved scope on every message. **Enforcement of an already-resolved scope is in scope; deciding the scope is not.**

## MCP

- Host MCP servers.
- Talk to MCPs over stdio.

## RAG

- Ingest, chunk, or embed documents.
- Support `backend: "pgvector"` — currently only `"opensearch"`. pgvector is a future option ([pressure-pgvector-backend](../pressure/pgvector-backend.md)).

## Connectors

- Allow the end user to **add** a connector mid-conversation. The connector list is fixed at session creation; toggles can only narrow it. Adding requires a new session.

## Storage & data

- Store credentials at rest beyond an active session's lifetime.
- Client-side-encrypt conversation history before writing to cold storage.

## Agent surface

- Long-term memory.
- Planning / autonomous-agent loops.

## Commercial / operational

- Bill or meter LLM usage.
- Enforce per-tenant rate limits.
- Ship observability dashboards or metrics.

## Safety / privacy

- Content moderation.
- PII redaction.

## Rule

If an integrator asks "does augchatd do X?", the spec's answer is **no** unless X appears in [capabilities.md](../behavior/capabilities.md).
