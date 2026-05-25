---
id: contract-storage-flush
type: behavior-contract
status: proposed
capability: cap-storage
evidence:
  - source: README.md@e562b2b
    section: "Storage"
links:
  - relation: satisfies
    target: req-004-tier-stored-history
  - relation: depends_on
    target: contract-storage-hot
  - relation: depends_on
    target: contract-session-create
---

# Contract — Flush to cold storage

> [!WARNING] PENDING RECONCILIATION
> - **Detected**: 2026-05-25 by /code-changed (audit consolidation, augchatd/augchatd#9)
> - **Sources in conflict**: this contract vs `src/storage.ts:18-22` (lists flush + multi-session lifecycle as "Still pending"), no `src/*flush*` module exists.
> - **Nature**: the contract reads prescriptive — disconnect + 5-min idle triggers, retry, hydration on resume — but nothing is wired. `SessionRecord.storage` is held opaquely; there is no flush scheduler, no idle timer, no S3 client, no hydration code path.
> - **Proposed direction**: ship the flush implementation (issue #9 §C2-C4). Until then this block makes the gap explicit so a reader doesn't infer working code from the prescriptive prose. The `Promise` and `Observable outcomes` sections describe the *intended* contract; treat both as target state.
> - **Decision owner**: project owner.

## Promise

A conversation is flushed from hot SQLite to the integrator's S3-compatible bucket on either trigger:

- **Session disconnect**
- **5 minutes of inactivity**

What flushes with the conversation:

- All messages, in order.
- The conversation's **per-connector active state** (see [contract-connector-toggle](connector-toggle.md), [adr-0010](../../architecture/adrs/0010-unified-connector-model.md)) — the user's per-conversation toggle preferences survive cold-storage round-trips, so resuming the conversation in a later session restores them.

What does **not** flush:

- The session's resolved-scope connector list (URLs, auth, indexes) — that belongs to the session, not the conversation, and is gone when the session ends.

Durability is owned by a separate constraint. This contract is responsible for **triggering** flush; [`storage-durability`](../../constraints/storage-durability.md) is canonical for **what happens when a flush fails or stalls** (exponential backoff, 15-min stalled-flush threshold, read-only mode, hot-not-dropped). Don't restate the rules here.

- augchatd tests S3 at session creation; setup **fails** if it can't write (see [session-create](session-create.md)).
- On resume, if the conversation is no longer hot, augchatd **hydrates from S3**.

## Observable outcomes

- After session disconnect, a write to S3 happens; the corresponding hot row is removed only after the write returns success.
- 5 minutes of inactivity on a live session triggers a flush; subsequent activity hydrates if hot was already released.
- On resume after a successful flush + cache eviction, the conversation is loaded from S3 transparently — both messages **and** the per-connector active state. A conversation that had `rag_internal: false` saved when it flushed is hydrated with `rag_internal: false`.

Failure-mode outcomes (retry, read-only transition, recovery) are observable through this contract but are spec'd in [`storage-durability`](../../constraints/storage-durability.md).

## Non-promises

- augchatd does not client-side-encrypt before writing. Operators must configure SSE-S3/SSE-KMS on the bucket.
- augchatd does not back up across regions; that is the bucket's job.
- augchatd does not vacuum/compact cold data.

## Tests this contract implies

- Disconnect → S3 write captured.
- 5-minute idle (or test-accelerated equivalent) → flush captured.
- Hot eviction + resume → hydration from S3 visible in retrieved messages **and** in the per-connector active state returned by `GET /conversations/:cid/connectors`.

(Failure/retry/read-only tests live with [`storage-durability`](../../constraints/storage-durability.md), which owns those rules.)
