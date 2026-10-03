#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Daily Finance — Zero-Downtime Deploy
#
# Strategy:
#   1. Build new image while old app is still serving traffic
#   2. Start new container on port 3001
#   3. Health check the new container
#   4. Switch Nginx upstream from :3000 → :3001
#   5. Stop old container
#   6. Restart new container on :3000
#   7. Restore Nginx upstream to :3000
#
# Requirements: 6GB+ RAM (runs two app containers briefly)
# Usage: bash deploy/scripts/zero-downtime-deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

APP_DIR="/opt/dailyfinance"
COMPOSE="docker compose -f deploy/docker-compose.yml --env-file .env"
NGINX_CONF="/etc/nginx/conf.d/dailyfinance.conf"
LOG="$APP_DIR/backups/deploy.log"

echo "══════════════════════════════════════════════"
echo "  Daily Finance — Zero-Downtime Deploy"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════════"

cd "$APP_DIR"

# ── Pre-flight checks ─────────────────────────────────────────────────────
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

if ! command -v nginx &>/dev/null; then
  echo "ERROR: Nginx not installed"
  exit 1
fi

echo "  Memory: $(free -h | awk '/Mem:/{print $2}') total, $(free -h | awk '/Mem:/{print $7}') available"
echo "  Disk: $(df -h / | awk 'NR==2{print $4}') free"

# ── 1. Database backup ────────────────────────────────────────────────────
echo ""
echo "▸ Step 1/8: Database backup..."
if docker ps --format '{{.Names}}' | grep -q dailyfinance_postgres; then
  bash "$APP_DIR/scripts/db-backup.sh" 2>&1 | tail -1 || echo "  Backup script not found, skipping"
else
  echo "  PostgreSQL not running — skipping backup"
fi

# ── 2. Pull latest code ──────────────────────────────────────────────────
echo ""
echo "▸ Step 2/8: Pulling latest code..."
if [ -d .git ]; then
  git pull
  echo "  Git: $(git log --oneline -1)"
fi

# ── 3. Switch Prisma schema ──────────────────────────────────────────────
echo ""
echo "▸ Step 3/8: Prisma schema for PostgreSQL..."
cp deploy/prisma.schema.postgresql prisma/schema.prisma

# ── 4. Build new image (old app still serving traffic) ───────────────────
echo ""
echo "▸ Step 4/8: Building new Docker image (old app still running)..."
echo "  Started: $(date '+%H:%M:%S')"

DOCKER_BUILDKIT=1 docker build \
  -f deploy/Dockerfile \
  -t dailyfinance_app:new \
  . 2>&1 | tail -5

echo "  Finished: $(date '+%H:%M:%S')"

# ── 5. Start new container on port 3001 ──────────────────────────────────
echo ""
echo "▸ Step 5/8: Starting new container on port 3001..."

# Source .env for DB credentials
set -a
source .env
set +a

docker run -d \
  --name dailyfinance_app_new \
  --network "$(docker network ls --filter name=dailyfinance -q | head -1)" \
  -e DATABASE_URL="postgresql://${POSTGRES_USER:-financeapp}:${POSTGRES_PASSWORD:-financeapp123}@dailyfinance_postgres:5432/${POSTGRES_DB:-financeapp_db}" \
  -e JWT_SECRET="${JWT_SECRET:-change-this-to-a-random-64-char-string}" \
  -e SESSION_EXPIRY_HOURS="${SESSION_EXPIRY_HOURS:-24}" \
  -e NODE_ENV=production \
  -e UPLOAD_DIR=/app/uploads \
  -p 3001:3000 \
  -v dailyfinance_app_uploads:/app/uploads \
  --restart unless-stopped \
  dailyfinance_app:new

# Health check — wait for new container to respond
echo "  Waiting for new container health check..."
RETRIES=0
until [ $RETRIES -ge 20 ]; do
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3001/ 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" != "000" ]; then
    echo "  New container: healthy (HTTP $HTTP_CODE)"
    break
  fi
  RETRIES=$((RETRIES + 1))
  echo "  Waiting... (attempt $RETRIES/20)"
  sleep 3
done

if [ "$HTTP_CODE" = "000" ]; then
  echo "  ERROR: New container not responding. Rolling back..."
  docker stop dailyfinance_app_new 2>/dev/null || true
  docker rm dailyfinance_app_new 2>/dev/null || true
  docker rmi dailyfinance_app:new 2>/dev/null || true
  echo "  Rollback complete. Old app still running."
  exit 1
fi

# ── 6. Switch Nginx to new container ─────────────────────────────────────
echo ""
echo "▸ Step 6/8: Switching Nginx to new container (port 3001)..."

# Backup current nginx config
cp "$NGINX_CONF" "${NGINX_CONF}.bak" 2>/dev/null || true

# Update nginx to point to 3001
sed -i 's/localhost:3000/localhost:3001/g' "$NGINX_CONF"
nginx -t && nginx -s reload
echo "  Nginx: now routing to port 3001"

# ── 7. Stop old container, retag, restart on 3000 ───────────────────────
echo ""
echo "▸ Step 7/8: Replacing old container..."

# Stop and remove old container
docker stop dailyfinance_app 2>/dev/null || true
docker rm dailyfinance_app 2>/dev/null || true

# Remove old image tag, retag new
docker rmi dailyfinance_app:latest 2>/dev/null || true
docker tag dailyfinance_app:new dailyfinance_app:latest
docker rmi dailyfinance_app:new 2>/dev/null || true

# Stop the temp container
docker stop dailyfinance_app_new 2>/dev/null || true
docker rm dailyfinance_app_new 2>/dev/null || true

# Start final container on port 3000 using compose
$COMPOSE up -d app
sleep 5

# Wait for app on 3000
RETRIES=0
until [ $RETRIES -ge 15 ]; do
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/ 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" != "000" ]; then
    echo "  App on port 3000: healthy (HTTP $HTTP_CODE)"
    break
  fi
  RETRIES=$((RETRIES + 1))
  sleep 3
done

# Restore nginx to port 3000
echo "  Restoring Nginx to port 3000..."
sed -i 's/localhost:3001/localhost:3000/g' "$NGINX_CONF"
nginx -t && nginx -s reload
echo "  Nginx: back to port 3000"

# ── 8. Database migration ────────────────────────────────────────────────
echo ""
echo "▸ Step 8/8: Database migration..."
DATABASE_URL="postgresql://${POSTGRES_USER:-financeapp}:${POSTGRES_PASSWORD:-financeapp123}@localhost:5432/${POSTGRES_DB:-financeapp_db}" \
  npx prisma db push --accept-data-loss 2>&1 | tail -3

# ── Post-deploy cleanup ─────────────────────────────────────────────────
echo ""
echo "▸ Cleanup..."
docker image prune -f 2>/dev/null || true
rm -f "${NGINX_CONF}.bak"

echo ""
echo "══════════════════════════════════════════════"
echo "  Zero-Downtime Deploy complete!"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════════"
echo ""
echo "Containers:"
docker ps --format 'table {{.Names}}\t{{.Status}}'
echo ""
echo "Memory:"
free -h | head -3
echo ""

# Log deployment
mkdir -p "$APP_DIR/backups"
echo "$(date '+%Y-%m-%d %H:%M:%S') Zero-downtime deploy: $(git log --oneline -1 2>/dev/null || echo 'unknown')" >> "$LOG"
