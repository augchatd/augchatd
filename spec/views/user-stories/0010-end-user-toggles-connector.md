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
  And the response is 204 No Content
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
 Then the response is 204 No Content
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

## Scenario — integrator changes scope between sessions

```
Given cid_A was created with mcp_github (default_active: true) and rag_internal (default_active: true)
  And both were snapshotted into cid_A's saved state as active: true at creation
  And I never explicitly toggled either
 When the backend later re-mints the session with:
       - mcp_github now default_active: FALSE  (still in scope; default changed)
       - rag_internal REMOVED from connectors[]
  And I reload cid_A
 Then GET /conversations/cid_A/connectors:
       shows mcp_github: active: true  (snapshot honored; default change does not retroactively shift)
       omits rag_internal             (out of scope; saved state permanently dropped)
 When the backend later re-mints again WITH rag_internal
  And I reload cid_A
 Then rag_internal reappears at its current default_active  (previously-saved flag is NOT restored)
 When I create a brand-new cid_B
 Then GET /conversations/cid_B/connectors snapshots the CURRENT defaults at creation
       — mcp_github becomes active: false  for cid_B (the new default)
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
