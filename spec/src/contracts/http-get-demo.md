---
id: technical-contract-http-get-demo
type: technical-contract
status: current
evidence:
  - source: src/routes/demo-page.ts@ca3458a
    section: "DEMO_PAGE_HTML — the wrapper HTML + handshake script"
  - source: src/server.ts@ca3458a
    section: "GET /demo + GET /demo/* mounts (demo mode only)"
links:
  - relation: supports
    target: contract-demo-mode
  - relation: supports
    target: contract-ui-handshake
  - relation: supports
    target: technical-contract-http-post-demo-sessions
---

# Technical contract — `GET /demo` (wrapper page)

## Availability

**Only exposed when `AUGCHATD_MODE=demo`.** Absent (Hono default 404) in production.

## Auth

None. The wrapper is the page that *gets* the JWT (by POSTing `/demo/sessions` server-side) and forwards it to the iframe over `postMessage`; it cannot itself be JWT-protected.

## Request

- `GET /demo` — root form
- `GET /demo/` — same handler (trailing-slash form)
- `GET /demo/<anything>` — wildcard catch (e.g. `/demo/c/<conversation_id>`); same handler

The wildcard exists so a hard reload of `/demo/c/<conversation_id>` returns the wrapper page (which then asks the iframe to load `/c/<conversation_id>`), instead of falling through to a 404. The path *after* `/demo` is mirrored into the iframe's `src` — `/demo/c/abc` ⇒ iframe `src="/c/abc"`.

## Response — success

`200 OK`
`Content-Type: text/html; charset=UTF-8`

The body is a self-contained HTML document (no external assets) carrying an `<iframe>` plus an inline script that:

1. Computes the iframe's src from the parent path (strips the `/demo` prefix).
2. Listens for `augchatd:ready` messages from the iframe — see [contract-ui-handshake](../behavior/contracts/ui-handshake.md).
3. On each `augchatd:ready`, fetches `POST /demo/sessions` (no body) — see [http-post-demo-sessions](http-post-demo-sessions.md) — and forwards the JSON via `postMessage({type: "augchatd:jwt", jwt, theme}, origin)`.
4. On `augchatd:route` from the iframe, mirrors the iframe's internal path into `window.history.replaceState` under the `/demo` prefix.

Every `augchatd:ready` triggers a *fresh* session mint. This is the recovery path for an expired JWT: the iframe re-emits `augchatd:ready`, the wrapper mints a new session, posts the new JWT back. The wrapper is otherwise stateless across page lifetime.

On any error during the initial fetch (network failure, non-2xx from `/demo/sessions`), the wrapper replaces the iframe with a plain-text error block (`augchatd demo: …`) — this is the "demo failed to bootstrap" surface, not a contract for production integrators.

## Failure modes

- `404` (Hono default) if `AUGCHATD_MODE` is not `demo`.

There is no auth- or input-driven failure path; the page is static HTML.

## Non-promises

- The wrapper is **not** a public API for custom UIs. Its single job is to play the "integrator parent page" role for the demo, so the bundled UI handshake gets exercised end-to-end without standing up a real integrator. Production integrators write their own parent page following [contract-ui-handshake](../behavior/contracts/ui-handshake.md); they do not serve `/demo` themselves.
- The wrapper does not implement cross-origin parent-origin verification (it runs same-origin against the iframe). The cross-origin variant is the integrator's responsibility — see the Non-promises in [contract-ui-handshake](../behavior/contracts/ui-handshake.md).
- The wrapper does not persist anything across navigations; closing the tab loses the in-memory JWT — but the conversation state survives in hot SQLite and is re-hydrated on the next visit to `/demo/c/<cid>`.

## Related

- Behavior: [contract-demo-mode](../behavior/contracts/demo-mode.md)
- Behavior: [contract-ui-handshake](../behavior/contracts/ui-handshake.md)
- Sibling endpoint: [http-post-demo-sessions](http-post-demo-sessions.md)
- Browser API surface served at the same origin: [browser-streaming](browser-streaming.md)
