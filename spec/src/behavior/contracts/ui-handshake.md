---
id: contract-ui-handshake
type: behavior-contract
status: proposed
capability: cap-ui
evidence:
  - source: README.md@e562b2b
    section: "README header (iframe + postMessage example) / UI integration"
links:
  - relation: satisfies
    target: req-007-bundled-ui
  - relation: depends_on
    target: technical-contract-browser-postmessage
  - relation: enables
    target: contract-session-chat
---

# Contract — UI handshake (iframe ↔ integrator page)

## Promise

The bundled UI, loaded inside an `<iframe>` on the integrator's page, performs this handshake:

1. On boot, the iframe sends `postMessage({ type: 'augchatd:ready' }, integratorOrigin)` to its parent.
2. The integrator's page listens for that message, verifies the message's `origin` equals the augchatd origin, and replies with `postMessage({ type: 'augchatd:jwt', jwt }, augchatdOrigin)`.
3. The iframe accepts the JWT and uses it for all subsequent chat calls to the augchatd origin.

## Observable outcomes

- A page following the README's snippet completes the handshake without modification.
- The iframe ignores `augchatd:jwt` messages whose `origin` is not its own augchatd origin (and the integrator's snippet ignores `augchatd:ready` from any other origin).
- The JWT is never put in the iframe URL, in cookies, or in a query string.

## Non-promises

- The handshake does not negotiate auth scheme; the JWT is opaque to the integrator's page.
- The handshake does not establish a heartbeat; expiry handling is the [jwt-refresh](jwt-refresh.md) contract.
- The handshake is not a public API for custom UIs; the bundled UI is the only supported consumer (see [req-007](../requirements/req-007-bundled-ui.md)).

## Tests this contract implies

- Integration test of the iframe + parent-page snippet from the README.
- Cross-origin negative test: a message from the wrong origin is rejected.
- Custom-UI use is documented as unsupported.
