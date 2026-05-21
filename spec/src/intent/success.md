---
id: intent-success
type: intent
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "The problem augchatd solves / Stop / Start / What augchatd does"
---

# Success

augchatd is successful when an integrator can:

1. **Provision a chat session** from their backend with one mTLS-protected HTTP call that hands over `user_id`, `system_prompt`, `model + key`, optional `mcp_servers`, optional `rag` backend, and an S3 bucket for cold storage — and receive a short-lived JWT in return.
2. **Embed the bundled UI** as a single `<iframe>` and hand it the JWT via `postMessage`, with no separate frontend to host or deploy.
3. **Trust that every message** routes the user's own MCP credentials and stays inside the RAG indexes that session is allowed to see — without writing the routing or scoping logic themselves.
4. **Ship a PoC the same afternoon**, then graduate to production by switching `AUGCHATD_MODE` from `demo` to the mTLS-served `POST /sessions` flow — same binary, same contract.

## Observable signals of success

- The browser never holds: LLM key, MCP credential, RAG cluster URL, or S3 credential.
- An MCP credential expiring mid-conversation reuses the same refresh path as JWT expiry (one mechanism for both).
- A `flush` failure to S3 does not drop hot data — the session keeps running and augchatd retries.
- Two concurrent sessions for different users never see each other's credentials.

## Anti-success

- Integrator finds they still need to write a token vault, MCP router, or query scoper themselves.
- Browser bundle contains any LLM, MCP, RAG, or storage credential.
- A failed cold-storage write silently loses conversation state.
