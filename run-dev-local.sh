#!/usr/bin/env bash
# run-dev-local.sh — boot augchatd in demo mode.
#
# All session config (model, system prompt, S3, connectors) lives in
# local/demo_session.json (gitignored; template at local/demo_session.json.example).
# Validation lives in src/env.ts — running `bun start` directly hits the
# same path. This script just sets the demo-mode defaults and execs.

set -euo pipefail
cd "$(dirname "$0")"

# Optional per-machine overrides (port, trace dir, TTL, session file path).
[[ -f .env.local ]] && { set -a; source .env.local; set +a; }

# Demo defaults — overridable from .env.local or the environment.
export AUGCHATD_MODE="${AUGCHATD_MODE:-demo}"
export AUGCHATD_TRACE_DIR="${AUGCHATD_TRACE_DIR-data-trace}"

# Build the UI once if missing; the static-ui handler 503s without it.
[[ -f ui/dist/index.html ]] || bun run build:ui

exec bun start
