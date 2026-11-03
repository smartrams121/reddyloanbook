#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Daily Finance — Health Check & Monitoring Script
# Runs every 15 minutes via cron:
#   */15 * * * * /opt/dailyfinance/deploy/scripts/monitor.sh
#
# 1. Health check — restart app container if unreachable
# 2. DuckDNS — update dynamic DNS IP
# 3. Response time — log and flag slow responses (>2s)
# ─────────────────────────────────────────────────────────────────────────────

set -o pipefail

APP_DIR="/opt/dailyfinance"
BACKUP_DIR="${APP_DIR}/backups"
HEALTH_LOG="${BACKUP_DIR}/health-check.log"
RESPONSE_LOG="${BACKUP_DIR}/response-times.log"
DUCKDNS_LOG="${BACKUP_DIR}/duckdns.log"
COMPOSE_FILE="${APP_DIR}/deploy/docker-compose.yml"
HEALTH_URL="http://localhost:3000/login"
DUCKDNS_DOMAIN="reddyloanbook"
DUCKDNS_TOKEN_FILE="${APP_DIR}/.duckdns-token"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

mkdir -p "$BACKUP_DIR"

# ── 1. Health Check ──────────────────────────────────────────────────────────

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" 2>/dev/null || echo "000")
RESPONSE_TIME=$(curl -s -o /dev/null -w '%{time_total}' --max-time 10 "$HEALTH_URL" 2>/dev/null || echo "0")

if [ "$HTTP_CODE" = "000" ] || [ "$HTTP_CODE" -ge 500 ] 2>/dev/null; then
  echo "${TIMESTAMP} [FAIL] HTTP ${HTTP_CODE} — restarting app container" >> "$HEALTH_LOG"
  docker compose -f "$COMPOSE_FILE" restart app >> "$HEALTH_LOG" 2>&1
  sleep 15
  RETRY_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" 2>/dev/null || echo "000")
  if [ "$RETRY_CODE" = "200" ]; then
    echo "${TIMESTAMP} [RECOVERED] App restarted — HTTP ${RETRY_CODE}" >> "$HEALTH_LOG"
  else
    echo "${TIMESTAMP} [CRITICAL] App still down after restart — HTTP ${RETRY_CODE}" >> "$HEALTH_LOG"
  fi
fi

# ── 2. Response Time Logging ─────────────────────────────────────────────────

if [ "$HTTP_CODE" != "000" ]; then
  SLOW=""
  if echo "$RESPONSE_TIME" | awk '{exit ($1 > 2.0) ? 0 : 1}'; then
    SLOW=" SLOW"
  fi
  echo "${TIMESTAMP} HTTP ${HTTP_CODE} ${RESPONSE_TIME}s${SLOW}" >> "$RESPONSE_LOG"
fi

# ── 3. DuckDNS Update ────────────────────────────────────────────────────────

if [ -f "$DUCKDNS_TOKEN_FILE" ]; then
  DUCKDNS_TOKEN=$(cat "$DUCKDNS_TOKEN_FILE" 2>/dev/null)
  if [ -n "$DUCKDNS_TOKEN" ]; then
    DUCK_RESULT=$(curl -s "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=" 2>/dev/null || echo "FAIL")
    echo "${TIMESTAMP} ${DUCK_RESULT}" >> "$DUCKDNS_LOG"
  fi
else
  # DuckDNS token file not configured — skip silently
  :
fi
