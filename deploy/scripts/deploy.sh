#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Daily Finance — Deploy / Redeploy Script
# Run from the project root directory: bash deploy/scripts/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "══════════════════════════════════════════════"
echo "  Daily Finance — Deploying..."
echo "══════════════════════════════════════════════"

# Check .env exists
if [ ! -f .env ]; then
  echo "ERROR: .env file not found."
  echo "Copy and edit: cp deploy/.env.production .env"
  exit 1
fi

# Check docker
if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker not installed. Run: bash deploy/scripts/setup-oci.sh"
  exit 1
fi

# ── 1. Pull latest code (if git repo) ───────────────────────────────────────
if [ -d .git ]; then
  echo ""
  echo "▸ Pulling latest code..."
  git pull
fi

# ── 2. Copy PostgreSQL schema ────────────────────────────────────────────────
echo ""
echo "▸ Switching Prisma schema to PostgreSQL..."
cp deploy/prisma.schema.postgresql prisma/schema.prisma

# ── 3. Build and start containers ────────────────────────────────────────────
echo ""
echo "▸ Building and starting containers..."
docker compose -f deploy/docker-compose.yml --env-file .env up -d --build

# ── 4. Wait for PostgreSQL to be healthy ─────────────────────────────────────
echo ""
echo "▸ Waiting for PostgreSQL..."
sleep 5
until docker compose -f deploy/docker-compose.yml exec -T postgres pg_isready -U financeapp -d financeapp_db; do
  echo "  Waiting..."
  sleep 2
done
echo "  PostgreSQL is ready."

# ── 5. Run database migration (from host, using project's pinned Prisma) ─────
echo ""
echo "▸ Installing Prisma CLI on host..."
npm install --no-save prisma@5 @prisma/client@5 2>/dev/null

echo "▸ Pushing database schema..."
DATABASE_URL="postgresql://${POSTGRES_USER:-financeapp}:${POSTGRES_PASSWORD:-financeapp123}@localhost:5432/${POSTGRES_DB:-financeapp_db}" \
  npx prisma db push --accept-data-loss

# ── 6. Check if seed data is needed ──────────────────────────────────────────
echo ""
echo "▸ Checking if seed data is needed..."
USER_COUNT=$(DATABASE_URL="postgresql://${POSTGRES_USER:-financeapp}:${POSTGRES_PASSWORD:-financeapp123}@localhost:5432/${POSTGRES_DB:-financeapp_db}" \
  node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.user.count().then(c => { console.log(c); p.\$disconnect(); });
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ]; then
  echo "  No users found — loading seed data..."
  npm install --no-save tsx 2>/dev/null
  DATABASE_URL="postgresql://${POSTGRES_USER:-financeapp}:${POSTGRES_PASSWORD:-financeapp123}@localhost:5432/${POSTGRES_DB:-financeapp_db}" \
    npx tsx prisma/seed.ts
  echo "  Seed data loaded."
else
  echo "  Database already has $USER_COUNT users — skipping seed."
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  Deployment complete!"
echo "══════════════════════════════════════════════"
echo ""
echo "App running at: http://$(hostname -I | awk '{print $1}'):${APP_PORT:-3000}"
echo ""
echo "Test login: platform_admin / system"
echo ""
