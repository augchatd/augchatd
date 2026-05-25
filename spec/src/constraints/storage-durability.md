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

> [!WARNING] PENDING RECONCILIATION
> - **Detected**: 2026-05-25 by /code-changed (audit consolidation, augchatd/augchatd#9)
> - **Sources in conflict**: this constraint vs `src/` (zero references to `flush-stalled`; no read-only mode flag on `SessionRecord`; no retry / backoff path).
> - **Nature**: read-only mode is unreachable today because the flush whose stall would trigger it is itself unimplemented (see PENDING on [storage-flush](../behavior/contracts/storage-flush.md)). Every "hard rule" below ("hot is not dropped until cold has it", retry with exponential backoff, 15-min stall → 503 `X-Augchatd-Reason: flush-stalled`) is target state.
> - **Proposed direction**: ship cold flush first (issue #9 §C3), then the read-only state machine on top (#9 §C2). This block makes the prescriptive prose visibly not-yet-true.
> - **Decision owner**: project owner.

## Hard rules

- **Hot is not dropped until cold has it.** A flush failure does not delete the hot copy.
- **Setup fails if S3 is not writable.** No session is ever created against a bucket augchatd cannot write to.
- **Resume hydrates from cold** if hot has been released.

## Triggers

- **Flush** on: session disconnect, **or** 5 minutes of inactivity.
- **Hydrate** on: session resume when hot copy is gone.

## Retry policy

Failed flushes retry with **exponential backoff** (initial delay 1s, doubling, capped at 60s between attempts). Retries continue in the background while the session keeps running normally.

If no flush succeeds within the **stalled-flush threshold** (default **15 minutes** from the first failed attempt of the current flush attempt sequence), the session transitions to **read-only mode**:

- `POST /chat` returns `503 Service Unavailable` with header `X-Augchatd-Reason: flush-stalled`.
- `GET /conversations*` continues to work (reads are unaffected).
- Background flush attempts continue at the capped backoff schedule.
- On the **first successful flush** after the transition, the session automatically exits read-only mode and accepts chat messages again — no client action required beyond a retry.

**Hot data is still not dropped while in read-only mode.** The durability guarantee holds: hot is released only after a successful cold write.

The threshold and backoff parameters are daemon-wide configuration; per-session tuning is out of scope for now.

## What this does **not** guarantee

- **No cross-region replication.** That is the bucket's responsibility.
- **No backup.** That is the bucket's responsibility.
- **No client-side encryption.** Operator configures SSE-S3/SSE-KMS/etc on the bucket.
- **No corruption recovery beyond standard SQLite/S3 behavior.**

## Observability

Logs go to stderr; flush failures, retries, the read-only-mode transition, and the recovery event are all logged there. Operators wire collectors as they see fit (see [observability](observability.md)).

The **read-only-mode transition** is the event most worth alerting on — it means a tenant's bucket has been unreachable for an extended period. Recovery is also logged so operators can confirm the issue resolved.
