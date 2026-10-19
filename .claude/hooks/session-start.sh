#!/usr/bin/env bash
# Install dependencies at the start of a Claude Code cloud session, so the coach
# scripts (scripts/*.mjs) can run there. Does nothing on the Mac.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
npm ci --no-audit --no-fund --loglevel=error
