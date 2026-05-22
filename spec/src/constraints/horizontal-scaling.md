---
id: constraint-horizontal-scaling
type: constraint
status: proposed
evidence:
  - source: README.md
    section: "Status (scaling note)"
links:
  - relation: constrains
    target: contract-session-create
  - relation: constrains
    target: contract-session-chat
  - relation: supports
    target: req-005-tenant-isolation
---

# Constraint — Horizontal scaling

## Why this constraint exists

augchatd has two pieces of **per-process state** that prevent stateless horizontal scaling for a single mTLS tenant:

1. **Session registry in memory** — JWT validation is signature-only (see [adr-0005](../architecture/adrs/0005-jwt-signature-only.md)), but the session record (LLM key, MCP credentials, RAG scope) lives in the **memory of the process that minted the session**.
2. **Hot SQLite on local disk** — see [adr-0002](../architecture/adrs/0002-embedded-sqlite-per-mtls-tenant.md). A different process does not see another process's hot files.

A request bearing a valid JWT that lands on a process which did not mint that session returns **401** — the receiving process has no in-memory record to authorize against.

## Supported topology (today)

| Deployment | Supported? |
| --- | --- |
| One augchatd process per mTLS tenant | **Yes — the recommended model.** |
| Multiple augchatd processes for one mTLS tenant, behind a **sticky-by-`session_id`** load balancer | Yes, with the operator owning routing correctness. |
| Multiple augchatd processes for one mTLS tenant, behind a **round-robin / least-connection** load balancer | **No.** Sessions become unreachable on the wrong process. |
| One augchatd process serving many mTLS tenants | Yes, subject to the same in-process constraints; for mutually hostile tenants, see [tenant-isolation](tenant-isolation.md). |

## What integrators must not assume

- That augchatd processes share state. They do not.
- That a process crash can be recovered by a peer process picking up the session. It cannot — the in-memory session registry dies with the process; the affected conversations resume only after the integrator re-mints sessions (hot data may also be lost for unflushed conversations on the crashed process; cold survives in the integrator's S3).
- That horizontal scaling is "add more processes". It is not, today.

## Future direction

Multi-process operation for a single mTLS tenant would require:

1. A shared session registry (a Redis-class store replacing the in-memory map), **and**
2. A shared or sharded hot-storage model (networked DB, or sticky-by-user with cross-process visibility).

This is **not committed**; it trades augchatd's "zero ops tax" promise for the ability to scale a single tenant across machines. Tracked as a product signal in [pressure-horizontal-scaling-for-large-tenants](../pressure/horizontal-scaling-for-large-tenants.md). Build only when a real customer needs it.

## Messaging rule

The README and any operator-facing doc must state, plainly, that the default deployment is **one process per mTLS tenant** and that horizontal scaling requires sticky routing. Silence on this point would be an integrator footgun.
