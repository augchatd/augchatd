---
id: adr-0010-unified-connector-model
type: adr
status: proposed
evidence:
  - source: README.md
    section: "Connectors (session payload) / What augchatd does"
links:
  - relation: refines
    target: req-001-per-user-credentials
  - relation: refines
    target: req-002-rag-scoping
  - relation: supports
    target: contract-session-create
  - relation: supports
    target: contract-session-chat
---

# ADR 0010 — Unified connector model for tool and data providers

## Context

The earlier session payload split tool/data providers into two separate keys:

- `mcp_servers[]` — multiple MCP servers, each `{ url, auth }`.
- `tools.rag` — a single RAG backend, `{ backend, cluster, indexes }`.

Two problems with that shape:

1. Every new provider type would require a new key and new client code for parsing/dispatch. RAG itself already wants to be a list (multiple knowledge bases per session) — not a single object.
2. The bundled UI should let the **end user enable/disable individual providers mid-conversation** (e.g. "search only the public knowledge base for this question, not the internal one"). With forked keys, toggling is per-type and inconsistent.

augchatd does **not decide** which providers a user may touch — the integrator's application resolves that policy at session creation. augchatd's job is to **apply the resolved scope** consistently. A single shape makes that enforcement clean.

## Decision

Replace `mcp_servers[]` + `tools.rag` with a single **`connectors[]`** array on the session-creation payload.

Each connector entry has these common fields:

- **`descriptive_id`** (string, unique within session) — addresses the connector for toggling and logging. Examples: `"rag_public"`, `"rag_internal"`, `"mcp_schooldrive_user_session"`.
- **`name`** (string) — human-friendly display label shown by the bundled UI. Example: `"Base de conhecimentos pública"`.
- **`type`** (enum) — `"mcp"` | `"rag"` (extensible).
- **`default_active`** (boolean) — initial active state at session start. Some connectors may be provisioned but default off (e.g. a powerful tool that the user opts in to per turn).
- Type-specific fields (flat, alongside the common fields — matching the previous flat shape of `mcp_servers[]` and `tools.rag`).

### Type-specific shapes

**`type: "mcp"`**:

- `url` (string) — HTTP/SSE endpoint.
- `auth` (object) — same shape as before (typically `{ bearer: "..." }`).

**`type: "rag"`**:

- `backend` (enum) — `"opensearch"`. Only OpenSearch is supported currently; pgvector is a future option (see [pressure-pgvector-backend](../../pressure/pgvector-backend.md)).
- `cluster` (string) — backend URL.
- `auth` (object) — backend credentials.
- `indexes` (string[]) — the indexes this connector is scoped to.

### Active state and the scope rule

Each connector carries an *active* boolean **per conversation** (not per session):

- It **starts** at `default_active` when a brand-new conversation is created.
- The browser can **read** the active set for a conversation via `GET /conversations/:cid/connectors` and **toggle** an entry via `PUT /conversations/:cid/connectors/:descriptive_id { active }` — both JWT-authenticated. The session-wide `GET /connectors` returns the resolved scope only (no active flag). See [http-get-connectors](../../contracts/http-get-connectors.md), [http-get-conversation-connectors](../../contracts/http-get-conversation-connectors.md), [http-put-conversation-connector-state](../../contracts/http-put-conversation-connector-state.md).
- When the LLM is invoked for a chat turn against a conversation, **only that conversation's active connectors' tools are exposed**.
- The active set is captured at the start of each chat turn — toggling mid-turn does not abort an in-flight tool call.

**Scope rule** (foundational invariant):

> The integrator decides the *resolved scope* — the connectors[] list — at session creation. The end user can only **narrow** that scope by toggling connectors off **for one conversation**. They cannot extend it. Provisioning a new connector requires a new session.

This preserves the existing principle that augchatd does not decide permissions; it enforces the scope the integrator already resolved.

### Persistence of active state (per conversation)

Active state is persisted **alongside the conversation it belongs to** — in the same hot SQLite that holds the conversation's messages, flushed to the same cold S3 bucket on disconnect or 5-minute idle. This has three consequences:

1. **Survives session re-mints.** A toggle made in conversation `X` persists across JWT expiry, idle flush, forced delete + re-mint, browser refresh, etc. The next session that loads `X` sees the saved active states; the user does not have to retoggle.
2. **Per-conversation independence.** Conversations of the same user are independent — the user can have one conversation scoped to a single RAG (e.g. "public KB only") while another has all connectors on.
3. **Stays consistent with the "no own vault" promise.** augchatd does not introduce a new persistence surface — active state rides the existing conversation storage layer (the integrator's S3 ultimately owns it for cold).

**Reconciliation rules when the resolved scope changes between sessions:**

| Connector situation | Active state on reload |
| --- | --- |
| In saved state AND in current scope | Restored to the saved flag |
| In current scope AND not in saved state | Starts at the connector's current `default_active` |
| In saved state AND no longer in current scope | Silently dropped from the response. If the integrator re-adds the same `descriptive_id` later, the saved flag returns |

## Consequences

- One server-side dispatcher with a `type` switch; new connector types extend the enum without reshaping the payload.
- The bundled UI gains a connector panel: each entry shows `name`, `type`, and a toggle bound to the active state. Credentials are never sent to the browser. There are two listing endpoints with different shapes: `GET /connectors` returns the session resolved scope `[{descriptive_id, name, type}]` (no `active` field); `GET /conversations/:cid/connectors` returns `[{descriptive_id, name, type, active}]` with the conversation's per-connector active state.
- The `model` (LLM) is **not** a connector — it is the chat engine itself, configured once per session.
- Existing language in the spec moves from "MCP server" / "RAG backend" to "connector of type X" where the unified vocabulary helps; the lower-level contracts (`mcp-invocation`, `rag-query`) continue to describe the per-type mechanics.

## Alternatives considered

- **Keep separate `mcp_servers[]` and `tools.rag`** — works for the previous level of complexity, but doesn't support mid-conversation toggling cleanly, and requires a new key/shape for every future provider type.
- **Nested `config` object per type** — `{ ..., config: { backend: "opensearch", ... } }`. Slightly tidier type discrimination, but diverges from the established flat convention. Net cost > benefit at current scope.
- **Allow runtime addition/removal of connectors** — would let the end user *expand* their resolved scope mid-conversation, violating the "integrator resolves, augchatd applies" principle. Rejected; re-mint the session if scope must change.
- **Treat the LLM as a "connector of type model"** — superficially symmetric, but the LLM is the chat engine itself, not a tool the LLM uses. Different concern; kept separate.
