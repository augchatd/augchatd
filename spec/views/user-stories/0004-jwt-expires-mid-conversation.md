---
id: story-0004-jwt-expires-mid-conversation
type: user-story
status: proposed
derived_from:
  - contract-jwt-refresh
audience: "Integrator frontend + backend engineer"
---

# 0004 — JWT expires mid-conversation; conversation resumes seamlessly

**As** an end user mid-chat,
**I want** the conversation to continue if my short-lived token expires,
**So that** the security benefit of short expiry does not turn into a UX cost.

## Scenario

```
Given I have been chatting for several minutes
  And my JWT was issued with a short (minutes-long) lifetime
 When I send my next message after the JWT has expired
 Then augchatd returns 401
  And the iframe asks the integrator's page for a fresh JWT
  And the integrator's backend re-mints the session (POST /sessions with currently-valid credentials)
  And the iframe receives the new JWT (via postMessage)
  And the message I just sent is delivered
  And my full prior conversation is still visible (loaded from hot or cold storage)
```

## Why this matters

augchatd validates JWTs by signature only — no DB lookup per token. That choice trades long-lived tokens for short-lived ones, and this story is what makes short-lived tokens livable.
