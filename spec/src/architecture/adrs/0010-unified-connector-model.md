---
id: adr-0010-unified-connector-model
type: adr
status: current
evidence:
  - source: README.md
    section: "README header (connectors paragraph) / What augchatd does"
  - source: src/connectors.ts@06313ae
    section: "Discriminated union `Connector = McpConnector | RagConnector`; parseConnectors validation"
  - source: src/mcp.ts@06313ae
    section: "MCP dispatch + read_only filter"
  - source: src/rag.ts@06313ae
    section: "RAG dispatch (BM25; hybrid kNN pending per rag-query PENDING block)"
links:
  - relation: supports
    target: req-001-per-user-credentials
  - relation: supports
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

- **`descriptive_id`** (string, unique within session) — addresses the connector for toggling and logging. Examples: `"rag_public"`, `"rag_internal"`, `"mcp_acme_user_session"`.
- **`name`** (string) — human-friendly display label shown by the bundled UI. Example: `"Base de conhecimentos pública"`.
- **`type`** (enum) — `"mcp"` | `"rag"` (extensible).
- **`default_active`** (boolean) — initial active state at session start. Some connectors may be provisioned but default off (e.g. a powerful tool that the user opts in to per turn).
- **`description`** (string, optional) — free-form hint about what content/data lives behind this connector. RAG: prepended to the retrieve tool description. MCP: prepended to every tool description as a connector-level hint. Helps the LLM disambiguate between connectors when their per-tool descriptions overlap and shape queries without blind guessing.
- Type-specific fields (flat, alongside the common fields — matching the previous flat shape of `mcp_servers[]` and `tools.rag`).

### Type-specific shapes

**`type: "mcp"`**:

- `url` (string) — HTTP/SSE endpoint.
- `auth` (object) — same shape as before (typically `{ bearer: "..." }`).
- `read_only` (boolean, optional, default `true`) — safety gate. When `true`, augchatd only exposes tools the MCP server has explicitly annotated `readOnlyHint: true` (per the MCP spec); unannotated tools and tools annotated `destructiveHint: true` are filtered out. Set to `false` to opt in to writes — explicit integrator decision, not heuristic-based.

**`type: "rag"`**:

- `backend` (enum) — `"opensearch"`. Only OpenSearch is supported currently; pgvector is a future option (see [pressure-pgvector-backend](../../pressure/pgvector-backend.md)).
- `cluster` (string) — backend URL.
- `auth` (object) — backend credentials.
- `indexes` (string[]) — the indexes this connector is scoped to.
- `language` (string, optional) — natural-language hint about the corpus (e.g. `"fr"`, `"French"`, `"pt-BR + en"`). Surfaced in the retrieve tool's description so the LLM phrases queries in the right language for BM25 (which is lexical — a query in one language won't match a corpus in another without semantic embeddings).

### Active state and the scope rule

Each connector carries an *active* boolean **per conversation** (not per session):

- It **starts** at `default_active` when a brand-new conversation is created.
- The browser can **read** the active set for a conversation via `GET /conversations/:cid/connectors` and **toggle** an entry via `PUT /conversations/:cid/connectors/:descriptive_id { active }` — both JWT-authenticated. See [http-get-conversation-connectors](../../contracts/http-get-conversation-connectors.md), [http-put-conversation-connector-state](../../contracts/http-put-conversation-connector-state.md).
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

**The saved state is captured once, at first observation.** `default_active` is only consulted when a connector first enters a conversation's purview — at `POST /conversations` for connectors in scope at creation, or on the first `GET /conversations/:cid/connectors` / `POST /chat` after a new connector is added to the resolved scope. Once captured, the saved flag is the authoritative value; later changes to `default_active` on the integrator side do **not** retroactively affect existing conversations. Only explicit `PUT /conversations/:cid/connectors/:descriptive_id` calls mutate it after the snapshot.

**Atomicity guarantees.**

- `POST /conversations` MUST commit the conversation row and the initial saved state for every connector then in scope **in a single SQLite transaction**. Partial state (a conversation row without snapshots, or with some snapshots missing) MUST NEVER be observable to readers.
- First-observation snapshots from `GET /conversations/:cid/connectors` or `POST /chat` MUST be atomic per `(cid, descriptive_id)` (e.g. `INSERT OR IGNORE` semantics in the underlying SQLite). Concurrent first-observation reads thus produce a single committed row; a `PUT` interleaved with two racing snapshots is never silently overwritten.
- Within a single `POST /chat` request, any first-observation write for a newly-in-scope connector MUST commit before the turn's active-set read; the turn observes what the same request just wrote.
- A `PUT` and an idle flush targeting the same `(cid, descriptive_id)` row MUST share the same canonical hot SQLite row — flush MUST NOT carry a per-session cache that could overwrite a recent `PUT`. See [contract-storage-hot](../../behavior/contracts/storage-hot.md).

**Reconciliation rules when the resolved scope changes between sessions:**

| Connector situation | Behavior |
| --- | --- |
| In current scope AND in saved state | Return the saved flag |
| In current scope AND not in saved state (new conversation, or connector newly added to scope) | Snapshot the current `default_active` into the saved state at the moment of observation; return that value |
| In saved state AND no longer in current scope | **Permanently dropped on next observation** (saved state cleaned up the next time the conversation is loaded under a session whose resolved scope omits the `descriptive_id` — augchatd does not eagerly scan every conversation when scope changes). If the integrator re-adds the same `descriptive_id` later, it follows the "not in saved state" rule above — the previously-saved flag is **not** restored |

### Stability of `descriptive_id`

Active-state persistence keys solely on `descriptive_id`. If the integrator changes what a `descriptive_id` points to between sessions (e.g. `rag_internal` first points at OpenSearch index `eng-docs-2025`; a later session reuses the same `descriptive_id` for `eng-docs-confidential`), every conversation that previously toggled `rag_internal` silently keeps its saved flag — now applied to a different upstream.

> **Integrators must treat `descriptive_id` as a stable semantic identity.** When the upstream the connector represents changes meaningfully (different index set, different OAuth scope, different MCP server, different vendor), **use a new `descriptive_id`**. Reusing a `descriptive_id` for a different upstream is the equivalent of reusing a database primary key for a different row.

## Consequences

- One server-side dispatcher with a `type` switch; new connector types extend the enum without reshaping the payload.
- The bundled UI gains a connector panel inside each conversation: each entry shows `name`, `type`, and a toggle bound to the active state. Credentials are never sent to the browser. The listing endpoint `GET /conversations/:cid/connectors` returns `[{descriptive_id, name, type, active}]` — the resolved scope intersected with the conversation's saved active flags.
- The `model` (LLM) is **not** a connector — it is the chat engine itself, configured once per session.
- Existing language in the spec moves from "MCP server" / "RAG backend" to "connector of type X" where the unified vocabulary helps; the lower-level contracts (`mcp-invocation`, `rag-query`) continue to describe the per-type mechanics.

## Alternatives considered

- **Keep separate `mcp_servers[]` and `tools.rag`** — works for the previous level of complexity, but doesn't support mid-conversation toggling cleanly, and requires a new key/shape for every future provider type.
- **Allow runtime addition/removal of connectors** — would let the end user *expand* their resolved scope mid-conversation, violating the "integrator resolves, augchatd applies" principle. Rejected; re-mint the session if scope must change.
