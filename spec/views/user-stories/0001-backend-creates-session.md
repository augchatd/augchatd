---
id: story-0001-backend-creates-session
type: user-story
status: proposed
derived_from:
  - contract-session-create
audience: "Integrator backend engineer"
---

# 0001 — Backend creates a session for the current user

**As** the integrator's backend, holding the current end user's identity and external credentials,
**I want** to provision a chat session in one mTLS call,
**So that** the browser can chat with augchatd without ever seeing any credential except a short-lived JWT.

## Scenario — happy path

```
Given an authenticated end user "user_42" in our app
  And we hold their GitHub OAuth token in our vault
  And we have a shared LLM key to use
  And we have an S3 bucket configured for chat history
 When our backend posts to augchatd /sessions over mTLS with
       { user_id: "user_42",
         system_prompt: "You are a helpful assistant.",
         model:   { provider: "anthropic", model_id: "...", api_key: "..." },
         mcp_servers: [{ url: "https://github-mcp/", auth: { bearer: "<user_42-token>" } }],
         tools:   { rag: { backend: "opensearch", cluster: "...", indexes: ["docs"] } },
         storage: { s3: "s3://.../bucket/" } }
 Then we receive { session_id, jwt, expires_at }
  And nothing else has happened on user_42's behalf yet (no LLM call, no MCP call)
```

## Scenario — S3 is not writable

```
Given the bucket credentials are wrong
 When our backend posts to augchatd /sessions
 Then we receive a 4xx
  And no session_id has been created (a retry will not return the same one)
```

## Scenario — only the minimum

```
Given we want a chat with no tools and no RAG
 When our backend posts with just { user_id, system_prompt, model, storage.s3 }
 Then we receive a working session
  And no MCP servers or RAG indexes are exposed to that session
```

## Scenario — production TTL

```
Given we are running in production and want fewer JWT refresh round-trips
 When our backend posts with ttl_seconds: 1800 (30 minutes)
 Then we receive { session_id, jwt, expires_at } where expires_at is ~30 minutes in the future
  And the iframe will not need to refresh until that window elapses
```

## Scenario — default TTL is dev-friendly

```
Given we do not set ttl_seconds
 When our backend posts to augchatd /sessions
 Then we receive a JWT whose lifetime is 60 seconds (the default)
  And during development the integrator's refresh path is exercised every minute
```
