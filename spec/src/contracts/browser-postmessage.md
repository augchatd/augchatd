---
id: technical-contract-browser-postmessage
type: technical-contract
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "README header (iframe snippet) / UI integration"
links:
  - relation: supports
    target: contract-ui-handshake
---

# Technical contract — Browser `postMessage` handshake

## Direction A — iframe → integrator page

```
{ "type": "augchatd:ready" }
```

Posted once when the bundled UI has booted.

## Direction B — integrator page → iframe

```
{ "type": "augchatd:jwt", "jwt": "eyJ..." }
```

Posted in response to `augchatd:ready`.

## Origin checking

- The iframe targets the integrator's origin (its parent's origin) when sending `augchatd:ready`.
- The integrator's page **must** verify `event.origin` equals the augchatd origin before responding.
- The integrator's page **must** target the augchatd origin when sending `augchatd:jwt`.
- The iframe **must** verify `event.origin` equals its own integrator-page origin before accepting `augchatd:jwt`.

(The README snippet demonstrates this on the integrator side via `if (e.origin !== 'https://augchatd.your-infra') return;`.)

## Message contract

| Field | Type | Meaning |
| --- | --- | --- |
| `type` | string | `augchatd:ready` or `augchatd:jwt` |
| `jwt` | string | only on `augchatd:jwt`; opaque token |

> [!NOTE] Assumption
> The README does not show a refresh message type. The presumed re-handshake on JWT expiry is "iframe reloads or re-emits `augchatd:ready`, parent re-supplies a fresh JWT". To be confirmed when code lands; if a distinct refresh message type is needed it goes here.

## Related

- Behavior: [ui-handshake](../behavior/contracts/ui-handshake.md)
- Behavior: [jwt-refresh](../behavior/contracts/jwt-refresh.md)
