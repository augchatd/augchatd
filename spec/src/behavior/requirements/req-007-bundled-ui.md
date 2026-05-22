---
id: req-007-bundled-ui
type: requirement
status: proposed
capability: cap-ui
evidence:
  - source: README.md@e562b2b
    section: "UI integration / What augchatd does (bundled chat UI)"
---

# Req 007 — Bundled, same-origin chat UI

## Statement

augchatd ships a chat UI built on [assistant-ui](https://github.com/assistant-ui/assistant-ui), compiled into the binary and served on the same origin as the JSON API.

The integrator embeds it as an `<iframe>`. Once the iframe signals readiness via `postMessage({type:'augchatd:ready'})`, the integrator's page replies with the JWT via `postMessage({type:'augchatd:jwt', jwt})`. The iframe then talks to augchatd on its own origin.

The browser-facing JWT API is the contract between the bundled UI and the backend — not a public surface for custom clients.

## Why

Most integrators do not want to host another frontend, ship another asset pipeline, or version another React app. Bundling the UI removes that burden, and serving same-origin means no CORS-related risk surface for the JWT API.

## How it is observed

- The augchatd binary serves `/` as the chat UI.
- An integrator embeds `<iframe src="https://augchatd.your-infra/">` and the handshake succeeds.
- The bundled UI is the only supported client of the JWT API.

## Acceptance

A working integrator example demonstrates the iframe + postMessage handshake. The README and spec both state that the JWT API is not a public surface for custom clients.
