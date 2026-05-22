---
id: adr-0007-bun-hono-typescript
type: adr
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "Status"
---

# ADR 0007 — Stack: Bun + Hono + TypeScript

## Context

augchatd needs:

- a fast HTTP framework
- embedded SQLite without an external dependency
- one-binary deployment
- TypeScript ergonomics for the tool-use loop

## Decision

- Runtime: **Bun**
- HTTP framework: **Hono**
- Language: **TypeScript**
- Hot storage: Bun's **embedded SQLite** (`bun:sqlite`)

## Consequences

- Single-binary deploys (bun bundle output) — no system Node, no native add-on build chain.
- Embedded SQLite ships with Bun → no separate driver, no separate process.
- Hono runs natively on Bun and is small and middleware-light.
- Hiring profile: TypeScript backend dev with Bun familiarity (still a smaller pool than Node, but growing).

## Alternatives considered

- **Node + Express/Fastify** — workable, but loses the embedded-SQLite-out-of-the-box advantage and the single-binary deploy story.
- **Go** — single-binary deploys come for free, but loses the assistant-ui / Vercel AI SDK TypeScript ergonomics.
