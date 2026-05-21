# augchatd

> Add chat with tools and RAG to your app in an afternoon. Your existing auth provisions each session. No keys in the browser.

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
    "tools":       { "rag": { "cluster": "https://your-opensearch/", "indexes": ["docs"] } },
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

The browser never sees the LLM key, the MCP credentials, the RAG cluster, or the storage credentials. Only your server-issued JWT, valid for minutes. The chat UI is bundled in the augchatd binary and served on the same origin as the API — built on [assistant-ui](https://github.com/assistant-ui/assistant-ui), shipped with the daemon, no separate UI to host.

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
                            mcp_servers, rag_cluster+creds,
                            s3_bucket+creds }
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

1. **Your backend → augchatd** (mTLS): "Create a session for `user_42` with these MCP servers, this OpenSearch cluster, this LLM and key, this S3 bucket for cold storage, this system prompt." augchatd returns a short-lived JWT.
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

- Runs the **tool-use loop** server-side, combining MCP tools, built-in tools (e.g. RAG retrieval), and the LLM response.
- Runs **hybrid retrieval** (BM25 + kNN) against your OpenSearch cluster, per-session and scoped to the indexes your software allows.
- Holds **per-session credentials** received from your software. Never persisted in plaintext logs, never sent to clients.
- **Tier-stores conversation history**: hot in an internal DB managed by augchatd (one DB per mTLS tenant, ephemeral), cold in your S3-compatible bucket (passed in per session). See [Storage](#storage) above for lifecycle and durability semantics.
- Ships a **bundled chat UI** (built on [assistant-ui](https://github.com/assistant-ui/assistant-ui)) served on the same origin as the API. You embed it as an `<iframe>` — no separate UI to host, no asset pipeline on your side.
- Exposes a **minimal browser API** (consumed by the bundled UI): list/create/delete conversations, send messages. Streaming follows the assistant-ui native protocol (Vercel AI SDK data stream).
- **Isolates tenants** logically within a single process: mTLS at setup, JWT at chat time, per-session credentials in memory, per-tenant storage by configuration. For mutually hostile tenants, deploy one augchatd process per tenant.

## What augchatd does NOT do

- It does **not manage users**. Your software does, and tells augchatd who's connecting per session.
- It does **not enforce permissions**. Your software decides what each session can access (which MCP servers, which RAG indexes) and passes that as setup config.
- It does **not host MCP servers**. It's a *client* to MCP servers you operate.
- It does **not connect to MCP servers over stdio**. HTTP/SSE only — MCPs must be reachable over the network.
- It does **not ingest, chunk, or embed documents**. It only queries the OpenSearch cluster. Populate the cluster with any pipeline you like; we recommend [DigitalOcean Gradient AI Knowledge Bases](https://www.digitalocean.com/products/gradient), which crawls Spaces, S3, Dropbox, or URLs and writes to OpenSearch for you.
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

augchatd is opinionated about staying small. Authentication, permissions, user management, and tenant onboarding are all things your software already does well. augchatd's job is the part your software *doesn't* want to own: streaming an LLM with tools and RAG, securely, in production.

## Status

Early. OSS, currently maintained by a single author. The API and storage layout may change before `1.0`. The `augchatd/augchatd` Docker image referenced in Quickstart is **planned but not yet published**.

Built with Bun, Hono, and TypeScript. LLM access goes through the Vercel AI SDK (provider-agnostic: Anthropic, OpenAI, and others). RAG runs on OpenSearch with hybrid search (BM25 + kNN).

## License

MIT.
