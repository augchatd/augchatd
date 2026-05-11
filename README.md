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
    "tools":       { "rag": { "endpoint": "https://your-search/", "indexes": ["docs"] } }
  }'
# → { "session_id": "...", "jwt": "eyJ...", "expires_at": "..." }
```

```html
<!-- In your app: drop the JWT into an iframe, done. -->
<iframe id="chat" src="https://chat-ui.your-infra/"></iframe>
<script>
  document.getElementById('chat').addEventListener('load', () => {
    document.getElementById('chat').contentWindow.postMessage(
      { type: 'augchatd:jwt', jwt: jwtFromYourBackend },
      'https://chat-ui.your-infra'
    );
  });
</script>
```

The browser never sees the LLM key, the MCP credentials, or the RAG endpoint. Only your server-issued JWT, valid for minutes.

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

Add `DEMO_MCP_SERVERS` and `DEMO_RAG_*` env vars to enable tools and retrieval. The browser fetches a session JWT from `GET /demo/jwt`, then chats normally.

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
                            mcp_servers, rag_endpoint+creds }
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
   │  Your software's UI      │ ──────────────────► │         augchatd         │
   │  (browser / iframe)      │ ◄── streamed reply ─│  (tool-use loop server)  │
   └──────────────────────────┘                     └──────────────────────────┘
                                                                │
                                                                ▼
                                                    ┌─────────────────────┐
                                                    │  LLM │ MCP │ RAG    │
                                                    │  (server-side only) │
                                                    └─────────────────────┘
```

**Two calls do everything:**

1. **Your backend → augchatd** (mTLS): "Create a session for `user_42` with these MCP servers, this RAG endpoint, this LLM and key, this system prompt." augchatd returns a short-lived JWT.
2. **Browser → augchatd** (JWT): chat. augchatd loops between the LLM, MCP servers, and RAG endpoint server-side. Browser only sees the streamed reply and sanitized tool indicators.

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

- Runs the **tool-use loop** (LLM ↔ MCP tool calls ↔ RAG queries) server-side
- Holds **per-session credentials** received from your software. Never persisted in plaintext logs, never sent to clients.
- Stores **conversation history** (live + cold) so users can resume later
- Exposes a **minimal browser API**: list/create/delete conversations, send messages
- **Isolates tenants** via mTLS client certificate. Different deployments of your software (or different SaaS tenants) get cryptographic separation, no shared keys.

## What augchatd does NOT do

- It does **not manage users**. Your software does, and tells augchatd who's connecting per session.
- It does **not enforce permissions**. Your software decides what each session can access (which MCP servers, which RAG indexes) and passes that as setup config.
- It does **not host MCP servers**. It's a *client* to MCP servers you operate.
- It does **not ship a chat UI**. See [UI integration](#ui-integration) below for the recommended path.
- It does **not store credentials at rest** beyond the lifetime of an active session.
- It does **not implement long-term memory or planning agents**. It's a tool-use loop, not an autonomous agent framework.

## UI integration

augchatd exposes a JWT-authenticated streaming chat API. **You can use any frontend** that streams tokens and renders tool calls; augchatd doesn't care.

We recommend [assistant-ui](https://github.com/assistant-ui/assistant-ui) as the reference UI library: it handles streaming, tool-call rendering, conversation lists, and markdown out of the box.

**For the fastest path to a working PoC**, embed the chat as an `<iframe>` inside your application:

1. Your backend calls `POST /sessions` on augchatd to mint a short-lived JWT.
2. Your application loads the chat UI in an `<iframe>`.
3. Your application passes the JWT to the iframe via `postMessage` once it signals readiness.

This gets you a working chat in hours, with no changes to your app's framework, bundle, or build pipeline. And it isn't just a stepping stone: many integrations stay on the iframe path indefinitely. If you ever need more control, the same API supports native integrations too.

## Why these constraints

augchatd is opinionated about staying small. Authentication, permissions, user management, and tenant onboarding are all things your software already does well. augchatd's job is the part your software *doesn't* want to own: streaming an LLM with tools and RAG, securely, in production.

## Status

Early. The API and storage layout may change before `1.0`. Not yet published to a registry.

## License

MIT.
