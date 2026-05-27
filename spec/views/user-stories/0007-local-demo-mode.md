---
id: story-0007-local-demo-mode
type: user-story
status: proposed
derived_from:
  - contract-demo-mode
  - technical-contract-http-post-demo-sessions
audience: "Developer evaluating augchatd"
---

# 0007 — Run augchatd end-to-end locally in a single docker command

**As** a developer trying augchatd for the first time,
**I want** to run a working chat from my laptop without standing up mTLS, a control plane, or a backend,
**So that** I can decide whether augchatd is the right shape for my project this afternoon.

## Scenario

```
Given I have docker installed
 When I copy local/demo_session.json.example to local/demo_session.json and edit it to include my model API key
  And I run:
        docker run -p 8080:8080 \
          -e AUGCHATD_MODE=demo \
          -v "$PWD/local/demo_session.json:/app/local/demo_session.json:ro" \
          augchatd/augchatd
  And I open http://localhost:8080
 Then the bundled UI loads
  And the UI shows a visible "Demo session — not authenticated" banner
  And the wrapper page mints a session via POST /demo/sessions
  And I can chat with the configured model
```

## Scenario — graduate to production

```
Given I have a working demo
 When I switch deployment to mTLS + my backend calling POST /sessions
 Then the same binary serves my production chat
  And the chat code path is identical
  And GET /demo/* is no longer exposed
  And GET /healthz reports "mode": "prod" (which my deploy gate can assert)
```

## Scenario — POST /sessions is refused in demo mode

```
Given augchatd is running with AUGCHATD_MODE=demo
 When something (a confused operator, a misrouted production caller, a probe) attempts POST /sessions
 Then augchatd returns 404
  And the only sessions that exist are the ones minted by POST /demo/sessions calls so far
  And no per-request provisioning happens
```

## Scenario — demo connectors via the session config

```
Given I want to try the demo with a knowledge base attached
 When I add a connector entry to local/demo_session.json:
        {
          "descriptive_id": "rag_public",
          "name": "Public docs",
          "type": "rag",
          "default_active": true,
          "backend": "opensearch",
          "cluster": "https://my-os/",
          "auth": { "bearer": "..." },
          "indexes": ["public"]
        }
  And restart the daemon
 Then the bundled UI shows the connector panel with rag_public listed (inside any conversation)
  And GET /conversations/:cid/connectors for a new conversation returns it with active: true
  And the assistant can retrieve from it
  And I can toggle it off via the UI to test the toggle flow
```

## Scenario — first run with no session config

```
Given I just cloned the repo
 When I run ./run-dev-local.sh
 Then the daemon refuses to boot
  And the error message says "Demo session config not found at local/demo_session.json"
  And the message includes the exact copy-paste command:
        cp local/demo_session.json.example local/demo_session.json
  And it points me at the README field-by-field walkthrough
```

## Why this matters

The two-mode design lets evaluation cost stay low without splitting the chat code path or shipping a separate artifact. The demo serves as a continuous smoke test for the production path.
