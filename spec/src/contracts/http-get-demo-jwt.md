---
id: technical-contract-http-get-demo-jwt
type: technical-contract
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "Quick Start (demo mode)"
links:
  - relation: supports
    target: contract-demo-mode
---

# Technical contract — `GET /demo/jwt`

## Availability

**Only exposed when `AUGCHATD_MODE=demo`.** Absent (or 404) in production mode.

## Auth

None. (Demo mode bypasses mTLS by design.)

## Request

`GET /demo/jwt`

## Response

`200 OK`
`Content-Type: application/json`

```json
{ "jwt": "eyJ...", "theme": "light" }
```

> [!IMPORTANT] PENDING RECONCILIATION
> The response also carries a `theme: "light" | "dark"` field (default
> `"light"`, configured via `DEMO_THEME`). The bundled UI applies the
> palette on first paint via `document.documentElement.setAttribute("data-theme", "dark")`
> (or no-attribute for light). Spec write-up tracked as item in
> augchatd/augchatd#5 ("Per-session UI theme"). The production equivalent
> will be a field on `POST /sessions` and ride the postMessage handshake;
> not in this commit.

## Related

- Behavior: [demo-mode](../behavior/contracts/demo-mode.md)
- Browser handshake equivalent in production: [browser-postmessage](browser-postmessage.md)
