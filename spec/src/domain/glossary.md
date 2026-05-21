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
| **session** | A short-lived chat context with one end user's provisioned credentials and scope. Created by `POST /sessions`. Identified by `session_id` and authenticated to the browser by a JWT. |
| **mTLS tenant** | The calling backend, identified by its client certificate at `POST /sessions`. Storage is partitioned by this identity. |
| **JWT** | Short-lived (minutes) token issued by augchatd at session creation. The only thing the browser holds. Validated by signature, not by DB lookup. |
| **MCP server** | An external Model Context Protocol server augchatd calls on the end user's behalf. Reachable via HTTP/SSE. Bears the end user's own credentials, provided at session setup. |
| **RAG backend** | An external retrieval store (OpenSearch or pgvector) that augchatd queries on the end user's behalf, constrained to the indexes/tables the session allows. |
| **bundled UI** | The chat interface built on [assistant-ui](https://github.com/assistant-ui/assistant-ui), compiled into the augchatd binary, served on the same origin as the API. |
| **hot storage** | Conversation state kept in an internal SQLite database managed by augchatd. One database per mTLS tenant, created on first session for that tenant. |
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
