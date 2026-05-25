---
id: adr-0011-tolerate-reasoning-model-stream-gaps
type: adr
status: proposed
evidence:
  - source: src/index.ts
    section: "Bun.serve default export — idleTimeout"
links:
  - relation: supports
    target: contract-session-chat
  - relation: supports
    target: technical-contract-browser-streaming
---

# ADR 0011 — Tolerate long silent gaps inside a chat stream

## Context

Bun's HTTP server (`Bun.serve`) drops any connection the server has not written to in **10 seconds** by default. The mechanism is fine for typical HTTP traffic: most responses are either fast or stream continuously.

The chat endpoint is neither. A `POST /chat` is a Server-Sent Events stream that runs through a server-side tool-use loop, and **reasoning models (gpt-5-mini, the OpenAI o-series, Claude reasoning variants, …) routinely go silent for 12–30 seconds between tool-call rounds while they reason internally**. During those gaps the response body is open and the writer is alive, but no SSE frames flow. The default 10 s idle window is shorter than a normal reasoning gap, so Bun closes the socket mid-stream. The AI SDK keeps writing into the closed connection — the trace records a clean `response.finish`, but the browser sees `ERR_INCOMPLETE_CHUNKED_ENCODING` and the response never lands in the UI.

The symptom (chat "stops responding" even though the trace shows a complete reply) is silent and hard to attribute — operators saw a 401 in the console and chased the JWT-refresh path instead.

## Decision

Set `idleTimeout: 255` (Bun's documented maximum) on the default export in `src/index.ts`. The chat workload is the bottleneck — any other endpoint returns in well under 255 s — so this is a single tunable that fixes the whole class of bugs without per-route plumbing.

## Consequences

- Reasoning models with long silent gaps between tool calls now stream end-to-end. Verified: same `curl` repro that returned 388 bytes (truncated) before the change returns 119 KB (the full reply) after.
- Slow / hung clients can hold a connection open for up to 4 minutes before Bun reaps it. Acceptable for this workload (chat with tool-use loops, single-tenant demo / mTLS-gated production); not acceptable for a public unauthenticated API.
- Any future endpoint that has its own reasonable max-latency assumption (e.g. websocket-shaped, long-poll, batch) should set a per-request budget via `server.timeout(req, …)` rather than relying on this default.

## Alternatives considered

- **Keep Bun's 10 s default** — surfaces as the bug above on every chat that triggers reasoning. Not viable while the chat capability lists reasoning models as a supported choice.
- **Emit a keep-alive comment (`: keepalive\n\n`) from the chat handler during silent gaps** — would also work, and would be more proxy-friendly behind load balancers with their own short idle timeouts. Heavier to implement (wrap the AI SDK's writer, time the gaps) and only needed once a real proxy enters the picture. Punted until the production deployment story specifies a proxy. Worth revisiting then.
- **Per-request `server.timeout(req, 0)` in the chat handler** — selective and the most principled answer. Currently blocked by surface: the `server` reference is not threaded into Hono handlers in our setup, so wiring it adds a small framework dance for one call site. The global tunable above is sufficient until the proxy story forces the keep-alive variant.
