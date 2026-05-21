---
id: story-0007-local-demo-mode
type: user-story
status: proposed
derived_from:
  - contract-demo-mode
  - technical-contract-http-get-demo-jwt
audience: "Developer evaluating augchatd"
---

# 0007 — Run augchatd end-to-end locally in a single docker command

**As** a developer trying augchatd for the first time,
**I want** to run a working chat from my laptop without standing up mTLS, a control plane, or a backend,
**So that** I can decide whether augchatd is the right shape for my project this afternoon.

## Scenario

```
Given I have docker installed
 When I run:
        docker run -p 8080:8080 \
          -e AUGCHATD_MODE=demo \
          -e DEMO_MODEL_PROVIDER=anthropic \
          -e DEMO_MODEL_ID=claude-opus-4-7 \
          -e DEMO_MODEL_API_KEY=sk-ant-... \
          -e DEMO_SYSTEM_PROMPT="You are a helpful assistant." \
          augchatd/augchatd
  And I open http://localhost:8080
 Then the bundled UI loads
  And it fetches a JWT from GET /demo/jwt
  And I can chat with the configured model
```

## Scenario — graduate to production

```
Given I have a working demo
 When I switch deployment to mTLS + my backend calling POST /sessions
 Then the same binary serves my production chat
  And the chat code path is identical
  And GET /demo/jwt is no longer exposed
```

## Why this matters

The two-mode design lets evaluation cost stay low without splitting the chat code path or shipping a separate artifact. The demo serves as a continuous smoke test for the production path.
