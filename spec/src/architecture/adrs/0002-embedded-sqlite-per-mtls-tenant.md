---
id: adr-0002-embedded-sqlite-per-mtls-tenant
type: adr
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "Storage / Status"
links:
  - relation: supports
    target: req-004-tier-stored-history
  - relation: supports
    target: req-005-tenant-isolation
---

# ADR 0002 — Hot storage is Bun's embedded SQLite, one DB per mTLS tenant

## Context

augchatd needs hot conversation storage that:

- survives process restarts within a session's lifetime
- supports per-tenant partitioning
- adds **zero operational tax** for the integrator (no Postgres, no Redis, no external cache to run)

## Decision

Use **Bun's embedded SQLite** as hot storage. Create **one database per mTLS tenant identifier** on the first session for that tenant. Destroy a tenant's database only after a successful flush to cold (S3).

## Consequences

- No external database to deploy, monitor, or back up — augchatd is truly a single-binary deploy.
- Per-tenant DB makes partitioning visible at the filesystem level.
- SQLite scales well for the per-session, append-mostly workload typical of a chat tool-use loop.
- For mutually hostile tenants, the trust boundary is still the process; isolation is logical, not at the OS level — operators in that case deploy one process per tenant.

## Alternatives considered

- **External Postgres** — operational tax; redundant for the workload size.
- **Single shared SQLite DB** — would force per-row scope checks for tenancy; per-DB partitioning is simpler and harder to get wrong.
- **In-memory only** — loses survivability on process restart.
