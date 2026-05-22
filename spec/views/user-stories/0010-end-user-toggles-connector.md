---
id: story-0010-end-user-toggles-connector
type: user-story
status: proposed
derived_from:
  - contract-connector-toggle
  - technical-contract-http-get-conversation-connectors
  - technical-contract-http-put-conversation-connector-state
audience: "End user of the integrator's product"
---

# 0010 — End user enables/disables connectors per conversation

**As** an end user,
**I want** to enable or disable individual knowledge bases and tools **for the conversation I am in**, with the choice surviving JWT refresh and being independent from my other conversations,
**So that** I can scope the assistant's next answer (e.g. "only the public knowledge base for this thread", "no GitHub tools for this conversation") without re-provisioning, without affecting other threads, and without losing my preference every time the JWT rotates.

## Scenario — narrow the scope in one conversation

```
Given my session was provisioned with three connectors:
        rag_public      (RAG, default_active: true)
        rag_internal    (RAG, default_active: true)
        mcp_github      (MCP, default_active: true)
  And I am in conversation cid_A
  And I have been chatting normally
 When I open the connector panel in the bundled UI
  And I toggle rag_internal off
 Then the UI sends PUT /conversations/cid_A/connectors/rag_internal { active: false }
  And the response is 200 with { ..., active: false }
 When I ask the next question in cid_A
 Then the assistant only retrieves from rag_public (rag_internal is not exposed)
  And my chat history is intact (toggling does not affect storage)
```

## Scenario — conversations are independent

```
Given my session has rag_public, rag_internal, mcp_github (all default_active: true)
  And I toggled rag_internal off in cid_A
 When I open cid_B (a different conversation)
  And I call GET /conversations/cid_B/connectors
 Then rag_internal shows active: true for cid_B
 When I send a chat to cid_B
 Then rag_internal IS exposed as a tool for cid_B
```

## Scenario — preference survives JWT refresh

```
Given I am in cid_A and toggled rag_internal off
 When my JWT expires
  And the iframe takes the refresh path (story 0004): backend re-mints the session
 When I reload cid_A
  And I call GET /conversations/cid_A/connectors
 Then rag_internal still shows active: false
 When I chat to cid_A
 Then rag_internal is still NOT exposed
```

## Scenario — preference survives forced logout + re-mint

```
Given I have rag_internal off in cid_A and the backend forces DELETE /sessions/sess_X
 When the iframe gets 401 and asks the backend for a new session
  And the backend POSTs /sessions and we receive a new session_id
  And I reload cid_A
 Then GET /conversations/cid_A/connectors still shows rag_internal: active: false
```

## Scenario — re-enable a default-off connector for one conversation

```
Given my session has a connector "tool_dangerous" with default_active: false
 When I open cid_A and call GET /conversations/cid_A/connectors
 Then I see tool_dangerous listed with active: false
 When I toggle it on: PUT /conversations/cid_A/connectors/tool_dangerous { active: true }
 Then the response is 200 with active: true
  And the next chat turn in cid_A exposes tool_dangerous's tool
  And cid_B's tool_dangerous remains at active: false (independent)
```

## Scenario — cannot add a connector the integrator did not provision

```
Given my session was provisioned with rag_public only (no rag_secret)
 When the UI attempts PUT /conversations/cid_A/connectors/rag_secret { active: true }
 Then the response is 404
  And no conversation's state is changed
  And the rule holds: the end user can only narrow the integrator's resolved scope, never extend it
```

## Scenario — toggle during an in-flight chat turn

```
Given a chat turn is in progress for cid_A and the LLM has already issued a tool call to rag_internal
 When I toggle rag_internal off mid-turn
 Then the in-flight call to rag_internal completes (not aborted)
  And the next chat turn in cid_A observes rag_internal as inactive and does not expose it
```

## Scenario — integrator removed a connector between sessions

```
Given I previously toggled rag_internal off in cid_A
  And the backend now re-mints the session WITHOUT rag_internal in the connectors[] payload
 When I reload cid_A
 Then GET /conversations/cid_A/connectors omits rag_internal (not in scope)
  And the conversation's saved state for rag_internal is dropped
 When the backend later re-mints WITH rag_internal again
  And I reload cid_A
 Then GET /conversations/cid_A/connectors shows rag_internal at its current default_active
  (the previously-saved off-flag is NOT restored — out-of-scope means permanently dropped)
```

## Scenario — credentials are never returned

```
When I GET /conversations/cid_A/connectors
Then the response contains, per connector, exactly:
       descriptive_id, name, type, active

And it does NOT contain url, auth, cluster, indexes, bearer, api_key, or any other configuration field.
```

## Why this matters

Sessions are provisioned once with a resolved scope (the integrator's policy decision); conversations span turns, sessions, and contexts. Tying the active state to the conversation gives the end user fine control per thread, lets the preference survive every form of session re-mint, and keeps different threads independent — all without augchatd taking on any new persistence surface (the active set rides the existing conversation storage layer).
