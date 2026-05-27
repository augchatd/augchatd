---
id: adr-0004-http-sse-mcp-only
type: adr
status: current
evidence:
  - source: README.md@e562b2b
    section: "What augchatd does NOT do (stdio)"
  - source: src/mcp.ts@06313ae
    section: "StreamableHTTPClientTransport — the only MCP transport instantiated"
links:
  - relation: supports
    target: contract-mcp-invocation
---

# ADR 0004 — MCP transport is HTTP/SSE only; stdio is out of scope

## Context

The MCP ecosystem has many public servers shipped as stdio-only — they assume the MCP runs co-located with the client process. That assumption doesn't fit a **remote, multi-tenant daemon** whose per-session contract is `URL + auth`.

## Decision

augchatd connects to MCP servers over **HTTP or SSE only**. No stdio support.

Integrators that want to use a stdio-only MCP wrap it in a small HTTP/SSE bridge (e.g. [`mcpo`](https://github.com/open-webui/mcpo)). The bridge converts the local-only stdio model into the network contract augchatd needs.

## Consequences

- Every MCP augchatd talks to is a network endpoint with stable URL + auth.
- Each MCP-type connector in the session payload's `connectors[]` is a clean `{ url, auth }` shape (plus the common connector fields). See [adr-0010-unified-connector-model](0010-unified-connector-model.md).
- Public stdio-only MCPs require a bridge for use; documented in README.
- No subprocess management inside augchatd.

## Alternatives considered

- **Support stdio with co-located MCPs** — breaks the multi-tenant remote-daemon model.
- **Spawn stdio MCPs as subprocesses per session** — explodes operational complexity and breaks credential isolation guarantees.
