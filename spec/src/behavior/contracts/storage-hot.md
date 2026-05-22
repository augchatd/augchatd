---
id: contract-storage-hot
type: behavior-contract
status: proposed
capability: cap-storage
evidence:
  - source: README.md@e562b2b
    section: "Storage / Status (Bun embedded SQLite)"
  - source: README.md
    section: "Storage (per-user layout)"
links:
  - relation: satisfies
    target: req-004-tier-stored-history
  - relation: depends_on
    target: contract-session-create
  - relation: enables
    target: contract-storage-flush
---

# Contract — Hot storage (embedded SQLite, one DB per (tenant, user))

## Promise

While any session for a given (tenant, user) is live, that user's conversation state lives in an **internal SQLite database** managed by augchatd, using Bun's embedded SQLite.

- Layout on disk: `data/<tenantId>/<userId>.sqlite` — one file per `(tenantId, userId)` pair.
- The file is created when the first session for that user (under that tenant) connects.
- **Lifecycle (hard rule):** the file lives while **any** session for `(tenantId, userId)` is alive. It is closed and deleted only after **all** sessions for that user have ended **and** the user's conversations have been flushed to cold (see [storage-flush](storage-flush.md)).
- A tenant folder with no remaining user files is removed.

This partitioning eliminates write contention between concurrent end users of the same tenant — each user has their own SQLite writer lock.

Each conversation in the file holds, alongside its messages, the **per-conversation connector active state** (a map `descriptive_id → active boolean`). See [contract-connector-toggle](connector-toggle.md) and [adr-0010](../../architecture/adrs/0010-unified-connector-model.md).

## Observable outcomes

- A live chat turn reads and writes through the hot DB.
- Two end users of the same tenant chatting concurrently write to two distinct SQLite files; neither blocks the other on a writer lock.
- Two mTLS tenants run under two distinct subdirectories (`data/<A>/...` vs `data/<B>/...`) with no shared files.
- A second session for the same `(tenant, user)` while the first is still alive **reuses** the existing file — it is not recreated.
- A session ending while another for the same user remains alive does **not** remove the file.
- Process restart preserves the hot DB (it is on disk, not memory-only).

## Canonical row, no per-session cache

A single conversation's per-connector active state (and the messages alongside it) lives in **one** row per `(cid, descriptive_id)` in the user's SQLite file. `PUT /conversations/:cid/connectors/:descriptive_id` writes to that canonical row; idle/disconnect flush reads the canonical row at flush time. Implementations MUST NOT carry a per-session in-memory cache of the active map that flush could write back over a recent `PUT`. This makes multi-device toggles (same user, two device sessions, one toggling while the other is about to flush) behave under the same last-write-wins rule as concurrent toggles on a single device.

## Hot-write failure surface

A hot SQLite write failure during a `PUT /conversations/:cid/connectors/:descriptive_id` or during a first-observation snapshot surfaces to the caller as `503` with `X-Augchatd-Reason: hot-write-failed`. No partial state is committed. This is distinct from the cold-flush stall (`X-Augchatd-Reason: flush-stalled`, see [storage-flush](storage-flush.md)) — they can co-occur on a degraded node but they have different causes and different retry strategies.

## Non-promises

- augchatd does not expose the SQLite files to integrators; they are internal.
- augchatd does not encrypt SQLite files at rest. (Disk encryption is the operator's concern.)
- augchatd does not run an external database; no Postgres/MySQL/Redis dependency.
- augchatd does not guarantee a maximum number of open file handles — operators size `ulimit -n` per their concurrency profile.

## Tests this contract implies

- A live read returns previously-written messages of the same session.
- A second end user (same tenant) writing concurrently does not block the first.
- A second mTLS tenant's chat does not appear in the first tenant's subdirectory.
- A user with two concurrent sessions: ending one session leaves the file in place; ending both (after flush) removes the file.
- After a forced flush + idle, the hot row for the flushed conversation is gone (cleaned up post-success) but the file persists as long as any session for that user lives.
- A tenant subdirectory becomes empty (no user files) and is removed.
