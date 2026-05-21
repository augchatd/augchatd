---
id: contract-storage-hot
type: behavior-contract
status: proposed
capability: cap-storage
evidence:
  - source: README.md@e562b2b
    section: "Storage / Status (Bun embedded SQLite)"
links:
  - relation: satisfies
    target: req-004-tier-stored-history
  - relation: depends_on
    target: contract-session-create
  - relation: enables
    target: contract-storage-flush
---

# Contract — Hot storage (embedded SQLite per mTLS tenant)

## Promise

While a session is live, its conversation state lives in an **internal SQLite database** managed by augchatd, using Bun's embedded SQLite.

- One database per **mTLS tenant identifier**.
- The database is created when the first session for that tenant connects.
- It is destroyed only after a *successful flush to cold* (see [storage-flush](storage-flush.md)).

## Observable outcomes

- A live chat turn reads and writes through the hot DB.
- Two mTLS tenants run with two distinct SQLite databases (separate files/connections).
- Process restart preserves the hot DB (it is on disk, not memory-only).

## Non-promises

- augchatd does not expose the SQLite file to integrators; it is internal.
- augchatd does not encrypt the SQLite file at rest. (Disk encryption is the operator's concern.)
- augchatd does not run an external database; no Postgres/MySQL/Redis dependency.

## Tests this contract implies

- A live read returns previously-written messages of the same session.
- A second mTLS tenant's chat does not appear in the first tenant's DB.
- After a forced flush + idle, the hot DB row for the flushed conversation is gone (cleaned up post-success).
