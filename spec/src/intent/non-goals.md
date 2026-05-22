---
id: intent-non-goals
type: intent
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "What augchatd does NOT do"
---

# Non-goals

augchatd deliberately does not implement:

| Non-goal | Where it lives instead |
| --- | --- |
| User management | The integrator's existing app |
| Permission enforcement (which MCPs/indexes a user may touch) | The integrator decides per session at setup time |
| Hosting MCP servers | augchatd is a *client* to MCP servers the integrator (or third parties) operate |
| Stdio transport for MCP | HTTP/SSE only; wrap stdio MCPs with a bridge such as `mcpo` |
| Document ingestion / chunking / embedding for RAG | An external pipeline; integrator's choice (README suggests DigitalOcean Gradient AI for OpenSearch) |
| Persistent credential storage | Credentials live in memory for the session's lifetime only |
| Client-side encryption of conversation history before write to S3 | Configure server-side encryption (SSE-S3, SSE-KMS, or equivalent) on the customer bucket |
| Long-term memory or planning-agent loops | Out of scope; augchatd is a tool-use loop, not an agent framework |
| LLM billing or metering | The customer's LLM key is billed directly by the provider |
| Per-tenant rate limiting | Throttle at the edge before minting the session |
| Observability dashboards / metrics out-of-the-box | Logs go to stderr; wire your own collector |
| Content moderation or PII redaction | Run at the integrator's edge or as an MCP tool |

Each non-goal is a deliberate boundary that keeps the daemon small and keeps the integrator's existing systems authoritative.
