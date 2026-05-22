---
id: arch-components
type: adr
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "How it works / Status / What augchatd does (bundled UI)"
---

# Components

augchatd is a **single binary** that contains everything below.

```
augchatd process
├── HTTP API layer (Hono)
│   ├── mTLS endpoints: POST /sessions, DELETE /sessions/:id
│   ├── demo endpoint (mode=demo only): GET /demo/jwt
│   ├── ops endpoint (both modes): GET /healthz   ← exposes "mode": "demo" | "prod"
│   ├── JWT endpoints: chat, conversation CRUD (browser API)
│   └── static UI serving (same origin, /)
│
├── Session registry (in-memory)
│   └── { session_id → { user_id, model+key, mcp[], rag?, storage } }
│
├── Tool-use loop
│   ├── LLM driver (Vercel AI SDK; Anthropic, OpenAI, …)
│   ├── MCP client (HTTP/SSE, per-session credentials)
│   └── RAG client (OpenSearch hybrid | pgvector vector)
│
├── Hot storage
│   └── Bun embedded SQLite, one DB per (mTLS tenant, user)
│        layout: data/<tenantId>/<userId>.sqlite
│
├── Cold storage driver
│   └── S3-compatible client (per-session bucket + creds)
│
└── Bundled UI (React + Vite static SPA, compiled into the binary)
    └── assistant-ui, served on /
```

## External dependencies

- LLM provider (per-session API key)
- MCP servers (per-session URL + auth; HTTP/SSE)
- RAG backend (OpenSearch or pgvector; per-session credentials and scope)
- S3-compatible bucket (per-session credentials)

augchatd has **no required external dependencies** to start: no separate database, no separate cache, no separate frontend host. Required externals are per-session and supplied at session creation.

## Process model

- One process per deployment is the default.
- For mutually hostile tenants, deploy **one process per tenant** (see [tenant-isolation](../constraints/tenant-isolation.md)).
- Demo mode is the same binary booted with `AUGCHATD_MODE=demo`.

## Stack

Built with **Bun**, **Hono**, **TypeScript** on the backend. Bundled UI is a **React SPA built with Vite**, embedding **assistant-ui**, compiled into the binary as static assets. LLM access via **Vercel AI SDK**. Hot storage via Bun's embedded **SQLite**, one DB per (mTLS tenant, user).

See ADRs:

- [0001 — Single binary + bundled UI](adrs/0001-single-binary-bundled-ui.md)
- [0002 — Embedded SQLite per (mTLS tenant, user)](adrs/0002-embedded-sqlite-per-mtls-tenant.md)
- [0003 — Customer-provided cold storage (S3)](adrs/0003-customer-provided-cold-storage.md)
- [0004 — HTTP/SSE-only MCP transport](adrs/0004-http-sse-mcp-only.md)
- [0005 — JWT signature-only validation](adrs/0005-jwt-signature-only.md)
- [0006 — Vercel AI SDK for LLM access](adrs/0006-vercel-ai-sdk-for-llm.md)
- [0007 — Bun + Hono + TypeScript stack](adrs/0007-bun-hono-typescript.md)
- [0008 — Demo mode shares the production binary](adrs/0008-demo-mode-shares-binary.md)
- [0009 — React + Vite bundled UI](adrs/0009-react-vite-bundled-ui.md)
