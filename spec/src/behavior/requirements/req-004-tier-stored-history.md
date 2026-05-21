---
id: req-004-tier-stored-history
type: requirement
status: proposed
capability: cap-storage
evidence:
  - source: README.md@e562b2b
    section: "Storage / Token & credential refresh"
---

# Req 004 — Tier-stored conversation history

## Statement

Conversation history is kept hot in an embedded SQLite database managed by augchatd, and cold in an S3-compatible bucket supplied by the integrator per session.

Two non-negotiable properties:

1. **Hot is not dropped until cold has it.** A failed flush triggers retry; the session keeps running.
2. **Resume hydrates from cold** if the conversation is no longer hot.

## Why

The conversation must survive JWT expiry, process restarts (within the retention window), and brief network failures to S3, without losing data. The integrator should not have to operate a database to run augchatd, and should not be coerced into hosting hot storage either — embedded SQLite removes the operational tax, customer S3 removes the data-residency tax.

## How it is observed

- During a live session, messages are queryable from the hot DB.
- On disconnect, history is flushed to S3 and the hot DB row(s) for that conversation are released.
- On resume, if the conversation is not in hot, augchatd hydrates from S3 transparently.
- A simulated S3 failure mid-flush leaves the session running and re-attempts; the hot DB row is *not* deleted until a flush succeeds.

## Acceptance

Tests must cover: live read from hot, flush-on-disconnect, flush-on-5-minute-idle, hydrate-on-resume, retry-on-failed-flush.
