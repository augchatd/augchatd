---
id: adr-0006-vercel-ai-sdk-for-llm
type: adr
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "Status / What augchatd does (minimal browser API)"
links:
  - relation: supports
    target: contract-session-chat
  - relation: supports
    target: technical-contract-browser-streaming
---

# ADR 0006 — LLM access via the Vercel AI SDK

## Context

augchatd must support multiple LLM providers (Anthropic, OpenAI, others) and stream replies to the bundled UI in a format the bundled UI already understands. The bundled UI is built on assistant-ui, whose native stream protocol is the Vercel AI SDK data stream.

## Decision

Use the **Vercel AI SDK** as the LLM access layer. Provider plug-ins (Anthropic, OpenAI, …) are selected per session by the `model.provider` field in the setup payload.

## Consequences

- Provider-agnostic without bespoke client code per provider.
- The streamed reply format is already what assistant-ui consumes — no protocol translation.
- The SDK's retry / abort semantics are inherited; augchatd does not re-implement them.
- Adding a new provider is "pick the right Vercel provider package" plus a `provider` value, not a parallel integration.

## Alternatives considered

- **Per-provider direct integration** — multiplies code and surface area; reinvents streaming.
- **A house abstraction layer** — duplicates what the Vercel AI SDK already does without the assistant-ui native protocol benefit.
