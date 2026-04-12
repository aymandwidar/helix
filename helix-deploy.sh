#!/bin/bash
# helix-deploy.sh — Auto-deploy Helix app to Turso + Vercel
# Usage: helix-deploy.sh <build-path> <app-name>

set -e

BUILD_PATH="$1"
APP_NAME="$2"
HELIX_DIR="/home/dwidar/1-Projects/Helix"

if [ -z "$BUILD_PATH" ] || [ -z "$APP_NAME" ]; then
  echo "ERROR: Usage: helix-deploy.sh <build-path> <app-name>"
  exit 1
fi

if [ ! -d "$BUILD_PATH" ]; then
  echo "ERROR: Build path does not exist: $BUILD_PATH"
  exit 1
fi

# Load env vars (VERCEL_TOKEN, etc.)
set -a
source "$HELIX_DIR/.env"
set +a

echo ""
echo "=== HELIX DEPLOY v11.0 ==="
echo "App: $APP_NAME"
echo "Path: $BUILD_PATH"
echo ""

cd "$BUILD_PATH"

# -------------------------------------------------------
# STEP 1: Create Turso database
# -------------------------------------------------------
echo "[1/7] Creating Turso database: $APP_NAME ..."

TURSO_DB_NAME=$(echo "$APP_NAME" | sed 's/[^a-z0-9-]/-/g' | cut -c1-46)

timeout 60 turso db create "$TURSO_DB_NAME" 2>/dev/null || true

TURSO_URL=$(turso db show "$TURSO_DB_NAME" --url)
TURSO_TOKEN=$(turso db tokens create "$TURSO_DB_NAME")

echo "  DB URL: $TURSO_URL"
echo "  Token: ${TURSO_TOKEN:0:20}..."

# -------------------------------------------------------
# STEP 2: Update Prisma schema for driver adapters
# -------------------------------------------------------
echo "[2/7] Updating Prisma schema for Turso..."

SCHEMA_FILE="$BUILD_PATH/prisma/schema.prisma"

if [ -f "$SCHEMA_FILE" ]; then
  # Add driverAdapters preview feature to generator block
  sed -i 's|provider = "prisma-client-js"|provider = "prisma-client-js"\n  previewFeatures = ["driverAdapters"]|' "$SCHEMA_FILE"

  # Update datasource: keep DATABASE_URL for local, add directUrl
  # Don't change url — Vercel env will override TURSO_DATABASE_URL at runtime
  # directUrl is for prisma db push (migrations)
  sed -i 's|url      = env("DATABASE_URL")|url      = env("DATABASE_URL")\n  directUrl = env("DATABASE_URL")|' "$SCHEMA_FILE"

  echo "  Updated schema.prisma"
else
  echo "  ERROR: No schema.prisma found"
  exit 1
fi

# -------------------------------------------------------
# STEP 3: Update .env with Turso credentials
# -------------------------------------------------------
echo "[3/7] Updating .env with Turso credentials..."

sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"file:./dev.db\"|" "$BUILD_PATH/.env"

cat >> "$BUILD_PATH/.env" << EOF

# Turso (production database)
TURSO_DATABASE_URL="${TURSO_URL}?authToken=${TURSO_TOKEN}"
EOF

echo "  Updated .env"

# -------------------------------------------------------
# STEP 4: Install libsql adapter (version-matched to Prisma 5.22.0)
# -------------------------------------------------------
echo "[4/7] Installing @prisma/adapter-libsql@5.22.0 + @libsql/client..."

cd "$BUILD_PATH"

# Add .npmrc for peer dep compat
echo "legacy-peer-deps=true" > "$BUILD_PATH/.npmrc"

timeout 120 npm install @prisma/adapter-libsql@5.22.0 @libsql/client --legacy-peer-deps 2>&1 | tail -1

# Write the Prisma client with driver adapter pattern
cat > "$BUILD_PATH/src/lib/prisma.ts" << 'PRISMA_EOF'
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  if (process.env.TURSO_DATABASE_URL) {
    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL.split('?authToken=')[0].trim(),
      authToken: process.env.TURSO_DATABASE_URL.split('?authToken=')[1]?.trim(),
    });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter } as any);
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
PRISMA_EOF

echo "  Updated lib/prisma.ts with driver adapter"

# Regenerate Prisma client
npx prisma generate 2>&1 | tail -1

echo "  Prisma setup complete"

# -------------------------------------------------------
# STEP 5: Create tables in Turso via SQL
# -------------------------------------------------------
echo "[5/7] Pushing schema to Turso..."

# Extract model definitions from schema and create tables via turso shell
# Parse models from schema.prisma
python3 << PYEOF
import re

with open("$SCHEMA_FILE") as f:
    schema = f.read()

type_map = {
    "String": "TEXT NOT NULL",
    "Int": "INTEGER NOT NULL",
    "Float": "REAL NOT NULL",
    "Boolean": "BOOLEAN NOT NULL DEFAULT 0",
    "DateTime": "DATETIME NOT NULL",
}

models = re.findall(r'model\s+(\w+)\s*\{([^}]+)\}', schema)
sql_statements = []

for model_name, body in models:
    columns = []
    for line in body.strip().split('\n'):
        line = line.strip()
        if not line or line.startswith('//'):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        col_name = parts[0]
        col_type = parts[1].rstrip('?')
        is_optional = '?' in parts[1]

        if col_name == 'id':
            columns.append("id TEXT PRIMARY KEY NOT NULL")
        elif col_name == 'createdAt':
            columns.append("createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
        elif col_name == 'updatedAt':
            columns.append("updatedAt DATETIME NOT NULL")
        else:
            sql_type = type_map.get(col_type, "TEXT NOT NULL")
            if is_optional:
                sql_type = sql_type.replace(" NOT NULL", "")
            columns.append(f"{col_name} {sql_type}")

    sql = f"CREATE TABLE IF NOT EXISTS {model_name} ({', '.join(columns)});"
    sql_statements.append(sql)

with open("/tmp/turso-init.sql", "w") as f:
    f.write('\n'.join(sql_statements))

print(f"  Generated SQL for {len(sql_statements)} tables")
PYEOF

timeout 60 turso db shell "$TURSO_DB_NAME" < /tmp/turso-init.sql
echo "  Tables pushed to Turso"
turso db shell "$TURSO_DB_NAME" ".tables"

# -------------------------------------------------------
# STEP 6: Set Vercel env vars BEFORE deploy
# -------------------------------------------------------
echo "[6/7] Setting Vercel environment variables..."

cat > "$BUILD_PATH/vercel.json" << 'VERCEL_EOF'
{
  "framework": "nextjs",
  "buildCommand": "npx prisma generate && next build",
  "installCommand": "npm install"
}
VERCEL_EOF

# Link project first (auto-creates on Vercel)
timeout 60 npx vercel link --yes --token "$VERCEL_TOKEN" 2>/dev/null || true

# Set env vars
printf '%s' "${TURSO_URL}?authToken=${TURSO_TOKEN}" | npx vercel env add TURSO_DATABASE_URL production --token "$VERCEL_TOKEN" --force 2>/dev/null || true
printf '%s' "file:./dev.db" | npx vercel env add DATABASE_URL production --token "$VERCEL_TOKEN" --force 2>/dev/null || true

echo "  Env vars set"

# -------------------------------------------------------
# STEP 7: Deploy to Vercel
# -------------------------------------------------------
echo "[7/7] Deploying to Vercel..."

DEPLOY_OUTPUT=$(timeout 300 npx vercel deploy --yes --token "$VERCEL_TOKEN" --prod 2>&1)
DEPLOY_EXIT=$?

if [ $DEPLOY_EXIT -ne 0 ]; then
  echo "  WARNING: Vercel deploy failed:"
  echo "$DEPLOY_OUTPUT" | tail -10
  echo ""
  echo "  App still works locally: cd $BUILD_PATH && npm run dev"
  exit 0
fi

VERCEL_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://[^\s]+\.vercel\.app' | tail -1)

echo ""
echo "=== DEPLOY COMPLETE ==="
echo "Live URL: $VERCEL_URL"
echo "Turso DB: $TURSO_DB_NAME"
echo "Local dev: cd $BUILD_PATH && npm run dev"
echo ""

exit 0
