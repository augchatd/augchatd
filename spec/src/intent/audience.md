---
id: intent-audience
type: intent
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "The problem augchatd solves / Why these constraints"
---

# Audience

## Primary

Backend engineers at **B2B SaaS** companies whose product already has:

- a user identity system
- per-user external credentials (typically OAuth tokens for tools like GitHub, Slack, Linear)
- access policy (which user can see which data / use which tools)

…and who want to add LLM chat that:

- speaks to each user's own tools and data
- ships without giving the browser any LLM key, MCP credential, or RAG cluster address
- does not require rebuilding the user model inside a new chat backend

## Secondary

- Operators who run a single-tenant deployment in **demo mode** for local testing or public demos.
- Authors of MCP servers who want a remote, multi-tenant client they can target without writing the credential-routing layer themselves.

## Not the audience

- End users of the chat. augchatd has no opinion on them; they are owned by the integrator's product.
- Teams looking for an autonomous-agent framework, long-term memory, or planning loops.
- Teams that need a hosted multi-tenant SaaS chat product (augchatd is a self-hosted daemon).
