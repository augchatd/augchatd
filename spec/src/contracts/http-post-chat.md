---
id: technical-contract-http-post-chat
type: technical-contract
status: current
evidence:
  - source: src/routes/chat.ts@ca3458a
    section: "chatHandler — request parsing, validation, stream response"
  - source: src/auth.ts@ca3458a
    section: "requireSession — JWT auth middleware that runs before the handler"
links:
  - relation: supports
    target: contract-session-chat
  - relation: supports
    target: technical-contract-browser-streaming
---

# Technical contract — `POST /chat`

## Auth

JWT (Bearer). Enforced by `requireSession` middleware before the handler runs. Three 401 sub-codes — `missing_jwt`, `invalid_jwt`, `session_gone` — share the single refresh recovery path (see [jwt-refresh](../behavior/contracts/jwt-refresh.md)).

## Request

`POST /chat`
`Content-Type: application/json`

### Body

```json
{
  "id": "<conversation_id>",
  "messages": [ ...UIMessage[]... ]
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string (non-empty) | yes | The target `conversation_id`. Named `id` (not `conversation_id`) for symmetry with the assistant-ui transport which passes the field through. Unknown id → see "Failure modes" below. |
| `messages` | UIMessage[] | yes, non-empty | The full conversation thread up to and including the user message that triggers this turn. Vercel AI SDK `UIMessage` shape: `{ id, role, parts[], metadata? }`. The chat handler appends the assistant reply and persists the resulting thread via `upsertMessages` on stream completion. |

The browser library that constructs this body (`AssistantChatTransport` configured in `ui/src/App.tsx`) is responsible for keeping `messages` in sync with the server's saved history; if the array is missing turns, the LLM will see a truncated context. The server does not reconcile against `GET /conversations/:cid/messages` before responding.

## Response — success

`200 OK`
`Content-Type: text/event-stream`

A Server-Sent Events stream using the Vercel AI SDK data-stream protocol. See [browser-streaming](browser-streaming.md) for the part vocabulary (`start`, `start-step`, `text-*`, `reasoning-*`, `tool-input-*`, `tool-output-*`, `source-document`, `finish`, message-level metadata). The handler holds the connection open through long silent reasoning gaps — see [adr-0011](../architecture/adrs/0011-tolerate-reasoning-model-stream-gaps.md).

## Failure modes

| Status | Body | Cause |
| --- | --- | --- |
| `400` | `{"error":"invalid_json"}` | Body is not valid JSON. |
| `400` | `{"error":"missing_messages"}` | `messages` absent, not an array, or empty. |
| `400` | `{"error":"missing_conversation_id"}` | `id` absent or not a non-empty string. |
| `401` | `{"error":"missing_jwt"}` \| `{"error":"invalid_jwt"}` \| `{"error":"session_gone"}` | Auth middleware rejected the request — see [contract-jwt-refresh](../behavior/contracts/jwt-refresh.md) PENDING block for `session_gone`. |
| `503` | `{"error":"hot_write_failed","detail":"…"}` + `X-Augchatd-Reason: hot-write-failed` | A SQLite write failed during conversation auto-create or message persistence. |

**Note on auto-create.** If `id` is unknown to the user's hot SQLite, the handler creates the conversation row before streaming (`getConversation(...) ?? createConversation(...)` in [src/routes/chat.ts](../../../src/routes/chat.ts)). This auto-create is an intentional deviation from a stricter "register first" contract — see the Implementation status note in [contract-connector-toggle](../behavior/contracts/connector-toggle.md). It does NOT apply to `PUT` lanes (see issue #9 §D8 — those tighten to 404 on unknown cid).

## Streaming behavior

- The handler returns the response after the request body is parsed and validated. The SSE stream is then driven by `streamText` from the Vercel AI SDK.
- Stream parts are buffered through `createUIMessageStream` and flushed to the socket as they arrive.
- An error during streaming is captured in the `onError` callback and written to the per-conversation JSONL trace (see [constraint-observability](../constraints/observability.md)). Once 200 OK has been sent the chat handler cannot retroactively emit a 401 — upstream MCP-401 errors take the "stream sentinel UI part" recovery proposed in [contract-jwt-refresh](../behavior/contracts/jwt-refresh.md)'s PENDING block.
- Client abort: today the handler does not subscribe to `c.req.raw.signal`, so the LLM call + any in-flight tool calls run to completion after the client disconnects, and the partial assistant message is persisted. Tracked as issue #9 §C8.

## Related

- Behavior: [contract-session-chat](../behavior/contracts/session-chat.md)
- Stream protocol: [browser-streaming](browser-streaming.md)
- Auth recovery: [contract-jwt-refresh](../behavior/contracts/jwt-refresh.md)
