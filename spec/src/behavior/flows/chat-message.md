---
id: flow-chat-message
type: behavior-contract
status: proposed
capability: cap-chat
evidence:
  - source: README.md@e562b2b
    section: "How it works (step 3) / What augchatd does (tool-use loop)"
links:
  - relation: refines
    target: contract-session-chat
  - relation: refines
    target: contract-mcp-invocation
  - relation: refines
    target: contract-rag-query
---

# Flow — One chat message

```
Browser (iframe)                augchatd                     LLM / MCP / RAG
      │                             │                              │
      │  POST /chat (JWT) + msg     │                              │
      │ ──────────────────────►     │                              │
      │                             │  validate JWT (signature)    │
      │                             │  load session from memory    │
      │                             │  append msg to hot SQLite    │
      │                             │                              │
      │                             │  LLM call (session's key)    │
      │                             │ ───────────────────────────► │
      │                             │ ◄─── tool calls ──────────── │
      │                             │                              │
      │                             │  (if MCP) per-server         │
      │                             │   credentials, HTTP/SSE      │
      │                             │ ───────────────────────────► │
      │                             │ ◄─── tool results ────────── │
      │                             │                              │
      │                             │  (if RAG) scoped query       │
      │                             │ ───────────────────────────► │
      │                             │ ◄─── hits ────────────────── │
      │                             │                              │
      │                             │  LLM call (with results)     │
      │                             │ ───────────────────────────► │
      │                             │ ◄─── final assistant msg ── │
      │                             │                              │
      │  streamed reply             │                              │
      │   (assistant-ui /           │                              │
      │    Vercel AI SDK            │                              │
      │    data stream)             │                              │
      │ ◄──────────────────────     │                              │
      │                             │  append assistant msg to hot │
```

## Notes

- The browser only sees the streamed reply and sanitized tool indicators.
- All credentials stay in the augchatd process.
- The hot SQLite is the source of truth during the session; cold S3 is durability + resume.
- On 401 from any upstream (LLM rarely; MCP commonly), augchatd surfaces 401 to the browser → [jwt-refresh](../contracts/jwt-refresh.md).
