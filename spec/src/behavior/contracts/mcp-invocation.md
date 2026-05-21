---
id: contract-mcp-invocation
type: behavior-contract
status: proposed
capability: cap-chat
evidence:
  - source: README.md@e562b2b
    section: "What augchatd does (tool-use loop) / What augchatd does NOT do (stdio)"
links:
  - relation: satisfies
    target: req-001-per-user-credentials
  - relation: depends_on
    target: contract-session-chat
  - relation: constrains
    target: contract-session-create
---

# Contract — MCP tool invocation

## Promise

When the LLM in a chat turn emits a tool call that resolves to one of the session's provisioned MCP servers, augchatd:

1. Looks up that MCP's URL and auth from the session's in-memory record.
2. Makes the call over **HTTP or SSE** (no stdio).
3. Passes the auth (typically `bearer`) on every call.
4. Treats a 401 as an MCP-credential-expiry event ([jwt-refresh](jwt-refresh.md) path).
5. Feeds the result back into the LLM loop.

The browser sees the *tool was called* and a sanitized indicator. It does not see the MCP URL or the auth.

## Observable outcomes

- Outbound request to the MCP carries this session's credentials (verifiable by mock MCP).
- A second concurrent session for a different user hitting the same MCP URL carries different credentials.
- No stdio connection is ever opened.
- A 401 from the MCP propagates as a 401 to the browser (same code path as JWT-401).

## Non-promises

- augchatd does not host the MCP, scaffold MCPs, or proxy other transports.
- augchatd does not interpret MCP results; it hands them back to the LLM.

## Tests this contract implies

- Mock MCP that records inbound headers — confirm credentials match session.
- Two concurrent sessions, two distinct credentials captured.
- Stdio attempt (no HTTP/SSE URL) is rejected at session creation.
- MCP 401 surfaces as 401 to the browser.
