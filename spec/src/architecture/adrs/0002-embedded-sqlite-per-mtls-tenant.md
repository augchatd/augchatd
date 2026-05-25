---
id: adr-0002-embedded-sqlite-per-mtls-tenant
type: adr
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "Storage / Status"
  - source: README.md
    section: "Storage (per-user layout)"
links:
  - relation: supports
    target: req-004-tier-stored-history
  - relation: supports
    target: req-005-tenant-isolation
  - relation: constrains
    target: constraint-horizontal-scaling
---

# ADR 0002 — Hot storage is Bun's embedded SQLite, partitioned per (mTLS tenant, user)

> [!WARNING] PENDING RECONCILIATION
> - **Detected**: 2026-05-25 by /code-changed (audit consolidation, augchatd/augchatd#9)
> - **Sources in conflict**: this ADR's "lifecycle (hard rule)" vs `src/storage.ts:43-44, 91-128` (the `opened` map keeps each DB for the process lifetime; no session-refcount, no close, no tenant-folder GC). The on-disk layout matches; the lifecycle rule is the divergent part.
> - **Nature**: the layout (`<root>/<tenantId>/<userId>.sqlite`, WAL, one writer lock per user) is shipped. The lifecycle ("file closed and deleted only after all sessions ended AND the user's conversations flushed; tenant folder GC'd when empty") is target state. The corollaries — file disappears on no-active-sessions, tenant folder GC — are not exercised.
> - **Proposed direction**: ship session refcounting and the close-on-zero path alongside cold flush (issue #9 §C2-C4) — they share infrastructure. Until then the ADR's lifecycle paragraph is target state; the layout paragraph is current.
> - **Decision owner**: project owner.

## Context

augchatd needs hot conversation storage that:

- survives process restarts within a session's lifetime
- supports per-tenant partitioning
- avoids write contention between concurrent end users of the same tenant
- adds **zero operational tax** for the integrator (no Postgres, no Redis, no external cache to run)

SQLite uses a single-writer lock per database file (WAL helps with reader/writer concurrency but does not parallelize writers). A single SQLite file per tenant would serialize write activity from all of that tenant's concurrent end users — the practical throughput ceiling for any meaningfully-sized integrator.

## Decision

Use **Bun's embedded SQLite** as hot storage. Layout on disk:

```
data/
  <tenantId>/
    <userId>.sqlite     ← one database per (tenant, user)
```

`tenantId` is derived from the mTLS client cert (the integrator's identity). `userId` is the `user_id` field in the session setup payload (the integrator's identifier for the end user).

**Lifecycle (hard rule):**

> A `<tenantId>/<userId>.sqlite` file lives while **any** session for that `(tenantId, userId)` pair is alive. The file is closed and deleted only after **all** sessions for that user have ended **and** the user's conversations have been flushed to cold.

Corollaries:

- One session expiring does not destroy the user's DB if another session for the same user is still alive.
- A user with no active sessions and no unflushed conversations has no DB on disk.
- A tenant folder with no users is GC'd (the folder is empty → removed).

## Consequences

- **No write contention between concurrent users of the same tenant** — each user has their own SQLite file with its own writer lock.
- No external database to deploy, monitor, or back up — augchatd remains a single-binary deploy.
- Per-(tenant, user) DB makes partitioning visible at the filesystem level. Deleting a user's data is a file delete; deleting a tenant's data is a folder delete.
- **File-handle pressure**: an active augchatd with thousands of concurrent users will hold thousands of open SQLite handles. Operators must set `ulimit -n` accordingly (e.g. 65k for fleets of that size). Connection pool with idle close (open on demand, close after N seconds idle) bounds the steady-state count.
- For mutually hostile tenants, the trust boundary is still the process; isolation is logical, not at the OS level — operators in that case deploy one process per tenant (see [constraint-tenant-isolation](../../constraints/tenant-isolation.md)).
- Horizontal scaling for a single tenant is constrained — see [constraint-horizontal-scaling](../../constraints/horizontal-scaling.md).

## Alternatives considered

- **One DB per tenant (all users sharing)** — the earlier shape of this ADR. Rejected because SQLite serializes writes per file; concurrent end users of a busy tenant would queue behind each other on every chat message write.
- **External Postgres** — operational tax; redundant for the workload size.
- **Single shared SQLite DB** — would force per-row scope checks for tenancy and contend even harder than per-tenant; rejected for the same reasons as in the original ADR.
- **In-memory only** — loses survivability on process restart.
