# Contributing to augchatd

## Local development

augchatd boots in demo mode against a local config you keep on disk. Two files (both gitignored) hold your local state:

- **`.env.local`** — model provider + key + system prompt + any mode-agnostic ops vars
- **`local/demo_connectors.json`** — MCP / RAG connector list (with credentials)

Both have committed example templates:

- [`.env.local.example`](.env.local.example)
- [`local/demo_connectors.json.example`](local/demo_connectors.json.example)

Copy each to the gitignored name and fill in your values:

```bash
cp .env.local.example .env.local
cp local/demo_connectors.json.example local/demo_connectors.json
# edit both
```

Then boot the daemon:

```bash
./run-dev-local.sh
```

This is a thin wrapper that:

1. Sources `.env.local` (exporting every var to the augchatd process).
2. Sets `DEMO_CONNECTORS_FILE=local/demo_connectors.json` if that file exists.
3. Runs `bun src/index.ts` (no `--watch` — restart manually after backend changes; UI changes need `bun run build:ui` before they show up).

Open `http://localhost:8080/demo/` in a browser. The wrapper page mints a session via `POST /demo/sessions` and runs the same `postMessage` handshake an integrator would in production (see [contract-ui-handshake](spec/src/behavior/contracts/ui-handshake.md)).

## Spec workflow

This project follows the [Software Knowledge Playbook](https://github.com/TiagoJacobs/software-knowledge-playbook/blob/main/playbook.md): the canonical source of truth is `spec/`. See the project's [`CLAUDE.md`](CLAUDE.md) and [`spec/README.md`](spec/README.md) for the full workflow (the four sync routines, the divergence-flag convention, etc.). Short version:

- Edit `spec/` and code in the **same change**. Run `/spec-changed` if you touched spec, `/code-changed` if you touched code (or use the corresponding Claude Code slash commands).
- All work happens on a feature branch off `main`. Open PRs against the upstream repo (`augchatd/augchatd`), not the fork.
- Never push direct commits to `main`.
