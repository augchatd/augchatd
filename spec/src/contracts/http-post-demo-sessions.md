---
id: technical-contract-http-post-demo-sessions
type: technical-contract
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "Quick Start (demo mode)"
links:
  - relation: supports
    target: contract-demo-mode
---

# Technical contract — `POST /demo/sessions`

## Availability

**Only exposed when `AUGCHATD_MODE=demo`.** Absent (404) in production.

## Auth

None. (Demo mode bypasses mTLS by design.)

## Request

`POST /demo/sessions`

No body. The session config is loaded once at boot from a JSON file on disk (`local/demo_session.json` by default; see [contract-demo-mode](../behavior/contracts/demo-mode.md)). The file shape mirrors the production `POST /sessions` body.

## Response — success

`200 OK`
`Content-Type: application/json`

```json
{
  "session_id": "8c4b6a48-...",
  "jwt": "eyJ...",
  "expires_at": "2026-05-24T13:21:07.000Z",
  "theme": "light"
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `session_id` | string (UUID) | New per call |
| `jwt` | string | Signed JWT; lifetime = `DEMO_TTL_SECONDS` (default 60s) |
| `expires_at` | string (ISO 8601) | When the JWT expires |
| `theme` | `"light"` \| `"dark"` | From the session JSON (default `"light"`) |

Same shape as the [`POST /sessions`](http-post-sessions.md) response, plus the `theme` field so the demo wrapper can forward it through the [postMessage handshake](browser-postmessage.md) to the iframe.

Each call creates a **new** `session_id` (UUID) and a **new** `SessionRecord` in the in-memory registry. All such sessions share the single `(tenant="demo", user="demo")` hot SQLite — multiple browser tabs each get their own session and their conversations co-mingle in the same per-user store (mirroring what production does for two concurrent sessions of the same user).

## Failure modes

- `404 Not Found` if `AUGCHATD_MODE` is not `demo`.
- `5xx` on internal failure (JWT mint, registry write, etc.).

## Related

- Behavior: [demo-mode](../behavior/contracts/demo-mode.md)
- Production analogue: [http-post-sessions](http-post-sessions.md)
- Handshake that consumes this: [browser-postmessage](browser-postmessage.md)
