---
id: adr-0009-react-vite-bundled-ui
type: adr
status: proposed
evidence:
  - source: README.md
    section: "Status (stack listing)"
links:
  - relation: supports
    target: req-007-bundled-ui
  - relation: refines
    target: adr-0001-single-binary-bundled-ui
---

# ADR 0009 — Bundled UI is a React SPA built with Vite, embedding assistant-ui, served as static assets

## Context

[ADR-0001](0001-single-binary-bundled-ui.md) commits augchatd to serving the chat UI from the same binary as the JSON API. The remaining question is the framework/tooling for the UI itself.

The constraints on that choice:

- The UI's central component is **assistant-ui** (React-based, [adr-0006](0006-vercel-ai-sdk-for-llm.md) — its stream protocol is the Vercel AI SDK data stream).
- The output must be **static assets** (HTML/CSS/JS) that the Hono server (running in Bun, [adr-0007](0007-bun-hono-typescript.md)) can serve from the same origin as the JSON API. Anything that requires a Node SSR runtime conflicts with the "single binary" promise.
- The UI is a logged-in SPA inside an iframe. There is **no SEO, no SSR, no server-side rendering need**.
- Build complexity should stay low; the UI is a feature, not a frontend product.
- Local iteration on the UI must remain ergonomic for a frontend developer.

## Decision

Build the bundled UI as a **React Single-Page Application using Vite**. The Vite build emits static HTML/CSS/JS, which is compiled into the augchatd binary and served from `/` by the same Hono process that serves the JSON API.

Routing inside the UI uses a small client-side library (e.g. `react-router`); there is no server-side routing.

## Consequences

- assistant-ui's React ergonomics carry without exotic adaptation.
- Vite's static output is exactly what the Hono static-file serving needs — no Node runtime ships in the binary.
- The UI is a single artifact alongside the backend; no separate `npm publish` lane, no separate version to coordinate.
- Frontend developers iterate locally with `vite dev` (HMR, fast); the binary serves the production build.
- Upgrading the UI ships in the same release as the backend.

## Alternatives considered

- **Next.js (`output: 'standalone'`)** — initially picked, but `standalone` mode produces a Node-runtime bundle expecting `node server.js`. Embedding that inside a Bun binary either requires running Node inside Bun (defeats single-binary) or doesn't actually use the standalone features. We do not need SSR, RSC, server actions, image optimization, or file-system server routing — all the things Next.js does that React-with-Vite does not. The mismatch between "Next.js standalone" semantics and "Bun-served static SPA" was the original decision error this ADR replaces.
- **Next.js (`output: 'export'`)** — would technically work (pure static export). Rejected for added build complexity over plain Vite for a SPA we don't need Next.js features for.
- **CRA (Create React App)** — deprecated upstream.
- **Webpack-direct or Rollup-direct** — Vite wraps these with sensible defaults; no benefit to going lower-level.
- **assistant-ui from a CDN via `<script>`** — would couple integrators to a CDN and defeat the single-binary-same-origin guarantee.

## Note on choice of routing / state libraries

This ADR commits to React + Vite + static output. It does **not** commit to specific choices of router, state management, or styling — those are implementation details inside the UI subproject. They will be recorded as comments in code when the UI is built.
