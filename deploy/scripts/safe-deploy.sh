#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Daily Finance — Safe Deploy for Low-Memory OCI Free Tier (1GB + 2GB swap)
#
# This script replaces deploy.sh for the 1GB RAM server.
# Key differences from deploy.sh:
#   - Stops app container before building (frees ~300MB)
#   - Limits Docker build memory
#   - Runs cleanup between steps to prevent OOM
#   - DB stays running throughout (zero downtime for data)
#   - App downtime: only during build + startup (~3-5 min)
#
# Usage: bash deploy/scripts/safe-deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

APP_DIR="/opt/dailyfinance"
COMPOSE="docker compose -f deploy/docker-compose.yml --env-file .env"
LOG="$APP_DIR/backups/deploy.log"

echo "══════════════════════════════════════════════"
echo "  Daily Finance — Safe Deploy"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════════"

cd "$APP_DIR"

# ── Pre-flight checks ──────────────────────────────────────────────────────
echo ""
echo "▸ Pre-flight checks..."

if [ ! -f .env ]; then
  echo "ERROR: .env file not found"
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker not installed"
  exit 1
fi

# Check swap is active
if ! swapon --show | grep -q '/swapfile'; then
  echo "WARNING: No swap detected. Run harden-server.sh first for safety."
  echo "Continuing anyway..."
fi

# Show current state
echo ""
echo "Memory before deploy:"
free -h | head -3
echo ""
echo "Disk before deploy:"
df -h / | tail -1
echo ""

# ── 1. Database backup ─────────────────────────────────────────────────────
echo "▸ Step 1/7: Database backup..."
if docker ps --format '{{.Names}}' | grep -q dailyfinance_postgres; then
  bash "$APP_DIR/scripts/db-backup.sh" 2>&1 | tail -1
else
  echo "  PostgreSQL not running — skipping backup"
fi

# ── 2. Pull latest code ───────────────────────────────────────────────────
echo ""
echo "▸ Step 2/7: Pulling latest code..."
if [ -d .git ]; then
  git pull
  echo "  Git: $(git log --oneline -1)"
fi

# ── 3. Switch Prisma schema ───────────────────────────────────────────────
echo ""
echo "▸ Step 3/7: Prisma schema for PostgreSQL..."
cp deploy/prisma.schema.postgresql prisma/schema.prisma

# ── 4. Stop app container (free memory for build) ─────────────────────────
echo ""
echo "▸ Step 4/7: Stopping app container to free memory for build..."
docker stop dailyfinance_app 2>/dev/null || true
docker rm dailyfinance_app 2>/dev/null || true
sleep 2

# Quick cleanup to free disk/memory
echo "  Removing old app image..."
docker image prune -f 2>/dev/null || true
sleep 1

echo "  Memory after stopping app:"
free -h | head -3

# ── 5. Build new image (memory-limited) ───────────────────────────────────
echo ""
echo "▸ Step 5/7: Building new Docker image..."
echo "  This takes 5-10 minutes on 1 OCPU..."
echo "  Started: $(date '+%H:%M:%S')"

# Build with memory limit and no parallel steps
DOCKER_BUILDKIT=1 docker build \
  --memory=768m \
  --build-arg NODE_OPTIONS="--max-old-space-size=512" \
  -f deploy/Dockerfile \
  -t dailyfinance_app:latest \
  . 2>&1 | tail -5

echo "  Finished: $(date '+%H:%M:%S')"

# ── 6. Start all containers ──────────────────────────────────────────────
echo ""
echo "▸ Step 6/7: Starting containers..."
$COMPOSE up -d

# Wait for PostgreSQL health
echo "  Waiting for PostgreSQL..."
sleep 5
until docker compose -f deploy/docker-compose.yml exec -T postgres pg_isready -U financeapp -d financeapp_db 2>/dev/null; do
  echo "  Waiting..."
  sleep 3
done
echo "  PostgreSQL: ready"

# Wait for app to start
echo "  Waiting for app..."
sleep 10
RETRIES=0
until [ $RETRIES -ge 12 ]; do
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/ 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" != "000" ]; then
    echo "  App: responding (HTTP $HTTP_CODE)"
    break
  fi
  RETRIES=$((RETRIES + 1))
  echo "  Waiting... (attempt $RETRIES/12)"
  sleep 5
done

if [ "$HTTP_CODE" = "000" ]; then
  echo "  WARNING: App not responding after 60s. Check: docker logs dailyfinance_app"
fi

# ── 7. Run database migration ────────────────────────────────────────────
echo ""
echo "▸ Step 7/7: Database migration..."

# Source .env for DB credentials
set -a
source .env
set +a

DATABASE_URL="postgresql://${POSTGRES_USER:-financeapp}:${POSTGRES_PASSWORD:-financeapp123}@localhost:5432/${POSTGRES_DB:-financeapp_db}" \
  npx prisma db push --accept-data-loss 2>&1 | tail -3

# ── Post-deploy cleanup ─────────────────────────────────────────────────
echo ""
echo "▸ Post-deploy cleanup..."
docker image prune -f 2>/dev/null || true

echo ""
echo "══════════════════════════════════════════════"
echo "  Deploy complete!"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════════"
echo ""
echo "Containers:"
docker ps --format 'table {{.Names}}\t{{.Status}}'
echo ""
echo "Memory:"
free -h | head -3
echo ""
echo "Disk:"
df -h / | tail -1
echo ""

# Log deployment
echo "$(date '+%Y-%m-%d %H:%M:%S') Deploy: $(git log --oneline -1 2>/dev/null || echo 'unknown')" >> "$LOG"
