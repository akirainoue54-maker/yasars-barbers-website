#!/bin/bash
# Launcher for the yt-dlp MCP server (see .mcp.json). Runs the setup first in
# case the server starts before the session-start hook has finished.
set -euo pipefail

"$(dirname "$0")/setup-yt-dlp-mcp.sh"
exec yt-dlp-mcp
