# Contributing to augchatd

## Local development

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (`curl -fsSL https://bun.sh/install | bash`).
- Then from the repo root: `bun install` (installs server deps; `run-dev-local.sh` builds the UI on first run).

### Session config

augchatd boots in demo mode against a single config file you keep on disk:

- **`local/demo_session.json`** — model + system prompt + storage + connectors (gitignored, has secrets)

A committed template is right next to it: [`local/demo_session.json.example`](local/demo_session.json.example). Copy it and fill in your values:

```bash
cp local/demo_session.json.example local/demo_session.json
# edit local/demo_session.json
```

**Field guide:**

- `user_id` (required, non-empty string) — keeps the hot SQLite at `<AUGCHATD_DATA_DIR>/demo/<user_id>.sqlite` (demo's tenantId is hardcoded to `demo`; `AUGCHATD_DATA_DIR` defaults to `./data`).
- `model.{provider,model_id,api_key}` (all required, non-empty strings) — boot refuses if `api_key` still holds the template placeholder.
- `system_prompt` (required, non-empty string).
- `storage` (optional) — your S3-compatible cold-storage credentials. **Omit the whole block for hot-only mode** (history is held in SQLite and lost on restart — fine for local poking, surprising in a public demo).
- `connectors[]` (optional) — typed MCP / RAG entries. Empty / omitted ⇒ plain chat with no tools or retrieval.
- `theme` (optional, `"light"` default or `"dark"`) — the bundled UI's color scheme.

The shape of this file is the same JSON shape an integrator will POST to `/sessions` in production — the demo just reads it from disk instead of an HTTPS body. See [`spec/src/behavior/contracts/session-create.md`](spec/src/behavior/contracts/session-create.md) for the production contract.

### Boot

```bash
./run-dev-local.sh
```

The script just exports `AUGCHATD_MODE=demo` + the default trace dir and runs `bun start`. All config validation lives in `src/env.ts`, so booting with `bun start` directly hits the same checks. If `local/demo_session.json` is missing the server stops at boot with a copy-paste `cp` hint.

### Optional per-machine overrides (`.env.local`)

If you need to change port, JWT TTL, data directory, or the trace directory, copy [`.env.local.example`](.env.local.example) to `.env.local` and uncomment what you need. The file is gitignored. Everything in it is optional — without it, defaults apply.

### Open the demo

```
http://localhost:8080/demo/
```

The wrapper page mints a session via `POST /demo/sessions` and runs the same `postMessage` handshake an integrator would in production (see [contract-ui-handshake](spec/src/behavior/contracts/ui-handshake.md)).

### Upgrading from the older split-config layout

If your checkout still has `local/demo_connectors.json` and a populated `.env.local` from before the consolidation: migrate the values into `local/demo_session.json` (see template), then `rm local/demo_connectors.json` and strip the per-session vars (`DEMO_MODEL_*`, `DEMO_SYSTEM_PROMPT`, `DEMO_S3_*`, `DEMO_CONNECTORS*`, `DEMO_THEME`) from `.env.local`. The new `.env.local` only carries the optional process-level overrides listed in `.env.local.example`.

## Spec workflow

This project follows the [Software Knowledge Playbook](https://github.com/TiagoJacobs/software-knowledge-playbook/blob/main/playbook.md): the canonical source of truth is `spec/`. See the project's [`CLAUDE.md`](CLAUDE.md) and [`spec/README.md`](spec/README.md) for the full workflow (the four sync routines, the divergence-flag convention, etc.). Short version:

- Edit `spec/` and code in the **same change**. Run `/spec-changed` if you touched spec, `/code-changed` if you touched code (or use the corresponding Claude Code slash commands).
- All work happens on a feature branch off `main`. Open PRs against the upstream repo (`augchatd/augchatd`), not the fork.
- Never push direct commits to `main`.
