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
  And my session was created with my GitHub MCP and the "engineering-docs" + "private-42" RAG indexes
 When I ask the chat to "find recent PRs against repo X and summarize them"
 Then the assistant calls the GitHub MCP with my OAuth token
  And the response streams back to my browser
  And the streamed indicators show "tool: github" but never my token or the MCP URL
```

## Scenario — two end users at the same time

```
Given user_42 and user_99 are in active concurrent sessions
  And user_42 can search ["engineering-docs", "private-42"]
  And user_99 can search ["sales-docs"]
 When both users ask "search for Q4 numbers"
 Then user_42's retrieval runs against engineering-docs + private-42
  And user_99's retrieval runs against sales-docs
  And neither user's results contain content the other user is allowed to see
```
