---
id: intent-problem
type: intent
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "The problem augchatd solves"
---

# Problem

In a B2B SaaS, different end users get different tools, different data, and sometimes different LLM tiers. Building chat with the Vercel AI SDK (or any LLM library) directly forces the integrator to hand-roll four things, any of which can leak credentials or data across users:

1. A **token vault** so each user's GitHub/Slack/Linear OAuth tokens are stored and routed only to *their* MCP calls.
2. A **per-request MCP router** that picks the right credentials for the user behind the current message.
3. A **RAG query scoper** that constrains every retrieval to the indexes that user is allowed to see, *before* the LLM has a chance to ask for the wrong one.
4. An **OAuth refresh layer** that renews tokens before they expire mid-conversation.

Each of these is weeks of work and easy to get wrong in a way that leaks across tenants.

## What makes this hard to own in-house

- Per-user credentials must reach the LLM/tool loop without ever reaching the browser.
- Scoping must apply *before* the LLM forms a query, not as a post-filter.
- The auth system that already knows which user has which credentials lives in the customer's main app, not in the chat service.
- Iteration on the chat surface gets coupled to the main app's release cycle.

## Scope of this problem statement

This describes the integrator-facing problem augchatd intends to absorb. It is not a description of end-user pain (which belongs in [pressure/](../pressure/) once captured).
