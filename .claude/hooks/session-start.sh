#!/bin/bash
set -euo pipefail

# Only needed in Claude Code cloud sessions, whose containers start fresh
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

"${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/setup-yt-dlp-mcp.sh"
