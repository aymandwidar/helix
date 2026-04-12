#!/bin/bash
# Helix Post-Build Auto-Fix Script
# Runs after every Helix spawn to catch and fix known generator bugs
# Usage: helix-postfix.sh <build-path>

set -e

BUILD_PATH="$1"

if [ -z "$BUILD_PATH" ]; then
  echo "ERROR: No build path provided"
  echo "Usage: helix-postfix.sh /path/to/builds/app-name"
  exit 1
fi

if [ ! -d "$BUILD_PATH" ]; then
  echo "ERROR: Build path does not exist: $BUILD_PATH"
  exit 1
fi

echo ""
echo "=== HELIX POST-FIX v11.0 ==="
echo "Build: $BUILD_PATH"
echo ""

FIXES=0
WARNINGS=0

# ---------------------------------------------------------------------------
# FIX 1: Prisma camelCase accessor mismatches in API routes
# Prisma expects camelCase (maintenanceLog) not lowercase (maintenancelog)
# ---------------------------------------------------------------------------
echo "[1/4] Checking Prisma accessor casing in API routes..."

API_DIR="$BUILD_PATH/src/app/api"
if [ -d "$API_DIR" ]; then
  # Read model names from the Prisma schema
  SCHEMA="$BUILD_PATH/prisma/schema.prisma"
  if [ -f "$SCHEMA" ]; then
    # Extract model names from schema
    MODEL_NAMES=$(grep -oP '^model\s+\K\w+' "$SCHEMA" || true)

    for MODEL in $MODEL_NAMES; do
      # Generate the wrong (all-lowercase) and correct (camelCase) versions
      WRONG=$(echo "$MODEL" | tr '[:upper:]' '[:lower:]')
      # camelCase: first char lowercase, rest preserved
      CORRECT="$(echo "${MODEL:0:1}" | tr '[:upper:]' '[:lower:]')${MODEL:1}"

      # Only fix if they're different (multi-word models like MaintenanceLog)
      if [ "$WRONG" != "$CORRECT" ]; then
        # Find and fix in API route files
        ROUTE_FILE="$API_DIR/$WRONG/route.ts"
        if [ -f "$ROUTE_FILE" ]; then
          if grep -q "prisma\.$WRONG" "$ROUTE_FILE"; then
            sed -i "s/prisma\.$WRONG/prisma.$CORRECT/g" "$ROUTE_FILE"
            echo "  FIXED: prisma.$WRONG -> prisma.$CORRECT in $(basename $(dirname $ROUTE_FILE))/route.ts"
            FIXES=$((FIXES + 1))
          fi
        fi
      fi
    done
  else
    echo "  WARNING: No Prisma schema found"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo "  WARNING: No API directory found"
  WARNINGS=$((WARNINGS + 1))
fi

# ---------------------------------------------------------------------------
# FIX 2: Remove view pages that reference non-existent fields (is_completed)
# ---------------------------------------------------------------------------
echo "[2/4] Checking view pages for invalid field references..."

APP_DIR="$BUILD_PATH/src/app"
if [ -d "$APP_DIR" ]; then
  # Find all page.tsx files (excluding the root page.tsx and api/)
  find "$APP_DIR" -name "page.tsx" -not -path "*/api/*" -not -path "$APP_DIR/page.tsx" | while read PAGE; do
    VIEW_DIR=$(dirname "$PAGE")
    VIEW_NAME=$(basename "$VIEW_DIR")

    # Check for hardcoded is_completed references that don't match any model field
    if grep -q "is_completed" "$PAGE"; then
      # Check if is_completed is actually a field in any model
      if [ -f "$SCHEMA" ] && ! grep -q "is_completed" "$SCHEMA"; then
        echo "  FIXED: Removed broken view '$VIEW_NAME' (references non-existent 'is_completed' field)"
        rm -rf "$VIEW_DIR"
        FIXES=$((FIXES + 1))
      fi
    fi
  done
fi

# ---------------------------------------------------------------------------
# FIX 3: Fix Prisma casing in the home page (page.tsx) fetch URLs vs accessors
# ---------------------------------------------------------------------------
echo "[3/4] Checking home page for Prisma issues..."

HOME_PAGE="$APP_DIR/page.tsx"
if [ -f "$HOME_PAGE" ]; then
  # The home page uses fetch('/api/...') which should match directory names (lowercase) — that's fine
  # But check for any direct prisma references (shouldn't be in client components, but just in case)
  if grep -q "prisma\." "$HOME_PAGE"; then
    echo "  WARNING: Home page contains direct Prisma references (should only use fetch)"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "  OK: Home page uses fetch API correctly"
  fi
fi

# ---------------------------------------------------------------------------
# FIX 4: Validate the build compiles
# ---------------------------------------------------------------------------
echo "[4/4] Validating build..."

cd "$BUILD_PATH"

# Run TypeScript check (non-blocking — report but don't fail)
if command -v npx &> /dev/null; then
  # Quick syntax check with tsc
  if npx tsc --noEmit --pretty 2>/tmp/helix-postfix-tsc.log; then
    echo "  OK: TypeScript compilation passed"
  else
    echo "  WARNING: TypeScript errors found (see below)"
    WARNINGS=$((WARNINGS + 1))
    # Show first 20 lines of errors
    head -20 /tmp/helix-postfix-tsc.log
    echo ""
    echo "  (Run 'npx tsc --noEmit' in the build dir for full output)"
  fi
else
  echo "  SKIP: npx not available"
fi

# ---------------------------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------------------------
echo ""
echo "=== POST-FIX COMPLETE ==="
echo "Fixes applied: $FIXES"
echo "Warnings: $WARNINGS"
echo ""

if [ $FIXES -gt 0 ]; then
  echo "Auto-fixes were applied. The build should be cleaner now."
fi
if [ $WARNINGS -gt 0 ]; then
  echo "Warnings found — manual review recommended."
fi

exit 0
