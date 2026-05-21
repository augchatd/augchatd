---
id: constraint-storage-durability
type: constraint
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "Storage"
links:
  - relation: supports
    target: req-004-tier-stored-history
---

# Constraint — Storage durability

## Hard rules

- **Hot is not dropped until cold has it.** A flush failure does not delete the hot copy.
- **Setup fails if S3 is not writable.** No session is ever created against a bucket augchatd cannot write to.
- **Resume hydrates from cold** if hot has been released.

## Triggers

- **Flush** on: session disconnect, **or** 5 minutes of inactivity.
- **Hydrate** on: session resume when hot copy is gone.

## Retry policy

Failed flushes **retry indefinitely** while the session keeps running. The integrator's monitoring (logs to stderr) is the surface that reveals flush trouble; augchatd does not give up.

## What this does **not** guarantee

- **No cross-region replication.** That is the bucket's responsibility.
- **No backup.** That is the bucket's responsibility.
- **No client-side encryption.** Operator configures SSE-S3/SSE-KMS/etc on the bucket.
- **No corruption recovery beyond standard SQLite/S3 behavior.**

## Observability

Logs go to stderr; flush failures and retries are logged there. Operators wire collectors as they see fit (see [observability](observability.md)).
