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

JWT (Bearer), obtained via the [postMessage handshake](browser-postmessage.md). The parent that supplies the JWT is the `GET /demo/` wrapper in demo (which calls `POST /demo/sessions` server-side) or the integrator's app page in production (which calls [`POST /sessions`](http-post-sessions.md) server-side).

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
- list a conversation's connectors with active state — [GET /conversations/:cid/connectors](http-get-conversation-connectors.md)
- toggle a connector's active state for a conversation — [PUT /conversations/:cid/connectors/:descriptive_id](http-put-conversation-connector-state.md)

> [!NOTE] Status of the conversation endpoints
> Settled (code on branch `trace-conversations`):
> - `POST /conversations` (create)
> - `POST /chat` (send a message; the streamed reply uses the protocol below)
> - `GET /conversations/:cid/messages` (full history for replay/hydration)
>
> Still gaps (planned, not yet implemented):
> - `GET /conversations` (list all conversations of the user)
> - `DELETE /conversations/:cid` (remove a conversation)

## URL convention (bundled UI)

The bundled UI keeps the active conversation in the URL using the shape `/c/<conversation_id>`. This is a **UI convention layered on top of the existing JSON contracts** — it does not add HTTP surface beyond `POST /conversations` and `GET /conversations/:cid/messages`.

Behavior:

- **Boot with no path** → `POST /conversations` to mint a UUID, then `history.replaceState("/c/<uuid>")`.
- **Boot with `/c/<cid>`** → `GET /conversations/:cid/messages` to hydrate. On 404 (unknown cid for this session's `(tenant, user)`), mint a fresh conversation and `replaceState` to the new id.
- **Chat transport overrides `body.id` to the URL cid** — the assistant-ui-internal `threadListItem.id` stays client-local and never goes on the wire.

**Auth boundary is implicit** via the hot-storage partition `data/<tenantId>/<userId>.sqlite`: a cid owned by a different `(tenant, user)` resolves to `conversation_not_found` (404), so no explicit cross-session check is needed in the routing layer.

Inside an iframe (demo wrapper or production integrator), route changes are mirrored to the parent via the `augchatd:route` postMessage (see [browser-postmessage](browser-postmessage.md)) so a hard reload of the parent URL preserves the conversation.

## Streaming protocol

The streamed reply uses the **assistant-ui native protocol** = **Vercel AI SDK data stream**.

That stream carries:

- assistant message tokens (incrementally)
- sanitized tool-call indicators (no credentials, no internal URLs)
- tool result indicators
- **`source-document` parts** — one per RAG hit, with `providerMetadata.augchatd = {source_descriptive_id, index, doc_id, score, snippet}`. Rendered as clickable chips by the bundled UI (see [contract-rag-query](../behavior/contracts/rag-query.md))
- **per-message metadata** — each assistant message carries `metadata.augchatd = {model_id, provider}` identifying which model produced it. Rendered as a per-message chip by the bundled UI (see [contract-session-chat](../behavior/contracts/session-chat.md))
- final completion signal

The transport holds the connection open across multi-tens-of-seconds silent gaps between frames — reasoning models routinely produce these between tool-call rounds. See [adr-0011](../architecture/adrs/0011-tolerate-reasoning-model-stream-gaps.md).

## What the browser never sees

Per [req-003](../behavior/requirements/req-003-server-side-secrets.md):

- LLM API key
- Connector credentials (MCP auth, RAG backend auth) or upstream URLs (MCP URL, RAG cluster)
- S3 credentials

Tool indicators are sanitized at the augchatd boundary; they carry connector `descriptive_id` / `name` but never `auth`, `url`, `cluster`, or `indexes`.

## Related

- Behavior: [session-chat](../behavior/contracts/session-chat.md)
- Stack note: [adr-0006-vercel-ai-sdk](../architecture/adrs/0006-vercel-ai-sdk-for-llm.md)
