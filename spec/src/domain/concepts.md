---
id: domain-concepts
type: domain
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "How it works / Storage / Token & credential refresh"
---

# Domain concepts

Concepts that recur across bounded contexts, each tied to where they are introduced.

## Session

A bag of: `user_id`, `system_prompt`, `model + key`, `connectors[]?`, `storage.s3`.
Issued a `session_id` and a `jwt` (signature-validated). The session's lifetime is **exactly the JWT TTL** — configurable via `ttl_seconds` at creation time (default 60s for development; production typically ~30 min). When the JWT expires, the session is gone; the conversation it was attached to survives in storage.

Identified to the integrator by `session_id`; identified to the browser by the JWT. A session can also be ended explicitly via `DELETE /sessions/:id` (mTLS) — see [contract-session-delete](../behavior/contracts/session-delete.md).

Minimal session is `model + storage`. `connectors[]` is optional — a session with an empty `connectors[]` is a plain chat with no tools or retrieval.

## Conversation

Persistent chat history, identified by `conversation_id`. A conversation:

- can be created, listed, retrieved, and deleted by the browser via the JWT API
- can span **any number of sessions** — when a session ends (JWT expiry, disconnect, forced delete), the conversation persists in storage and the next session can resume it
- lives hot (in SQLite) while a session is actively using it, and is flushed to cold (the integrator's S3 bucket) on disconnect or 5-minute idle (see [Storage tier](#storage-tier))

The browser owns the choice of which conversation to load; the integrator's backend mints sessions but does not directly manipulate conversations.

## Connector

A **tool or retrieval provider** attached to a session. Provisioned as one entry in the session's `connectors[]` list.

A connector has:

- **`descriptive_id`** (string, unique within the session, **stable across sessions**) — addresses the connector for toggling and logging. Active-state persistence keys on this identifier, so reusing the same `descriptive_id` for a different upstream silently inherits the saved flag — see [adr-0010, "Stability of `descriptive_id`"](../architecture/adrs/0010-unified-connector-model.md#stability-of-descriptive_id). Examples: `"rag_public"`, `"rag_internal"`, `"mcp_acme_user_session"`.
- **`name`** (string) — display-friendly label shown by the bundled UI.
- **`type`** (enum) — `"mcp"` (an MCP server) or `"rag"` (a retrieval backend). Extensible.
- **`default_active`** (boolean) — the connector's active state at session start.
- **Type-specific configuration** (flat, alongside the common fields):
  - `mcp` → `url`, `auth`.
  - `rag` → `backend` (currently `"opensearch"`; pgvector is a future option — see [pressure-pgvector-backend](../pressure/pgvector-backend.md)), `cluster`, `auth`, `indexes[]`.

**Active state (per conversation).** Each connector has a **per-conversation** active flag — the same connector can be active in one conversation and inactive in another. For a brand-new conversation, the flag starts at `default_active`. The end user toggles it via the bundled UI (`GET /conversations/:cid/connectors`, `PUT /conversations/:cid/connectors/:descriptive_id`). **Only active connectors for the current conversation expose tools to the LLM.** The active set is captured at the start of each chat turn — toggling mid-turn does not abort an in-flight tool call.

The active state is **persisted as part of the conversation** (hot SQLite, flushed to cold S3) — it survives session re-mints, JWT refreshes, and resumes. Different conversations of the same user are independent.

**Scope rule.** The integrator's application **resolves the scope** — which connectors get provisioned — at session creation. The end user can only **narrow** the scope (turn connectors off), never extend it. Adding a new connector requires a new session.

See [adr-0010-unified-connector-model](../architecture/adrs/0010-unified-connector-model.md).

## Credential

A secret that authorizes a network call. Five kinds appear:

- **mTLS client cert** — integrator's backend → augchatd (server-to-server).
- **JWT** — browser → augchatd (per-session).
- **LLM API key** — augchatd → LLM provider (per session, end user's or integrator's).
- **Connector credentials** — augchatd → an upstream connector (a per-connector secret, e.g. an MCP bearer token or RAG backend credentials).
- **S3 credentials** — augchatd → S3-compatible storage (per session, integrator's bucket).

Credentials never leave their lane:
- Browser only ever sees the JWT.
- Other credentials live in process memory for the session's lifetime.

## Scope

The set of resources a session may touch. Two layers:

1. **Resolved scope** — the integrator's application decides this at session creation and passes it as the session payload: which connectors (their types and configs), which S3 bucket. augchatd does **not** decide this.
2. **Active scope** — at any moment, the subset of the resolved scope currently enabled. Starts equal to the resolved set (modulo each connector's `default_active`); the end user can toggle individual connectors off to narrow it. **The active scope can only be a subset of the resolved scope** — augchatd never extends what the integrator declared.

augchatd **enforces** the active scope on every message and tool call; it does not compute it.

## Expiry & refresh

Two kinds of expiry use the **same** refresh path:

1. **JWT expiry** — next message returns 401 → browser asks integrator for a new JWT → resumes.
2. **MCP credential expiry** — upstream MCP returns 401 → augchatd surfaces 401 to the browser → same path as above. The integrator re-mints the session with currently-valid credentials from its own token vault.

augchatd holds no refresh logic of its own.

## Storage tier

- **Hot** — embedded SQLite, one DB per `(mTLS tenant, user)` at `data/<tenantId>/<userId>.sqlite`. Lives while any session for that user is alive; removed after all sessions end and all conversations flush.
- **Cold** — integrator's S3.

The promise: hot is not dropped until cold confirms.

## Tenant

Two senses, distinguished:

- **mTLS tenant** — the calling backend's client-cert identity. Determines which **hot** SQLite DB is used.
- **End user** — `user_id` inside a session. Determines which credentials and scope are loaded.

augchatd provides *logical* isolation within one process. For mutually hostile tenants, deploy one augchatd process per tenant.

> [!NOTE]
> **The mTLS tenant identity does not partition cold storage.** Cold storage lives in the integrator's S3 bucket, supplied per session via `storage.s3` — the bucket itself is the cold partition. Cert rotation (which changes the mTLS tenant identity) does not orphan cold data: the integrator's bucket and credentials are independent of the cert. See [constraint-tenant-isolation](../constraints/tenant-isolation.md).
