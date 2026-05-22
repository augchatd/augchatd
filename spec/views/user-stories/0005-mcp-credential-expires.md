---
id: story-0005-mcp-credential-expires
type: user-story
status: proposed
derived_from:
  - contract-jwt-refresh
  - contract-mcp-invocation
audience: "Integrator backend engineer"
---

# 0005 — An MCP credential expires; the same refresh path handles it

**As** the integrator's backend, with a token vault that issues and refreshes the end user's OAuth tokens,
**I want** augchatd to surface MCP-credential expiry the same way it surfaces JWT expiry,
**So that** I do not have to implement two refresh paths.

## Scenario

```
Given user_42's GitHub OAuth token has expired since session creation
 When the assistant tries to call the GitHub MCP during a chat turn
 Then the MCP returns 401 to augchatd
  And augchatd returns 401 to the iframe (the same status as a JWT-expiry)
  And the iframe runs the same recovery as in story 0004:
        ask integrator page → integrator backend re-mints the session
        with a freshly-refreshed GitHub token from our vault
  And the conversation resumes with the new credential
```

## Why this matters

augchatd holds no refresh logic of its own. The integrator's vault is the only source of truth for the end user's external credentials. One code path on the integrator side covers both kinds of expiry.
