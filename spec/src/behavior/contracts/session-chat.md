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

1. **Snapshot** the session's **active connector set** at the start of the turn.
2. Send conversation context + message to the LLM, exposing only the tools backed by **active connectors**.
3. If the LLM emits tool calls, augchatd dispatches each to the responsible connector server-side:
   - **MCP-type connectors** with that connector's credentials (see [mcp-invocation](mcp-invocation.md))
   - **RAG-type connectors** scoped to that connector's allowed `indexes[]` (see [rag-query](rag-query.md))
4. Feed tool results back to the LLM.
5. Loop until the LLM produces a final assistant message.
6. **Stream** the reply to the browser using the assistant-ui native protocol (Vercel AI SDK data stream).

Throughout, only the session's provisioned credentials and the **active scope captured at turn start** are used. Inactive connectors are not exposed to the LLM; toggling a connector mid-turn does **not** abort an in-flight tool call.

## Observable outcomes

- A streamed reply reaches the browser with no LLM key, connector credentials, or upstream URLs exposed.
- Tool-call indicators in the stream are sanitized — they show *what was called* (the connector's `descriptive_id` / display name) but not credentials or internal URLs.
- A second concurrent session calling the same MCP URL carries **that session's connector credentials**, not the first's.
- A connector toggled off via `PUT /connectors/:descriptive_id { active: false }` is **not present** in the tool list of the next chat turn.
- When the session is in **read-only mode** because its cold-storage flush has stalled past threshold (see [storage-flush](storage-flush.md) / [storage-durability](../../constraints/storage-durability.md)), `POST /chat` returns `503 Service Unavailable` with `X-Augchatd-Reason: flush-stalled` — `GET /conversations*` continues to serve reads. **The bundled UI surfaces this state with a visible "Service temporarily read-only — your messages are preserved" banner and disables the chat input** until recovery. The session auto-recovers on the next successful flush; the banner disappears automatically.

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
