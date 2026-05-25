---
id: adr-0003-customer-provided-cold-storage
type: adr
status: proposed
evidence:
  - source: README.md@e562b2b
    section: "Storage / What augchatd does NOT do (client-side encryption)"
links:
  - relation: supports
    target: req-004-tier-stored-history
---

# ADR 0003 — Cold storage is the integrator's S3-compatible bucket

> [!WARNING] PENDING RECONCILIATION
> - **Detected**: 2026-05-25 by /code-changed (audit consolidation, augchatd/augchatd#9)
> - **Sources in conflict**: this ADR's "tests writability / flushes / retries / hydrates" decision vs `src/storage.ts:18` (lists flush + hydration as pending); `SessionRecord.storage` is held as opaque `Record<string, unknown>` in `src/session-registry.ts:30` with no S3 client code anywhere.
> - **Nature**: the **shape** decision — credentials live in the session payload as `storage.s3 = { endpoint, region, bucket, prefix?, access_key_id, secret_access_key }`, demo config mirrors the same shape — is shipped. The **operational** half (writability probe, flush triggers, retry, hydration, hot-not-dropped guarantee) is not. The decision predates the working code.
> - **Proposed direction**: ship the operational layer (issue #9 §C2-C4 + [storage-flush PENDING block](../../behavior/contracts/storage-flush.md)). The ADR's shape paragraph is current; the operational paragraph is target state. Remove this block when both halves match.
> - **Decision owner**: project owner.

## Context

Long-term durability of conversations should live where the integrator's data already lives, both for compliance/data-residency reasons and to avoid augchatd taking custody of long-lived data.

## Decision

Each session declares its **S3-compatible bucket and credentials** in the setup payload. augchatd:

- **Tests writability** at session creation; setup fails if it can't write.
- **Flushes** on disconnect or 5-minute idle.
- **Retries** failed flushes; does **not** drop hot data until cold confirms.
- **Hydrates** from S3 on resume when hot is gone.
- Does **not client-side-encrypt**; integrators configure SSE-S3, SSE-KMS, or equivalent on the bucket.

## Consequences

- Data residency stays with the integrator. augchatd never owns long-lived conversation data.
- The integrator chooses encryption posture via standard S3 features.
- "S3-compatible" admits AWS S3, MinIO, Cloudflare R2, Backblaze B2, DigitalOcean Spaces, etc.
- Setup-time S3 check fails fast — no session is created against a bucket that cannot accept writes.

## Alternatives considered

- **augchatd-hosted cold storage** — would couple data residency, billing, and trust to augchatd; out of project scope.
- **Client-side encryption** — would require key management augchatd does not own; out of scope.
