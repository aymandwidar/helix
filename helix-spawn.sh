#!/bin/bash
# helix-spawn.sh — Wrapper for Zain to invoke Helix Clean Factory
# Usage: helix-spawn.sh "app description" [--theme professional] [--no-constitution]
#
# All builds land in: ~/1-Projects/Helix/builds/{app_name}/
# After build: runs post-fix, then auto-deploys to Vercel + Turso
# Returns: exit code 0 on success, 1 on failure
#
# Available themes: glassmorphism (default), professional, minimal, vibrant

set -e

HELIX_DIR="/home/dwidar/1-Projects/Helix"

if [ -z "$1" ]; then
  echo "ERROR: No prompt provided"
  echo "Usage: helix-spawn.sh \"app description\" [--theme professional] [--no-constitution]"
  exit 1
fi

PROMPT="$1"
shift

cd "$HELIX_DIR"

# Source the master .env for API keys
set -a
source "$HELIX_DIR/.env"
set +a

echo "=== HELIX SPAWN ==="
echo "Prompt: $PROMPT"
echo "Builds dir: $HELIX_DIR/builds/"
echo ""

# Run Helix spawn
node dist/bin/helix.js spawn "$PROMPT" "$@"
SPAWN_EXIT=$?

if [ $SPAWN_EXIT -eq 0 ]; then
  # Derive the build path (same logic as spawn.ts generateProjectName)
  APP_NAME=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 ]//g' | awk '{for(i=1;i<=3&&i<=NF;i++) printf "%s-",$i}' | sed 's/-$//' | cut -c1-30)
  BUILD_PATH="$HELIX_DIR/builds/$APP_NAME"

  if [ -d "$BUILD_PATH" ]; then
    echo ""
    echo "=== RUNNING POST-FIX ==="
    "$HELIX_DIR/helix-postfix.sh" "$BUILD_PATH"

    echo ""
    echo "=== DEPLOYING TO VERCEL ==="
    "$HELIX_DIR/helix-deploy.sh" "$BUILD_PATH" "$APP_NAME"
  fi
fi

exit $SPAWN_EXIT
