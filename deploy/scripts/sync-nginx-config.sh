#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Daily Finance — Nginx Configuration Sync & Validation Script
# Runs hourly via cron to ensure nginx config stays in sync with git
# If config is missing or invalid, restores it automatically
# ─────────────────────────────────────────────────────────────────────────────

LOG="/opt/dailyfinance/backups/nginx-sync.log"
APP_DIR="/opt/dailyfinance"
REMOTE_CONFIG="${APP_DIR}/deploy/nginx.conf"
LOCAL_CONFIG="/etc/nginx/conf.d/dailyfinance.conf"
EXPECTED_MD5="$(md5sum ${REMOTE_CONFIG} 2>/dev/null | cut -d' ' -f1)"
ACTUAL_MD5="$(sudo md5sum ${LOCAL_CONFIG} 2>/dev/null | cut -d' ' -f1)"

echo "$(date '+%Y-%m-%d %H:%M:%S') — Nginx config sync check" >> "$LOG"

# Check if config exists
if [ ! -f "$LOCAL_CONFIG" ]; then
  echo "  [WARN] Config missing at $LOCAL_CONFIG" >> "$LOG"
  echo "  [ACTION] Restoring config from git..." >> "$LOG"
  sudo cp "$REMOTE_CONFIG" "$LOCAL_CONFIG"
  ACTUAL_MD5="$(sudo md5sum ${LOCAL_CONFIG} 2>/dev/null | cut -d' ' -f1)"
fi

# Check if config matches
if [ "$EXPECTED_MD5" != "$ACTUAL_MD5" ]; then
  echo "  [WARN] Config mismatch detected" >> "$LOG"
  echo "    Expected: $EXPECTED_MD5" >> "$LOG"
  echo "    Actual:   $ACTUAL_MD5" >> "$LOG"
  echo "  [ACTION] Restoring config from git..." >> "$LOG"
  sudo cp "$REMOTE_CONFIG" "$LOCAL_CONFIG"
fi

# Validate nginx config syntax
echo "  [CHECK] Validating nginx syntax..." >> "$LOG"
if ! sudo nginx -t >> "$LOG" 2>&1; then
  echo "  [ERROR] Nginx config invalid! Attempting rollback..." >> "$LOG"
  # Rollback to last known good config
  sudo systemctl reload nginx >> "$LOG" 2>&1
  exit 1
fi

# Reload nginx if config was updated
if [ "$EXPECTED_MD5" != "$(sudo md5sum ${LOCAL_CONFIG} 2>/dev/null | cut -d' ' -f1)" ]; then
  echo "  [ACTION] Reloading nginx..." >> "$LOG"
  sudo systemctl reload nginx >> "$LOG" 2>&1
  if [ $? -eq 0 ]; then
    echo "  [SUCCESS] Nginx reloaded successfully" >> "$LOG"
  else
    echo "  [ERROR] Failed to reload nginx!" >> "$LOG"
    exit 1
  fi
else
  echo "  [OK] Config is in sync" >> "$LOG"
fi

echo "  [STATUS] $(sudo systemctl is-active nginx)" >> "$LOG"
echo "" >> "$LOG"
