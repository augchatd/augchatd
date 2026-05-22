---
id: req-005-tenant-isolation
type: requirement
status: proposed
capability: cap-isolation
evidence:
  - source: README.md@e562b2b
    section: "What augchatd does (Isolates tenants) / Storage"
links:
  - relation: supports
    target: req-001-per-user-credentials
  - relation: supports
    target: req-003-server-side-secrets
---

# Req 005 — Logical tenant isolation in a single process

## Statement

augchatd provides *logical* isolation of tenants inside a single process:

- mTLS identifies the tenant at session setup.
- JWT authenticates at chat time, bound to a single session.
- Per-session credentials live in memory, scoped to that session.
- Hot storage is partitioned by `(mTLS tenant, user)` — one SQLite DB per tenant-user pair, organized as `data/<tenantId>/<userId>.sqlite`. The per-user partition avoids write contention between concurrent users of the same tenant; the per-tenant directory groups them for tenancy clarity.

For tenants that are **mutually hostile**, the supported deployment is one augchatd process per tenant.

## Why

A single process means a single OS-level attack surface; the trust boundary is the process. Logical isolation is sufficient between tenants who already trust each other not to attack via memory bugs (the common B2B SaaS case). When the threat model includes other tenants, the only honest answer is process separation.

## How it is observed

- A concurrent test of two mTLS tenants confirms that session memory and hot DB rows for one are not reachable from request handlers serving the other (logical, code-path-level).
- Per-tenant hot DB exists as a separate file/connection.
- Documentation makes the hostile-tenant case explicit; no marketing claim of process-level isolation.

## Acceptance

Spec, README, and any docs must state the "one process per hostile tenant" rule. Tests must show per-tenant DB separation.
