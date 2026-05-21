---
id: story-0002-browser-loads-chat
type: user-story
status: proposed
derived_from:
  - contract-ui-handshake
  - technical-contract-browser-postmessage
audience: "Integrator frontend engineer"
---

# 0002 — Browser loads the chat UI and receives the JWT

**As** the integrator's web app,
**I want** to embed augchatd's bundled UI and hand it the JWT my backend already minted,
**So that** I do not have to host or version a chat frontend myself, and the JWT never lands in a cookie or query string.

## Scenario — handshake completes

```
Given we have already obtained { jwt } from our backend (see 0001)
 When we render <iframe src="https://augchatd.your-infra/"></iframe>
  And we listen for postMessage with type "augchatd:ready"
 Then the iframe sends us { type: "augchatd:ready" } from origin https://augchatd.your-infra
 When we reply with postMessage({ type: "augchatd:jwt", jwt }, "https://augchatd.your-infra")
 Then the iframe accepts the JWT
  And uses it for all subsequent chat requests
```

## Scenario — origin mismatch is rejected

```
Given we render the augchatd iframe
 When a postMessage with type "augchatd:jwt" arrives from a different origin
 Then the iframe ignores it (does not store or use the jwt)
```
