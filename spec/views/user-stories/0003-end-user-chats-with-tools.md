---
id: story-0003-end-user-chats-with-tools
type: user-story
status: proposed
derived_from:
  - contract-session-chat
  - contract-mcp-invocation
  - contract-rag-query
audience: "Integrator product owner"
---

# 0003 — End user chats and the assistant uses their own tools and data

**As** an end user of the integrator's product,
**I want** the assistant to use my GitHub, my Slack, and my private documents,
**So that** the help I get is grounded in my real context — and never bleeds into another user's.

## Scenario — single end user

```
Given I am user_42
  And my session was provisioned with two active connectors:
        mcp_github (MCP, my OAuth token)
        rag_engineering (RAG, indexes: ["engineering-docs", "private-42"])
 When I ask the chat to "find recent PRs against repo X and summarize them"
 Then the assistant calls the mcp_github connector with my OAuth token
  And the response streams back to my browser
  And the streamed indicators show "tool: mcp_github" (its descriptive_id / name) but never my token or the upstream URL
```

## Scenario — two end users at the same time

```
Given user_42 and user_99 are in active concurrent sessions
  And user_42's session has a rag connector with indexes ["engineering-docs", "private-42"]
  And user_99's session has a rag connector with indexes ["sales-docs"]
 When both users ask "search for Q4 numbers"
 Then user_42's retrieval runs against engineering-docs + private-42 via user_42's connector
  And user_99's retrieval runs against sales-docs via user_99's connector
  And neither user's results contain content the other user is allowed to see
```
