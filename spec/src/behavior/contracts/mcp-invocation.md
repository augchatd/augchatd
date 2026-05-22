---
id: contract-mcp-invocation
type: behavior-contract
status: proposed
capability: cap-chat
evidence:
  - source: README.md@e562b2b
    section: "What augchatd does (tool-use loop) / What augchatd does NOT do (stdio)"
  - source: README.md
    section: "README header (connectors paragraph)"
links:
  - relation: satisfies
    target: req-001-per-user-credentials
  - relation: depends_on
    target: contract-session-chat
  - relation: depends_on
    target: contract-connector-toggle
  - relation: constrains
    target: contract-session-create
  - relation: refines
    target: adr-0010-unified-connector-model
---

# Contract — MCP tool invocation

## Promise

When the LLM in a chat turn emits a tool call that resolves to one of the **conversation's active MCP-type connectors** (active state is per-conversation; see [contract-connector-toggle](connector-toggle.md)), augchatd:

1. Looks up that connector's `url` and `auth` from the session's connector registry (in-memory).
2. Makes the call over **HTTP or SSE** (no stdio).
3. Passes the auth (typically `bearer`) on every call.
4. Treats a 401 as a connector-credential-expiry event ([jwt-refresh](jwt-refresh.md) path).
5. Feeds the result back into the LLM loop.

MCP-type connectors **inactive for the current conversation** are **not exposed** to the LLM at the start of the turn — the LLM cannot emit a tool call resolving to them. Active state is per-conversation (see [contract-connector-toggle](connector-toggle.md)); the same MCP connector can be active in one conversation and inactive in another.

The browser sees the *tool was called* with the connector's `descriptive_id` / `name` and a sanitized result. It does not see the URL or the auth.

## Observable outcomes

- Outbound request to the MCP carries that connector's credentials (verifiable by mock MCP).
- A second concurrent session for a different user, hitting the same MCP URL via its own connector, carries different credentials.
- No stdio connection is ever opened.
- A 401 from the MCP propagates as a 401 to the browser (same code path as JWT-401).
- An MCP-type connector toggled off is absent from the tool list of the next chat turn.

## Non-promises

- augchatd does not host the MCP, scaffold MCPs, or proxy other transports.
- augchatd does not interpret MCP results; it hands them back to the LLM.

## Tests this contract implies

- Mock MCP that records inbound headers — confirm credentials match the connector's `auth`.
- Two concurrent sessions, two distinct credentials captured (each session's connector).
- Stdio attempt (no HTTP/SSE URL) is rejected at session creation.
- MCP 401 surfaces as 401 to the browser.
- Toggling an MCP-type connector off for a conversation via `PUT /conversations/:cid/connectors/:descriptive_id` removes it from the next turn's tool exposure in that conversation; chat against other conversations where the connector is active keeps using it.
