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

A bag of: `user_id`, `system_prompt`, `model + key`, `mcp_servers?`, `rag?`, `storage.s3`.
Issued a `session_id` and a `jwt` (signature-validated, minutes-long).
Lives in memory; dies on disconnect or expiry. Identified to the integrator by `session_id`; identified to the browser by the JWT.

Minimal session is `model + storage`. `mcp_servers` and `rag` are independently optional.

## Credential

A secret that authorizes a network call. Five kinds appear:

- **mTLS client cert** — integrator's backend → augchatd (server-to-server).
- **JWT** — browser → augchatd (per-session).
- **LLM API key** — augchatd → LLM provider (per session, end user's or integrator's).
- **MCP auth** (typically bearer) — augchatd → MCP server (per session, end user's OAuth token).
- **S3 credentials** — augchatd → S3-compatible storage (per session, integrator's bucket).

Credentials never leave their lane:
- Browser only ever sees the JWT.
- Other credentials live in process memory for the session's lifetime.

## Scope

The set of resources a session may touch. Set at session creation, enforced on every message:

- Which MCP servers (URLs + per-server auth).
- Which RAG indexes (subset of the backend's catalogue).
- Which S3 bucket prefix is the cold-storage target.

Scope is supplied by the integrator. augchatd does not compute it.

## Expiry & refresh

Two kinds of expiry use the **same** refresh path:

1. **JWT expiry** — next message returns 401 → browser asks integrator for a new JWT → resumes.
2. **MCP credential expiry** — upstream MCP returns 401 → augchatd surfaces 401 to the browser → same path as above. The integrator re-mints the session with currently-valid credentials from its own token vault.

augchatd holds no refresh logic of its own.

## Storage tier

- **Hot** — embedded SQLite, one DB per mTLS tenant, ephemeral (created on first session, destroyed only after a clean flush).
- **Cold** — integrator's S3.

The promise: hot is not dropped until cold confirms.

## Tenant

Two senses, distinguished:

- **mTLS tenant** — the calling backend's client-cert identity. Determines which hot SQLite DB is used.
- **End user** — `user_id` inside a session. Determines which credentials and scope are loaded.

augchatd provides *logical* isolation within one process. For mutually hostile tenants, deploy one augchatd process per tenant.
