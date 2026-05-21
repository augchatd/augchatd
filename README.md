# augchatd

> Per-user MCP credentials and per-user RAG scoping for LLM chat in your app. Provisioned by your existing auth at session creation. Never exposed to the browser.

```bash
# Your backend, once per chat session:
curl -X POST https://augchatd.your-infra/sessions \
  --cert prod-client.pem --key prod-client.key \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "user_42",
    "system_prompt": "You are a helpful assistant.",
    "model":       { "provider": "anthropic", "model_id": "claude-opus-4-7", "api_key": "sk-ant-..." },
    "mcp_servers": [ { "url": "https://your-mcp/",    "auth": { "bearer": "..." } } ],
    "tools":       { "rag": { "backend": "opensearch", "cluster": "https://your-opensearch/", "indexes": ["docs"] } },
    "storage":     { "s3": "s3://AKIA...@your-bucket/" }
  }'
# → { "session_id": "...", "jwt": "eyJ...", "expires_at": "..." }
```

```html
<!-- In your app: embed augchatd's bundled UI, then hand it the JWT. -->
<iframe id="chat" src="https://augchatd.your-infra/"></iframe>
<script>
  document.getElementById('chat').addEventListener('load', () => {
    document.getElementById('chat').contentWindow.postMessage(
      { type: 'augchatd:jwt', jwt: jwtFromYourBackend },
      'https://augchatd.your-infra'
    );
  });
</script>
```

`tools.rag.backend` can be `"opensearch"` (hybrid BM25 + kNN, native) or `"pgvector"` (vector-only out of the box; combine with your own `tsvector` index if you want lexical). `mcp_servers` and `tools.rag` are independently optional — minimal session is just `model + storage`.

The browser never sees the LLM key, the MCP credentials, the RAG cluster, or the storage credentials. Only your server-issued JWT, valid for minutes. The chat UI is bundled in the augchatd binary and served on the same origin as the API — built on [assistant-ui](https://github.com/assistant-ui/assistant-ui), shipped with the daemon, no separate UI to host.

## The problem augchatd solves

In a B2B SaaS, different users get different tools, different data, and sometimes different LLM tiers. Building this on top of the Vercel AI SDK (or any LLM library) means hand-rolling:

- A **token vault** so each user's GitHub/Slack/Linear OAuth tokens are stored and routed to *their* MCP calls — and never leak across users.
- A **per-request MCP router** that picks the right credentials for the user behind the current message.
- A **RAG query scoper** that constrains every retrieval to the indexes that user is allowed to see, *before* the LLM gets a chance to ask for the wrong one.
- An **OAuth refresh layer** that renews tokens before they expire mid-conversation.

augchatd is the contract that lets your existing auth provision all of this per session, and enforces it for every message. Concretely:

- `user_42` chats with the GitHub MCP using their own OAuth token; `user_99` uses theirs. Neither ever sees the other's credential.
- `user_42` can search the `engineering-docs` and `private-42` indexes; `user_99` only sees `sales-docs`. Retrieval is scoped before the LLM asks.
- `user_42` brings their own Anthropic key (enterprise tier); `user_99` runs on your shared free-tier key. Billing and rate limits stay where they already live — with the provider, per key.

If you've spent two weeks gluing a per-user MCP behind the AI SDK and lost confidence you didn't leak somewhere, this is the part you don't want to own.

## Quick Start (demo mode)

Try augchatd end-to-end without standing up a control plane or mTLS infrastructure. Demo mode loads a single fixed session from environment variables at boot.

```bash
docker run -p 8080:8080 \
  -e AUGCHATD_MODE=demo \
  -e DEMO_MODEL_PROVIDER=anthropic \
  -e DEMO_MODEL_ID=claude-opus-4-7 \
  -e DEMO_MODEL_API_KEY=sk-ant-... \
  -e DEMO_SYSTEM_PROMPT="You are a helpful assistant." \
  augchatd/augchatd   # image TBD — not yet published

open http://localhost:8080
```

Add `DEMO_MCP_SERVERS` and `DEMO_RAG_*` env vars to enable tools and retrieval. The browser loads the bundled UI from the same port, fetches a session JWT from `GET /demo/jwt`, then chats normally.

Demo mode is for local testing and public demos only. It bypasses mTLS, runs single-tenant, and holds credentials in the process environment. The production path (mTLS + `POST /sessions` from your backend, shown above) is unchanged when you graduate; the same binary serves both modes.

## How it works

```
                            ┌──────────────────────────┐
                            │       Your software      │
                            │  (users, auth, policy)   │
                            └─────────────┬────────────┘
                                          │
                       1. setup session (mTLS, server-to-server)
                          { user_id, system_prompt, model+key,
                            mcp_servers?, rag_cluster+creds?,
                            s3_bucket+creds }   (? = optional)
                                          │
                                          ▼
                            ┌──────────────────────────┐
                            │         augchatd         │
                            └─────────────┬────────────┘
                                          │
                       2. returns { session_id, jwt }
                                          │
                                          ▼
   ┌──────────────────────────┐    3. chat (JWT)    ┌──────────────────────────┐
   │  augchatd bundled UI     │ ──────────────────► │  augchatd backend        │
   │  (assistant-ui, iframed  │ ◄── streamed reply ─│  (tool-use loop server)  │
   │   in your software)      │                     │                          │
   └──────────────────────────┘                     └──────────────────────────┘
       (UI and backend run in the same augchatd process, same origin)
                                                                │
                                                                ▼
                                                    ┌─────────────────────┐
                                                    │  LLM │ MCP │ RAG    │
                                                    │  (server-side only) │
                                                    └─────────────────────┘
```

**Two calls do everything:**

1. **Your backend → augchatd** (mTLS): "Create a session for `user_42` with this LLM and key, this S3 bucket for cold storage, this system prompt, and — if the user is allowed — these MCP servers and this RAG backend." augchatd returns a short-lived JWT.
2. **Embedded UI → augchatd** (JWT): chat. augchatd loops between the LLM, MCP servers, and RAG cluster server-side. The UI (assistant-ui, bundled with augchatd, embedded in your app via iframe) only sees the streamed reply and sanitized tool indicators.

### JWT details

- Validation is signature-only — no DB lookup per message, so streaming doesn't pay validation cost per token.
- If a JWT expires mid-conversation, the next message returns 401; the embedded UI requests a new JWT from your backend and resumes — the conversation state survives in storage (hot DB and your S3), not in the token.

### Storage

- **Hot**: internal DB managed by augchatd. One DB per mTLS tenant identifier, created when the first session for that tenant connects, destroyed only after a successful flush to cold.
- **Cold**: your S3-compatible bucket, passed in per session in the setup payload.
- **Flush triggers**: session disconnect, or 5 minutes of inactivity. On session resume, history is hydrated from S3 if no longer hot.
- **Durability**: augchatd tests S3 at session creation (setup fails if it can't write). If a later flush fails, the session keeps running and augchatd retries until persistence succeeds — hot data is not dropped until cold has it.

## Stop / Start

**Stop:**
- Putting LLM keys in your frontend bundle
- Reimplementing user management inside your AI service
- Coupling AI iteration to your main app's release cycle
- Letting the browser talk to MCP servers directly

**Start:**
- Treating chat as a service your existing app provisions per session
- Keeping every credential server-side, where it already lives
- Shipping a chat PoC the same afternoon, via iframe, with no framework migration

## What augchatd does

- **Provisions per-user credentials and scope from your existing auth, at session creation.** Each session carries its own LLM key, MCP servers with the user's own OAuth tokens, and the exact RAG indexes that user is allowed to see. augchatd enforces all of this server-side for every message and tool call. Credentials live in memory for the session's lifetime — never persisted in plaintext logs, never sent to clients.
- Runs the **tool-use loop** server-side, combining MCP tools (when provisioned), optional RAG retrieval, and the LLM response — using only the session's provisioned credentials and scope.
- Runs **retrieval** against the session's RAG backend, when enabled: hybrid (BM25 + kNN) against your OpenSearch cluster, or vector against your pgvector store. Scoped to the indexes/tables the session allows.
- **Tier-stores conversation history**: hot in an internal DB managed by augchatd (one DB per mTLS tenant, ephemeral), cold in your S3-compatible bucket (passed in per session). See [Storage](#storage) above for lifecycle and durability semantics.
- Ships a **bundled chat UI** (built on [assistant-ui](https://github.com/assistant-ui/assistant-ui)) served on the same origin as the API. You embed it as an `<iframe>` — no separate UI to host, no asset pipeline on your side.
- Exposes a **minimal browser API** (consumed by the bundled UI): list/create/delete conversations, send messages. Streaming follows the assistant-ui native protocol (Vercel AI SDK data stream).
- **Isolates tenants** logically within a single process: mTLS at setup, JWT at chat time, per-session credentials in memory, per-tenant storage by configuration. For mutually hostile tenants, deploy one augchatd process per tenant.

## What augchatd does NOT do

- It does **not manage users**. Your software does, and tells augchatd who's connecting per session.
- It does **not enforce permissions**. Your software decides what each session can access (which MCP servers, which RAG indexes) and passes that as setup config.
- It does **not host MCP servers**. It's a *client* to MCP servers you operate.
- It does **not connect to MCP servers over stdio**. HTTP/SSE only — MCPs must be reachable over the network. Most public MCP servers today are stdio-only; to use them with augchatd, wrap them in a small HTTP/SSE bridge (e.g. `mcpo`) and point augchatd at the bridge's URL.
- It does **not ingest, chunk, or embed documents**. When RAG is enabled, augchatd only queries the backend (OpenSearch or pgvector) the session provides. Populate it with any pipeline you like; for OpenSearch we recommend [DigitalOcean Gradient AI Knowledge Bases](https://www.digitalocean.com/products/gradient), which crawls Spaces, S3, Dropbox, or URLs and writes to OpenSearch for you.
- It does **not store credentials at rest** beyond the lifetime of an active session.
- It does **not encrypt conversation history client-side** before writing to S3. Configure server-side encryption (SSE-S3, SSE-KMS, or equivalent) on the bucket you provide. Client-side encryption is out of scope.
- It does **not implement long-term memory or planning agents**. It's a tool-use loop, not an autonomous agent framework.
- It does **not bill or meter LLM usage**. Your customer's LLM key is charged directly by the provider.
- It does **not enforce per-tenant rate limits**. If you need throttling, do it at your edge before minting the session.
- It does **not ship observability dashboards or metrics out of the box**. Logs go to stderr; wire your own collector.
- It does **not provide content moderation or PII redaction**. If you need either, run them at your edge or as an MCP tool.

## UI integration

augchatd bundles a chat UI (built on [assistant-ui](https://github.com/assistant-ui/assistant-ui)) and serves it on the same origin as its API. The daemon is a single binary that serves both — there is no separate UI to host, deploy, or version.

The flow:

1. Your backend calls `POST /sessions` on your augchatd to mint a short-lived JWT.
2. Your application loads `https://augchatd.your-infra/` in an `<iframe>`.
3. Your application passes the JWT to the iframe via `postMessage` once it signals readiness.
4. The iframe talks to augchatd on its own origin and streams the conversation.

The bundled UI is the supported frontend. The browser-facing JWT API is the contract between the bundled UI and the backend — not a public surface for custom clients.

## Why these constraints

augchatd is opinionated about staying small. Your software already knows which OAuth tokens belong to which user, and which RAG indexes a given session is allowed to touch — and rebuilding that knowledge inside a chat backend (token vault, per-request MCP router, query scoper, OAuth refresh, audit) is weeks of work that's easy to get wrong in a way that leaks across tenants. augchatd takes that decision as input at session setup and enforces it server-side, for every message. The browser never holds any of it; the chat backend never needs to know your user model.

## Status

Early. OSS, currently maintained by a single author. The API and storage layout may change before `1.0`. The `augchatd/augchatd` Docker image referenced in Quickstart is **planned but not yet published**.

Built with Bun, Hono, and TypeScript. LLM access goes through the Vercel AI SDK (provider-agnostic: Anthropic, OpenAI, and others). When RAG is enabled, retrieval runs against OpenSearch (hybrid BM25 + kNN, native) or pgvector (vector-only out of the box; BYO `tsvector` for lexical).

## License

MIT.
