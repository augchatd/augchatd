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

Durability rules:

- augchatd tests S3 at session creation; setup **fails** if it can't write (see [session-create](session-create.md)).
- If a later flush **fails**, the session keeps running and augchatd **retries until persistence succeeds**.
- **Hot data is not dropped until cold has it.**
- On resume, if the conversation is no longer hot, augchatd **hydrates from S3**.

## Observable outcomes

- After session disconnect, a write to S3 happens; the corresponding hot row is removed only after the write returns success.
- A simulated S3 outage after disconnect leaves the hot row in place; the session is reported as still flushing.
- On resume after a successful flush + cache eviction, the conversation is loaded from S3 transparently.
- 5 minutes of inactivity on a live session triggers a flush; subsequent activity hydrates if hot was already released.

## Non-promises

- augchatd does not client-side-encrypt before writing. Operators must configure SSE-S3/SSE-KMS on the bucket.
- augchatd does not back up across regions; that is the bucket's job.
- augchatd does not vacuum/compact cold data.

## Tests this contract implies

- Disconnect → S3 write captured.
- 5-minute idle (or test-accelerated equivalent) → flush captured.
- S3 mock returns failure → hot DB row remains; retry recorded; session not lost.
- Hot eviction + resume → hydration from S3 visible in retrieved messages.
