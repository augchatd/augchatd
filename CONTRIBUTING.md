# Contributing to augchatd

## Local development

augchatd boots in demo mode against a single config file you keep on disk:

- **`local/demo_session.json`** — model + system prompt + S3 + connectors (gitignored, has secrets)

A committed template is right next to it: [`local/demo_session.json.example`](local/demo_session.json.example). Copy it and fill in your values:

```bash
cp local/demo_session.json.example local/demo_session.json
# edit local/demo_session.json
```

The shape of this file is the same JSON shape an integrator will POST to `/sessions` in production — the demo just reads it from disk instead of an HTTPS body. See [`spec/src/behavior/contracts/session-create.md`](spec/src/behavior/contracts/session-create.md) for the production contract.

Then boot:

```bash
./run-dev-local.sh
```

The script just exports `AUGCHATD_MODE=demo` + the default trace dir and runs `bun start`. All config validation lives in `src/env.ts`, so booting with `bun start` directly hits the same checks. If `local/demo_session.json` is missing the server stops at boot with a copy-paste `cp` hint.

### Optional per-machine overrides (`.env.local`)

If you need to change port, JWT TTL, trace directory, or the session-file path, copy [`.env.local.example`](.env.local.example) to `.env.local` and uncomment what you need. The file is gitignored. Everything in it is optional — without it, defaults apply.

### Open the demo

```
http://localhost:8080/demo/
```

The wrapper page mints a session via `POST /demo/sessions` and runs the same `postMessage` handshake an integrator would in production (see [contract-ui-handshake](spec/src/behavior/contracts/ui-handshake.md)).

## Spec workflow

This project follows the [Software Knowledge Playbook](https://github.com/TiagoJacobs/software-knowledge-playbook/blob/main/playbook.md): the canonical source of truth is `spec/`. See the project's [`CLAUDE.md`](CLAUDE.md) and [`spec/README.md`](spec/README.md) for the full workflow (the four sync routines, the divergence-flag convention, etc.). Short version:

- Edit `spec/` and code in the **same change**. Run `/spec-changed` if you touched spec, `/code-changed` if you touched code (or use the corresponding Claude Code slash commands).
- All work happens on a feature branch off `main`. Open PRs against the upstream repo (`augchatd/augchatd`), not the fork.
- Never push direct commits to `main`.
