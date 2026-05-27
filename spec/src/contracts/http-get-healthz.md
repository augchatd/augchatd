---
id: technical-contract-http-get-healthz
type: technical-contract
status: proposed
evidence:
  - source: README.md
    section: "Quick Start (demo mode) — healthz paragraph"
links:
  - relation: supports
    target: contract-demo-mode
---

# Technical contract — `GET /healthz`

## Availability

Exposed on the same origin as the JSON API in **both** modes (`demo` and production). No `AUGCHATD_MODE` gating — unlike the `GET /demo/*` and `POST /demo/sessions` surfaces, which are demo-only.

## Auth

None. Healthz is a public probe.

## Request

`GET /healthz`

## Response

`200 OK`
`Content-Type: application/json`

```json
{
  "mode": "demo",
  "status": "ok"
}
```

or

```json
{
  "mode": "prod",
  "status": "ok"
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `mode` | `"demo"` \| `"prod"` | The boot mode of the running process |
| `status` | `"ok"` | Aliveness indicator (more values may be defined later — operators should accept any string and treat anything other than `"ok"` as not-healthy) |

## Why `mode` is the safety surface

A deploy of augchatd into production with `AUGCHATD_MODE=demo` still set is a real failure mode (bypasses mTLS, single-tenant, credentials loaded from a file on disk instead of an mTLS-authenticated session payload). The `mode` field is the gate operators put in their deployment pipeline: a production health check that returns `"mode": "demo"` must fail the deploy.

## Failure modes

- `5xx` from a process that is alive but failing internally (definition deferred to code; not yet observable beyond "process up").
- Connection refused: process not running.

## Tests this contract implies

- Boot with `AUGCHATD_MODE=demo` → `GET /healthz` returns `"mode": "demo"`.
- Boot without `AUGCHATD_MODE` (or with any non-demo value) → `GET /healthz` returns `"mode": "prod"`.
- Endpoint requires no client cert in either mode.

## Related

- Behavior: [demo-mode](../behavior/contracts/demo-mode.md)
