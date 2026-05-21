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

The README states the browser API supports:

- list conversations
- create conversation
- delete conversation
- send a message
- receive streamed reply

> [!NOTE] Assumption
> The README does not enumerate exact paths/verbs. They are an evidence gap until code lands. Likely RESTful (`GET /conversations`, `POST /conversations`, `DELETE /conversations/:id`, `POST /conversations/:id/messages` or similar) but unconfirmed.

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
- MCP credentials or URLs
- RAG cluster URL or credentials
- S3 credentials

Tool indicators are sanitized at the augchatd boundary.

## Related

- Behavior: [session-chat](../behavior/contracts/session-chat.md)
- Stack note: [adr-0006-vercel-ai-sdk](../architecture/adrs/0006-vercel-ai-sdk-for-llm.md)
