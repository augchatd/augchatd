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
{ "jwt": "eyJ..." }
```

> [!NOTE] Assumption
> The README shows the bundled UI fetches a JWT from `GET /demo/jwt` in demo mode, but does not show the exact response shape. The shape above is assumed minimal; will be confirmed when code lands.

## Related

- Behavior: [demo-mode](../behavior/contracts/demo-mode.md)
- Browser handshake equivalent in production: [browser-postmessage](browser-postmessage.md)
