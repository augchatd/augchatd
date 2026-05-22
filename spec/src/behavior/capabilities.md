---
id: capabilities-index
type: capability
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "How it works / What augchatd does / Token & credential refresh / Storage"
---

# Capabilities

Top-level capabilities augchatd offers. Each links to its requirement(s) and behavior contract(s).

| ID | Capability | Owns | Requirements | Contracts |
| --- | --- | --- | --- | --- |
| `cap-session-mgmt` | **Session management** | Mint, authenticate, expire, refresh, and forcibly delete sessions | [req-001](requirements/req-001-per-user-credentials.md), [req-003](requirements/req-003-server-side-secrets.md), [req-006](requirements/req-006-credential-refresh-via-backend.md) | [session-create](contracts/session-create.md), [jwt-refresh](contracts/jwt-refresh.md), [session-delete](contracts/session-delete.md) |
| `cap-chat` | **Chat tool-use loop** | Stream replies; drive LLM + active connectors per turn | [req-001](requirements/req-001-per-user-credentials.md), [req-002](requirements/req-002-rag-scoping.md) | [session-chat](contracts/session-chat.md), [mcp-invocation](contracts/mcp-invocation.md), [rag-query](contracts/rag-query.md) |
| `cap-connectors` | **Connector lifecycle** | Provision connectors at session creation (integrator-driven); list and toggle active state at chat time (end-user-driven) | [req-001](requirements/req-001-per-user-credentials.md), [req-002](requirements/req-002-rag-scoping.md) | [connector-toggle](contracts/connector-toggle.md), [http-get-conversation-connectors](../contracts/http-get-conversation-connectors.md), [http-put-conversation-connector-state](../contracts/http-put-conversation-connector-state.md) |
| `cap-storage` | **Conversation storage** | Hot in SQLite, cold in S3, flush + hydrate | [req-004](requirements/req-004-tier-stored-history.md) | [storage-hot](contracts/storage-hot.md), [storage-flush](contracts/storage-flush.md) |
| `cap-ui` | **Bundled UI** | Serve same-origin chat UI; JWT handshake via postMessage | [req-007](requirements/req-007-bundled-ui.md) | [ui-handshake](contracts/ui-handshake.md) |
| `cap-isolation` | **Tenant isolation** | Logical separation by mTLS tenant and session memory | [req-005](requirements/req-005-tenant-isolation.md) | (cross-cutting; see [constraints/tenant-isolation.md](../constraints/tenant-isolation.md)) |
| `cap-demo` | **Demo mode** | Single-tenant boot from env vars | (no separate requirement; serves intent-success step 4) | [demo-mode](contracts/demo-mode.md) |
| `cap-ops` | **Operational probes** | Expose process mode for deploy-safety gating | (no separate requirement) | [http-get-healthz](../contracts/http-get-healthz.md) |

## Capabilities augchatd does not offer

See [intent/non-goals.md](../intent/non-goals.md). Capability-shaped omissions worth naming:

- No "manage users" capability.
- No "enforce policy" capability beyond honoring what setup declared.
- No "host MCPs" or "ingest documents" capability.
- No "meter LLM usage" or "rate limit per tenant" capability.
