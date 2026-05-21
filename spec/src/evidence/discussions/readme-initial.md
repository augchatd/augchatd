---
id: evidence-readme-initial
type: evidence
status: current
source_kind: discussion
---

# Evidence — Initial README

## Source

- **File**: `README.md`
- **Commit**: `e562b2b` (titled "Initial readme (#1)")
- **PR**: #1

This is the **only** primary source for every claim in the spec at this point. The whole README is treated as a single prescriptive design document.

## What it covers

- Product framing and problem statement
- The session-setup payload shape (curl example)
- The iframe + `postMessage` handshake (HTML/JS example)
- Two-call mental model (setup + chat) and the ASCII flow diagram
- Token & credential refresh path
- Storage (hot SQLite, cold S3, flush triggers, durability)
- "What augchatd does" / "does NOT do" lists
- UI integration
- Status (pre-1.0, Bun + Hono + TS, image not yet published)

## What it does **not** cover (current evidence gaps)

- Exact paths/verbs of the browser-facing chat API
- pgvector connection-string shape in the setup payload
- Log line format (only "to stderr" is asserted)
- Refresh `postMessage` type, if distinct from re-handshake
- JWT format (signature algorithm, claims)
- Exact env-var names for `DEMO_MCP_SERVERS` / `DEMO_RAG_*`

These gaps are marked inline in the relevant spec files with `> [!NOTE] Assumption ...` blocks.

## When this evidence ages out

- When **code lands** that implements any of the above, the relevant spec file's `evidence:` list adds a `code-pointers/*` entry and the assumption block is removed.
- When the README is **updated**, regenerate this file's commit reference, and re-run `/evidence-arrived` to reclassify any new claims.
