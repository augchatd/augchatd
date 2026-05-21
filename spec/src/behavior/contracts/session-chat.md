---
id: contract-session-chat
type: behavior-contract
status: proposed
capability: cap-chat
evidence:
  - source: README.md@e562b2b
    section: "How it works (step 2) / What augchatd does (tool-use loop, bundled UI)"
links:
  - relation: satisfies
    target: req-001-per-user-credentials
  - relation: satisfies
    target: req-002-rag-scoping
  - relation: depends_on
    target: contract-session-create
  - relation: depends_on
    target: technical-contract-browser-streaming
  - relation: enables
    target: contract-mcp-invocation
  - relation: enables
    target: contract-rag-query
---

# Contract — Chat (tool-use loop)

## Promise

Given a valid JWT and an end-user message, augchatd runs a server-side **tool-use loop**:

1. Send conversation context + message to the LLM.
2. If the LLM emits tool calls, augchatd executes them server-side:
   - **MCP tools** with that session's per-server credentials (see [mcp-invocation](mcp-invocation.md))
   - **RAG queries** scoped to that session's allowed indexes (see [rag-query](rag-query.md))
3. Feed tool results back to the LLM.
4. Loop until the LLM produces a final assistant message.
5. **Stream** the reply to the browser using the assistant-ui native protocol (Vercel AI SDK data stream).

Throughout, only the session's provisioned credentials and scope are used.

## Observable outcomes

- A streamed reply reaches the browser with no LLM key, MCP credential, or RAG cluster URL exposed.
- Tool-call indicators in the stream are sanitized — they show *what was called* but not credentials or internal URLs.
- A second concurrent session's call to the same MCP URL carries that session's credentials, not the first's.

## Non-promises

- augchatd does not implement planning, long-term memory, or autonomous agent loops.
- augchatd does not retry an LLM provider failure beyond what the Vercel AI SDK does.
- augchatd does not moderate or PII-redact messages.

## Tests this contract implies

- A simple chat round-trips with no tools provisioned.
- A chat with an MCP tool fires the MCP with the session's credentials and returns the result.
- A chat with RAG fires a query restricted to the allowed indexes.
- Two concurrent sessions hitting the same MCP carry distinct credentials in the captured outbound request.
- Streamed reply is consumable by an assistant-ui client without modification.
