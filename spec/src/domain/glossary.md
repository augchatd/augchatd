---
id: domain-glossary
type: domain
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "all"
---

# Glossary

Canonical terms used across the spec. Preserve these names; do not paraphrase.

| Term | Definition |
| --- | --- |
| **augchatd** | The daemon. Single binary that serves both the JSON HTTP API and the bundled chat UI, same origin. |
| **integrator** | The B2B SaaS company that operates augchatd and embeds its UI in their own app. |
| **end user** | A user of the integrator's product who chats through the embedded UI. Identified to augchatd only by `user_id`. |
| **session** | The short-lived authenticated context created by `POST /sessions`. Its lifetime equals the JWT TTL (configurable via `ttl_seconds`, default 60s; production typically ~30 min). Identified by `session_id` server-side and by JWT in the browser. |
| **conversation** | Persistent chat history identified by `conversation_id`. A conversation can span any number of sessions: when a session ends, the conversation survives in storage and the next session can resume it. Created and chosen by the browser via the JWT API. |
| **connector** | A tool or retrieval provider attached to a session. Has `descriptive_id`, `name`, `type` (`mcp` or `rag`), `default_active`, and type-specific config. Provisioned at session creation by the integrator; the end user can enable/disable connectors mid-conversation but cannot add new ones. Only active connectors expose tools to the LLM. See [adr-0010](../architecture/adrs/0010-unified-connector-model.md). |
| **resolved scope** | The connectors[] list (and other session-creation parameters) the integrating application decided this session may touch. Set once at session creation; augchatd never extends it. |
| **active scope** | The subset of the resolved scope that is currently enabled. Starts at the resolved set (modulo each connector's `default_active`); the end user can narrow it by toggling connectors off. |
| **mTLS tenant** | The calling backend, identified by its client certificate at `POST /sessions`. **Hot** storage is partitioned by this identity. **Cold** storage is partitioned by the bucket the integrator supplies per session — not by this identity. |
| **JWT** | Short-lived (minutes) token issued by augchatd at session creation. The only thing the browser holds. Validated by signature, not by DB lookup. |
| **MCP server** | An external Model Context Protocol server augchatd calls on the end user's behalf. Provisioned as a **connector of type `mcp`**. Reachable via HTTP/SSE. Bears the end user's own credentials, provided at session setup. |
| **RAG backend** | An external retrieval store that augchatd queries on the end user's behalf, constrained to the indexes the connector allows. Provisioned as a **connector of type `rag`**. Currently supports OpenSearch (hybrid BM25 + kNN); pgvector is a future option (see [pressure-pgvector-backend](../pressure/pgvector-backend.md)). |
| **bundled UI** | The chat interface built on [assistant-ui](https://github.com/assistant-ui/assistant-ui), compiled into the augchatd binary, served on the same origin as the API. |
| **hot storage** | Conversation state kept in internal SQLite databases managed by augchatd. One database per `(mTLS tenant, user)`, laid out as `data/<tenantId>/<userId>.sqlite`. The file lives while any session for that user is alive. |
| **cold storage** | The integrator's S3-compatible bucket, passed in per session, where conversation history is flushed for durability. |
| **flush** | Move a conversation from hot to cold. Triggered by session disconnect or 5 minutes of inactivity. |
| **hydrate** | Reload a conversation from cold storage on resume when no longer in hot. |
| **tool-use loop** | The server-side cycle of (LLM call → tool/RAG invocation → result → LLM call) that runs per chat turn. |
| **demo mode** | Single-tenant boot from `AUGCHATD_MODE=demo` env vars. Bypasses mTLS and `POST /sessions`. For local testing and public demos only. |
| **production mode** | Default. mTLS-protected `POST /sessions` from the integrator's backend. |

## Aliases / informal terms to avoid

- "daemon", "service", "server" → use **augchatd** when referring to the system itself.
- "customer" → ambiguous; use **integrator** (B2B customer) or **end user** (their user).
- "credentials" → ambiguous; specify **MCP credentials**, **LLM key**, **RAG backend credentials**, or **S3 credentials**.
- "chat" → ambiguous; specify **session** (the JWT-bound authenticated context) or **conversation** (the persistent history that spans sessions).
- "MCP credentials" / "RAG credentials" → both are special cases of **connector credentials**. Use the specific term only when the connector type matters.
- "enforces permissions" → augchatd enforces the **already-resolved active scope**; it does not **decide** permissions. Use "enforces scope" when the distinction matters.
