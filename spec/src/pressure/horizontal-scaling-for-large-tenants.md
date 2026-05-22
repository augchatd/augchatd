---
id: pressure-horizontal-scaling-for-large-tenants
type: pressure
status: open
category: opportunity
who: "Architectural review with the maintainer (2026-05-22)"
touches:
  - cap-session-mgmt
  - cap-storage
  - cap-isolation
related_contracts:
  - contract-session-create
  - contract-session-chat
  - contract-storage-hot
satisfied_by_current_behavior: false
evidence:
  - source: "this chat / architectural review 2026-05-22"
---

# Pressure — Horizontal scaling for large tenants

## Signal

A single augchatd process holds two pieces of state that prevent stateless horizontal scaling for a given mTLS tenant:

1. **In-memory session registry** — JWT validation is signature-only, but the session record (credentials, MCP scope, RAG scope, model+key) lives in process memory.
2. **Local hot SQLite** — conversation state during a session lives on the local disk of the process serving that session.

Result: a tenant whose load exceeds what one process can serve cannot be scaled by adding more augchatd processes behind a stateless load balancer. **Sticky routing keyed by `session_id` is the only multi-process option today.**

This is documented as [constraint-horizontal-scaling](../constraints/horizontal-scaling.md). The pressure here is the underlying *opportunity*: integrators with large tenants will eventually want to scale beyond one process.

## Why it matters

Early adopters won't hit this. A B2B SaaS with O(100) concurrent end-users per tenant per process is fine on default config. The pressure arises when:

- A single tenant has thousands of concurrent end-users on a single mTLS identity, **or**
- An operator wants rolling-deploy / blue-green for augchatd without disconnecting active sessions.

Both are realistic mid-stage operational needs.

## What would satisfy it

A **configurable mode**, off by default, where:

- Session registry is moved to a shared store (Redis or small Postgres) — pluggable
- Hot storage is moved to a shared backend (or augchatd accepts a sticky-routing requirement and operates fine on per-user-sharded local disks)

Critically: **stay zero-ops-by-default**. The configurable mode is opt-in for integrators who have outgrown the simple deployment.

## Why this is not in scope yet

- No real customer has asked.
- The default is sound for early-stage and small/medium tenants.
- Pluggable abstractions added prematurely calcify in shapes that don't fit real usage.

## Trigger to revisit

- First integrator request describing a tenant whose concurrent session count cannot be served by one process.
- Operator request for zero-downtime rolling deploys.

When either lands, move to a new ADR proposing the multi-process mode.
