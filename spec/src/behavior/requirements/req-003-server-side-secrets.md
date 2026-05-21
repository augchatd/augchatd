---
id: req-003-server-side-secrets
type: requirement
status: proposed
capability: cap-session-mgmt
evidence:
  - source: README.md@e562b2b
    section: "README header / What augchatd does / Stop / Start"
links:
  - relation: supports
    target: req-001-per-user-credentials
  - relation: supports
    target: req-005-tenant-isolation
---

# Req 003 — Server-side-only secrets

## Statement

The following secrets must never appear in any payload sent to the browser, in any bundle served to the browser, or in any persisted log line:

- LLM API key
- MCP server credentials
- RAG cluster URL and credentials
- S3 cold-storage credentials

The browser holds exactly **one** secret: the short-lived JWT.

## Why

A leaked LLM key bills the integrator's account directly. A leaked MCP token gives an attacker the end user's GitHub/Slack/Linear access. The RAG cluster URL alone tells an attacker where the data lives.

## How it is observed

- Network inspection of the chat session shows only JWTs and message payloads — no provider keys, no MCP credentials.
- The bundled UI's JavaScript source contains no LLM/MCP/RAG/S3 secret material.
- Process logs at any level redact (or never include) the above secrets.

## Acceptance

A network capture of a complete chat session contains no provider key. Static inspection of the served UI bundle finds no secret material. Log inspection over a full session and shutdown finds no plaintext secret.
