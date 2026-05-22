---
id: story-0006-conversation-survives-flush
type: user-story
status: proposed
derived_from:
  - contract-storage-hot
  - contract-storage-flush
audience: "Integrator operator"
---

# 0006 — A conversation survives a flush + resume without loss

**As** an operator running augchatd,
**I want** conversation state to survive idle-flushes, disconnects, and transient S3 failures,
**So that** end users do not see lost messages and I do not have to operate a separate database.

## Scenario — idle flush then resume

```
Given user_42's session has been idle for 5 minutes
 When the idle threshold trips
 Then augchatd flushes the conversation to user_42's session's S3 bucket
  And the hot SQLite row is released only after the S3 write succeeds
 When user_42 opens the chat again (the integrator re-mints the session)
 Then augchatd hydrates the conversation from S3
  And user_42 sees the full prior history
```

## Scenario — transient S3 failure

```
Given a flush is attempted
 When S3 returns an error
 Then augchatd retains the hot copy
  And retries the flush with exponential backoff
  And the session continues serving messages
  And nothing is dropped until the retry succeeds
```

## Scenario — sustained S3 outage triggers read-only mode

```
Given the bucket has been unreachable past the stalled-flush threshold (default ~15 minutes)
 When the end user tries to send a chat message
 Then POST /chat returns 503 with header X-Augchatd-Reason: flush-stalled
  And GET /conversations and GET /conversations/:id keep working (reads are unaffected)
  And the hot copy remains intact (nothing is dropped)
 When the bucket recovers
  And the next background flush attempt succeeds
 Then the session auto-recovers (no client-side reconfiguration)
  And the next POST /chat is accepted normally
```

## Why this matters

This is the "you do not need to operate a database" promise. Hot SQLite is internal; cold S3 is the integrator's; augchatd glues them with a durability rule (hot is not dropped until cold has it). The read-only fallback bounds the retry behavior — instead of retrying forever silently, the system surfaces the stall to the operator and the user, while still preserving data.
