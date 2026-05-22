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

Each connector carries an *active* boolean per session:

- It **starts** at `default_active`.
- The browser can **read** the current set via `GET /connectors` and **toggle** an individual entry via `PUT /connectors/:descriptive_id { active }` — both JWT-authenticated; see [http-get-connectors](../../contracts/http-get-connectors.md) and [http-put-connector-state](../../contracts/http-put-connector-state.md).
- When the LLM is invoked, **only active connectors' tools are exposed** to it.
- The active set is captured at the start of each chat turn — toggling mid-turn does not abort an in-flight tool call.

**Scope rule** (foundational invariant):

> The integrator decides the *resolved scope* — the connectors[] list — at session creation. The end user can only **narrow** that scope by toggling connectors off. They cannot extend it. Provisioning a new connector requires a new session.

This preserves the existing principle that augchatd does not decide permissions; it enforces the scope the integrator already resolved.

## Consequences

- One server-side dispatcher with a `type` switch; new connector types extend the enum without reshaping the payload.
- The bundled UI gains a connector panel: each entry shows `name`, `type`, and a toggle bound to the active state. Credentials are never sent to the browser; the listing carries only `descriptive_id`, `name`, `type`, `active`.
- The `model` (LLM) is **not** a connector — it is the chat engine itself, configured once per session.
- Existing language in the spec moves from "MCP server" / "RAG backend" to "connector of type X" where the unified vocabulary helps; the lower-level contracts (`mcp-invocation`, `rag-query`) continue to describe the per-type mechanics.

## Alternatives considered

- **Keep separate `mcp_servers[]` and `tools.rag`** — works for the previous level of complexity, but doesn't support mid-conversation toggling cleanly, and requires a new key/shape for every future provider type.
- **Nested `config` object per type** — `{ ..., config: { backend: "opensearch", ... } }`. Slightly tidier type discrimination, but diverges from the established flat convention. Net cost > benefit at current scope.
- **Allow runtime addition/removal of connectors** — would let the end user *expand* their resolved scope mid-conversation, violating the "integrator resolves, augchatd applies" principle. Rejected; re-mint the session if scope must change.
- **Treat the LLM as a "connector of type model"** — superficially symmetric, but the LLM is the chat engine itself, not a tool the LLM uses. Different concern; kept separate.
