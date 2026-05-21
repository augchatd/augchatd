---
id: constraint-tenant-isolation
type: constraint
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "What augchatd does (Isolates tenants)"
links:
  - relation: supports
    target: req-005-tenant-isolation
---

# Constraint — Tenant isolation

## Default posture: logical isolation in a single process

- mTLS identifies the tenant at setup.
- JWT authenticates per session at chat time.
- Per-session credentials and scope live in process memory, scoped to a single `session_id`.
- Hot storage is partitioned by mTLS tenant: **one SQLite DB per tenant**.

Trust boundary: the **process**.

## When this is enough

The common B2B SaaS case: tenants do not attack each other through memory bugs or via prompt-injection escalation into other tenants' data. Logical isolation is sufficient.

## When this is not enough

Mutually hostile tenants. Sharing a process means a memory-safety bug or escalation vector affects all tenants in that process.

**Supported deployment for hostile tenants: one augchatd process per tenant.**

## What integrators must not assume

- That augchatd performs OS-level sandboxing between sessions.
- That a compromise in one session leaves other sessions safe.
- That augchatd will detect tenant-on-tenant attack patterns. It does not.

## Marketing/messaging rule

The README and the spec must both state, plainly, that isolation is **logical** and that **process-per-tenant** is the answer for hostile-tenant scenarios.
