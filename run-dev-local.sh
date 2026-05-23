#!/usr/bin/env bash
# run-dev-local.sh — boot augchatd in demo mode against a local config.
#
# This script is in the repo; the *config it reads* is not. Two pieces of
# local state expected (both gitignored):
#
#   .env.local                       model provider + key + system prompt
#   local/demo_connectors.json       MCP / RAG connector list with secrets
#
# .env.local example (copy from .env.local.example if present):
#   DEMO_MODEL_PROVIDER=openai
#   DEMO_MODEL_ID=gpt-4o-mini
#   DEMO_MODEL_API_KEY=sk-proj-...
#   DEMO_SYSTEM_PROMPT="You are a helpful assistant."
#   # DEMO_TTL_SECONDS=1800           # optional, default 60
#
# local/demo_connectors.json example: see local/demo_connectors.json.example
#
# Usage:
#   ./run-dev-local.sh            # boot
#   bun run mock-mcp              # (separate terminal) start the mock MCP if you use it

set -euo pipefail
cd "$(dirname "$0")"

# Load .env.local if present. Exporting via `set -a` so child processes see them.
if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

# Required.
: "${DEMO_MODEL_PROVIDER:?DEMO_MODEL_PROVIDER unset — set it in .env.local}"
: "${DEMO_MODEL_ID:?DEMO_MODEL_ID unset}"
: "${DEMO_MODEL_API_KEY:?DEMO_MODEL_API_KEY unset}"
: "${DEMO_SYSTEM_PROMPT:=You are a helpful assistant.}"

# Mode + connectors path (optional).
export AUGCHATD_MODE="${AUGCHATD_MODE:-demo}"
CONNECTORS_PATH="${DEMO_CONNECTORS_FILE:-local/demo_connectors.json}"

if [[ -f "$CONNECTORS_PATH" ]]; then
  export DEMO_CONNECTORS_FILE="$CONNECTORS_PATH"
  echo "augchatd: using connectors from $CONNECTORS_PATH"
else
  echo "augchatd: no connectors file at $CONNECTORS_PATH — booting without connectors"
  echo "          (copy local/demo_connectors.json.example to local/demo_connectors.json)"
fi

# Ensure UI is built. The Hono static-ui handler returns a 503 hint if
# ui/dist is missing; we'd rather build once and serve the real UI.
if [[ ! -f ui/dist/index.html ]]; then
  echo "augchatd: ui/dist not found — running 'bun run build:ui'"
  bun run build:ui
fi

exec bun start
