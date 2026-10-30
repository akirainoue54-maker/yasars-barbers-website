#!/bin/bash
# Installs what the yt-dlp MCP server needs. Safe to run repeatedly: each step
# is skipped when already done. All output goes to stderr so this can run
# before the MCP server takes over stdout.
set -euo pipefail
exec 1>&2

# The session-start hook and the MCP launcher can run this at the same time
exec 9>/tmp/setup-yt-dlp-mcp.lock
flock 9

if ! command -v yt-dlp >/dev/null; then
  pip install --quiet --root-user-action=ignore -U yt-dlp
fi

if ! command -v yt-dlp-mcp >/dev/null; then
  npm install -g --silent @kevinwatt/yt-dlp-mcp@0.10.2
fi

# The server refuses to start unless its downloads folder exists
mkdir -p "${YTDLP_DOWNLOADS_DIR:-$HOME/Downloads}"
