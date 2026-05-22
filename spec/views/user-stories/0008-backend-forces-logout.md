---
id: story-0008-backend-forces-logout
type: user-story
status: proposed
derived_from:
  - contract-session-delete
  - technical-contract-http-delete-sessions
audience: "Integrator backend engineer / security operator"
---

# 0008 — Backend forcibly ends a session before the JWT expires

**As** the integrator's backend, holding the policy that decides when a user must lose access,
**I want** to invalidate a live augchatd session immediately on demand,
**So that** I do not have to wait out the JWT TTL when an account is suspended, a token is rotated, or the user signs out everywhere.

## Scenario — user signs out

```
Given user_42 has an active augchatd session (session_id = "sess_abc")
  And user_42 signs out of our app
 When our backend calls DELETE /sessions/sess_abc over mTLS
 Then augchatd flushes any unflushed conversation state to user_42's S3 bucket
  And augchatd releases the in-memory session record
  And augchatd responds 204 No Content
 When the iframe (still open in another tab) sends its next chat message with the now-deleted JWT
 Then augchatd returns 401
  And the iframe takes the standard refresh path (asks our backend for a fresh JWT)
  And our backend refuses to mint a new session because the user is signed out
```

## Scenario — account suspended mid-conversation

```
Given user_42 is mid-chat and our policy flags the account for suspension
 When our backend calls DELETE /sessions/sess_abc
 Then augchatd flushes the conversation to cold storage
  And subsequent chat from that JWT returns 401 even if ttl_seconds has not elapsed
  And the conversation history remains in our S3 bucket (we choose what to do with it next)
```

## Scenario — deleting an unknown session is harmless

```
Given the session_id we hold is stale (already expired or never existed)
 When we DELETE that session_id
 Then augchatd responds 404
  And no other session is affected
  And retrying the delete remains 404 (idempotent)
```

## Why this matters

JWT validation is signature-only, so by default a revoked session keeps working until its TTL elapses. For policy events that must take effect immediately (suspension, sign-out, forced refresh after credential rotation), the integrator needs a synchronous lever. `DELETE /sessions/:id` is that lever, and it cooperates with cold storage so the conversation survives even when the session does not.

Note: deleting a session drops the in-memory **session-level connector registry** (the resolved scope), but the per-conversation **active flags** ride on the conversation itself — they are flushed to cold storage before the session releases (see [contract-storage-flush](../../src/behavior/contracts/storage-flush.md)) and are restored when a new session loads the same conversation (see [contract-connector-toggle](../../src/behavior/contracts/connector-toggle.md)). Re-minting the session does not reset end-user toggle preferences for existing conversations; brand-new conversations created afterward start at `default_active`.
