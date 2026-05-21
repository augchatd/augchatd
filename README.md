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
    "tools":       { "rag": { "cluster": "https://your-opensearch/", "indexes": ["docs"] } }
  }'
# → { "session_id": "...", "jwt": "eyJ...", "expires_at": "..." }
```

```html
<!-- In your app: embed augchatd's hosted UI, then hand it the JWT. -->
<iframe id="chat" src="https://chat-ui.augchatd.io/"></iframe>
<script>
  document.getElementById('chat').addEventListener('load', () => {
    document.getElementById('chat').contentWindow.postMessage(
      {
        type: 'augchatd:jwt',
        jwt: jwtFromYourBackend,
        backend_url: 'https://augchatd.your-infra'
      },
      'https://chat-ui.augchatd.io'
    );
  });
</script>
```

The browser never sees the LLM key, the MCP credentials, or the RAG endpoint. Only your server-issued JWT, valid for minutes. The chat UI itself is hosted by augchatd and built on [assistant-ui](https://github.com/assistant-ui/assistant-ui) — you embed it, you don't build or host it.

## Quick Start (demo mode)

Try augchatd end-to-end without standing up a control plane or mTLS infrastructure. Demo mode loads a single fixed session from environment variables at boot.

```bash
docker run -p 8080:8080 \
  -e AUGCHATD_MODE=demo \
  -e DEMO_MODEL_PROVIDER=anthropic \
  -e DEMO_MODEL_ID=claude-opus-4-7 \
  -e DEMO_MODEL_API_KEY=sk-ant-... \
  -e DEMO_SYSTEM_PROMPT="You are a helpful assistant." \
  augchatd/augchatd

open http://localhost:8080
```

Add `DEMO_MCP_SERVERS` and `DEMO_RAG_*` env vars to enable tools and retrieval. The demo image bundles a local copy of the chat UI on the same port (so you don't need to load the hosted one); the browser fetches a session JWT from `GET /demo/jwt`, then chats normally.

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
                            mcp_servers, rag_cluster+creds }
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
   │  augchatd hosted UI      │ ──────────────────► │         augchatd         │
   │  (assistant-ui, iframed  │ ◄── streamed reply ─│  (tool-use loop server)  │
   │   in your software)      │                     │                          │
   └──────────────────────────┘                     └──────────────────────────┘
                                                                │
                                                                ▼
                                                    ┌─────────────────────┐
                                                    │  LLM │ MCP │ RAG    │
                                                    │  (server-side only) │
                                                    └─────────────────────┘
```

**Two calls do everything:**

1. **Your backend → augchatd** (mTLS): "Create a session for `user_42` with these MCP servers, this OpenSearch cluster, this LLM and key, this system prompt." augchatd returns a short-lived JWT.
2. **Embedded UI → augchatd** (JWT): chat. augchatd loops between the LLM, MCP servers, and RAG endpoint server-side. The UI (assistant-ui, hosted by augchatd, embedded in your app via iframe) only sees the streamed reply and sanitized tool indicators.

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
- Stores **conversation history** (live + cold) so users can resume later
- Ships a **hosted chat UI** (built on [assistant-ui](https://github.com/assistant-ui/assistant-ui)) you embed via `<iframe>`. No frontend code, build pipeline, or asset hosting on your side.
- Exposes a **minimal browser API** (consumed by the hosted UI): list/create/delete conversations, send messages. Streaming follows the assistant-ui native protocol (Vercel AI SDK data stream).
- **Isolates tenants** via mTLS client certificate. Different deployments of your software (or different SaaS tenants) get cryptographic separation, no shared keys.

## What augchatd does NOT do

- It does **not manage users**. Your software does, and tells augchatd who's connecting per session.
- It does **not enforce permissions**. Your software decides what each session can access (which MCP servers, which RAG indexes) and passes that as setup config.
- It does **not host MCP servers**. It's a *client* to MCP servers you operate.
- It does **not ingest, chunk, or embed documents**. It only queries the OpenSearch cluster. Populate the cluster with any pipeline you like; we recommend [DigitalOcean Gradient AI Knowledge Bases](https://www.digitalocean.com/products/gradient), which crawls Spaces, S3, Dropbox, or URLs and writes to OpenSearch for you.
- It does **not store credentials at rest** beyond the lifetime of an active session.
- It does **not implement long-term memory or planning agents**. It's a tool-use loop, not an autonomous agent framework.

## UI integration

augchatd ships a hosted chat UI at `https://chat-ui.augchatd.io/`, built on [assistant-ui](https://github.com/assistant-ui/assistant-ui). You embed it as an `<iframe>` in your application — we host and version it, so there's no bundle to maintain, no asset hosting on your side, and no design system to keep in sync.

The flow:

1. Your backend calls `POST /sessions` on your augchatd backend to mint a short-lived JWT.
2. Your application loads `https://chat-ui.augchatd.io/` in an `<iframe>`.
3. Your application passes the JWT and your backend URL to the iframe via `postMessage` once it signals readiness.
4. The iframe connects to your augchatd backend over the JWT API and streams the conversation.

The hosted UI is the supported frontend. The browser-facing JWT API is the contract between the hosted UI and the backend — not a public surface for custom clients.

## Why these constraints

augchatd is opinionated about staying small. Authentication, permissions, user management, and tenant onboarding are all things your software already does well. augchatd's job is the part your software *doesn't* want to own: streaming an LLM with tools and RAG, securely, in production.

## Status

Early. The API and storage layout may change before `1.0`. Not yet published to a registry.

Built with Bun, Hono, and TypeScript. LLM access goes through the Vercel AI SDK (provider-agnostic: Anthropic, OpenAI, and others). RAG runs on OpenSearch with hybrid search (BM25 + kNN).

## License

MIT.
