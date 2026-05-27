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

## Direction A — iframe → parent page

```
{ "type": "augchatd:ready" }
```

Posted by the bundled UI on boot to obtain the initial JWT AND on any subsequent `401` to obtain a fresh one. The parent responds with `augchatd:jwt` each time.

```
{ "type": "augchatd:route", "path": "/c/<conversation_id>" }
```

Posted whenever the iframe changes its internal route (e.g. when minting a fresh conversation). The parent SHOULD record the path in its own URL so a hard reload restores the iframe to the same route. How (pathname, fragment, query, none) is the parent's choice — the iframe does not care. The demo wrapper mirrors it into its pathname as `/demo<path>`.

## Direction B — parent page → iframe

```
{ "type": "augchatd:jwt", "jwt": "eyJ...", "theme": "light" }
```

Posted in response to each `augchatd:ready`. The `theme` field is OPTIONAL — `"light"` (default) or `"dark"`; the iframe applies it to its document root if present.

## Origin checking

- The iframe targets the parent's origin when sending `augchatd:ready` / `augchatd:route`.
- The parent **must** verify `event.origin` equals the augchatd origin before responding to `augchatd:ready`.
- The parent **must** target the augchatd origin when sending `augchatd:jwt`.
- The iframe **must** verify `event.origin` equals its expected parent origin before accepting `augchatd:jwt`.

(The README snippet demonstrates this on the integrator side via `if (e.origin !== 'https://augchatd.your-infra') return;`.)

> [!NOTE] Known gap — iframe-side origin discovery in production
> In demo, the parent and the iframe share the same origin (`http://localhost:<port>`), so the iframe's check reduces to `e.origin === window.location.origin` — correct. In production the parent is on the integrator's origin, which the iframe currently has no out-of-band way to learn. A mechanism (e.g. a query string on the iframe's `src`) needs to land before production handshake is wired. Tracked in augchatd/augchatd#5.

## Message contract

| Field | Type | Where | Meaning |
| --- | --- | --- | --- |
| `type` | string | all | `augchatd:ready`, `augchatd:jwt`, or `augchatd:route` |
| `jwt` | string | `augchatd:jwt` | opaque token |
| `theme` | `"light"` \| `"dark"` | `augchatd:jwt` (optional) | UI palette; absent ⇒ `"light"` |
| `path` | string | `augchatd:route` | the iframe's new internal path (e.g. `/c/<cid>`) |

## Related

- Behavior: [ui-handshake](../behavior/contracts/ui-handshake.md)
- Behavior: [jwt-refresh](../behavior/contracts/jwt-refresh.md)
