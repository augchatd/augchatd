---
id: story-0010-end-user-toggles-connector
type: user-story
status: proposed
derived_from:
  - contract-connector-toggle
  - technical-contract-http-get-connectors
  - technical-contract-http-put-connector-state
audience: "End user of the integrator's product"
---

# 0010 — End user enables/disables connectors mid-conversation

**As** an end user mid-chat,
**I want** to enable or disable individual knowledge bases and tools without leaving the conversation,
**So that** I can scope the assistant's next answer (e.g. "only the public knowledge base for this question", "no GitHub tools for this turn") without losing my chat history or starting a new session.

## Scenario — narrow the scope mid-conversation

```
Given my session was provisioned with three connectors:
        rag_public      (RAG, default_active: true)
        rag_internal    (RAG, default_active: true)
        mcp_github      (MCP, default_active: true)
  And I have been chatting normally
 When I open the connector panel in the bundled UI
  And I toggle rag_internal off
 Then the UI sends PUT /connectors/rag_internal { active: false }
  And the response is 200 with { ..., active: false }
 When I ask the next question
 Then the assistant only retrieves from rag_public (rag_internal is not exposed as a tool)
  And my chat history is intact (toggling does not affect storage)
```

## Scenario — re-enable a default-off connector

```
Given my session has a connector "tool_dangerous" with default_active: false
 When I open the connector panel
 Then I see tool_dangerous listed with active: false
 When I toggle it on (PUT /connectors/tool_dangerous { active: true })
 Then the response is 200 with active: true
  And the next chat turn exposes tool_dangerous's tool to the LLM
```

## Scenario — cannot add a connector the integrator did not provision

```
Given my session was provisioned with rag_public only
 When the UI attempts to toggle a connector "rag_secret" that is not in my session
 Then PUT /connectors/rag_secret returns 404
  And my session's connector list is unchanged
  And the rule holds: the end user can only narrow the integrator's resolved scope, never extend it
```

## Scenario — toggle during an in-flight chat turn

```
Given a chat turn is in progress and the LLM has already issued a tool call to rag_internal
 When I toggle rag_internal off mid-turn
 Then the in-flight call to rag_internal completes (not aborted)
  And the next chat turn observes rag_internal as inactive and does not expose it
```

## Scenario — credentials are never returned

```
When I GET /connectors
Then the response contains, per connector, exactly:
       descriptive_id, name, type, active
And it does NOT contain url, auth, cluster, indexes, bearer, api_key, or any other configuration field
```

## Why this matters

Sessions are provisioned once with a resolved scope (the integrator's policy decision), but conversations span turns and contexts. End users need fine control over which knowledge bases and tools are active per turn — without re-provisioning. The toggle preserves the integrator's resolved scope (only narrowing, never adding) while giving the end user the live knob they want. It is also a privacy lever: a user can search the public KB only for a sensitive question, without changing session state.
