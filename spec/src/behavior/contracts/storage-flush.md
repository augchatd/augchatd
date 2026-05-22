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

## Promise

A conversation is flushed from hot SQLite to the integrator's S3-compatible bucket on either trigger:

- **Session disconnect**
- **5 minutes of inactivity**

What flushes with the conversation:

- All messages, in order.
- The conversation's **per-connector active state** (see [contract-connector-toggle](connector-toggle.md), [adr-0010](../../architecture/adrs/0010-unified-connector-model.md)) — the user's per-conversation toggle preferences survive cold-storage round-trips, so resuming the conversation in a later session restores them.

What does **not** flush:

- The session's resolved-scope connector list (URLs, auth, indexes) — that belongs to the session, not the conversation, and is gone when the session ends.

Durability rules:

- augchatd tests S3 at session creation; setup **fails** if it can't write (see [session-create](session-create.md)).
- If a later flush **fails**, the session keeps running and augchatd **retries with exponential backoff** (see [storage-durability](../../constraints/storage-durability.md)).
- **Hot data is not dropped until cold has it.**
- After a stalled-flush threshold (default 15 minutes), the session enters **read-only mode** — `POST /chat` returns `503` with `X-Augchatd-Reason: flush-stalled`. Reads keep working; the session auto-recovers on the first successful flush.
- On resume, if the conversation is no longer hot, augchatd **hydrates from S3**.

## Observable outcomes

- After session disconnect, a write to S3 happens; the corresponding hot row is removed only after the write returns success.
- A simulated S3 outage after disconnect leaves the hot row in place; the session is reported as still flushing.
- A sustained S3 outage past the stalled-flush threshold transitions the session to read-only: `POST /chat` returns `503` (`X-Augchatd-Reason: flush-stalled`), `GET /conversations*` still works.
- On the first successful flush after a read-only transition, the next `POST /chat` succeeds without any client-side reconfiguration.
- On resume after a successful flush + cache eviction, the conversation is loaded from S3 transparently — both messages **and** the per-connector active state.
- A conversation that had `rag_internal: false` saved when it flushed is hydrated with `rag_internal: false`; the user does not have to retoggle after a session re-mint that hydrates from cold.
- 5 minutes of inactivity on a live session triggers a flush; subsequent activity hydrates if hot was already released.

## Non-promises

- augchatd does not client-side-encrypt before writing. Operators must configure SSE-S3/SSE-KMS on the bucket.
- augchatd does not back up across regions; that is the bucket's job.
- augchatd does not vacuum/compact cold data.

## Tests this contract implies

- Disconnect → S3 write captured.
- 5-minute idle (or test-accelerated equivalent) → flush captured.
- S3 mock returns failure → hot DB row remains; retry recorded; session not lost.
- S3 mock keeps failing past the stalled-flush threshold → next `POST /chat` returns 503 with `X-Augchatd-Reason: flush-stalled`; `GET /conversations*` still returns 200.
- After the simulated outage, the mocked S3 starts accepting writes → next flush succeeds → next `POST /chat` works without client-side intervention.
- Hot eviction + resume → hydration from S3 visible in retrieved messages **and** in the per-connector active state returned by `GET /conversations/:cid/connectors`.
