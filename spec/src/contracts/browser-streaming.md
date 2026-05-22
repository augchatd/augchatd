---
id: technical-contract-browser-streaming
type: technical-contract
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "What augchatd does (minimal browser API) / How it works (step 3)"
links:
  - relation: supports
    target: contract-session-chat
---

# Technical contract — Browser-facing chat API

## Auth

JWT (Bearer), obtained via the [postMessage handshake](browser-postmessage.md) (production) or [`GET /demo/jwt`](http-get-demo-jwt.md) (demo).

## Surface (declared minimum)

The browser API supports:

**Conversations:**
- list conversations
- create conversation
- get a conversation's history
- delete conversation
- send a message (chat)
- receive streamed reply

**Connectors** (see [contract-connector-toggle](../behavior/contracts/connector-toggle.md)):
- list connectors with active state — [GET /connectors](http-get-connectors.md)
- toggle a connector's active state — [PUT /connectors/:descriptive_id](http-put-connector-state.md)

> [!NOTE] Assumption
> The README does not enumerate exact paths/verbs for the conversation endpoints. They are an evidence gap until code lands. Likely RESTful (`GET /conversations`, `POST /conversations`, `DELETE /conversations/:id`, `POST /chat` or `POST /conversations/:id/messages` or similar) but unconfirmed. The connector endpoints **are** specified — see the two technical-contract files linked above.

## Streaming protocol

The streamed reply uses the **assistant-ui native protocol** = **Vercel AI SDK data stream**.

That stream carries:

- assistant message tokens (incrementally)
- sanitized tool-call indicators (no credentials, no internal URLs)
- tool result indicators
- final completion signal

## What the browser never sees

Per [req-003](../behavior/requirements/req-003-server-side-secrets.md):

- LLM API key
- Connector credentials (MCP auth, RAG backend auth) or upstream URLs (MCP URL, RAG cluster)
- S3 credentials

Tool indicators are sanitized at the augchatd boundary; they carry connector `descriptive_id` / `name` but never `auth`, `url`, `cluster`, or `indexes`.

## Related

- Behavior: [session-chat](../behavior/contracts/session-chat.md)
- Stack note: [adr-0006-vercel-ai-sdk](../architecture/adrs/0006-vercel-ai-sdk-for-llm.md)
