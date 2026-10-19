#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Daily Finance — Install Nginx Monitoring & Auto-Sync
# Run this once on the production server to set up automatic nginx config sync
# Usage: bash deploy/scripts/install-nginx-monitoring.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "════════════════════════════════════════════════════"
echo "  Installing Nginx Configuration Monitoring"
echo "════════════════════════════════════════════════════"

APP_DIR="/opt/dailyfinance"
SYNC_SCRIPT="${APP_DIR}/deploy/scripts/sync-nginx-config.sh"

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
  echo "ERROR: $APP_DIR not found!"
  exit 1
fi

# Make script executable
chmod +x "$SYNC_SCRIPT"
echo "✓ Made sync script executable"

# Add to root's crontab
echo ""
echo "Adding cron job to check nginx config every hour..."

# Remove old entry if it exists
sudo crontab -l 2>/dev/null | grep -v "sync-nginx-config.sh" | sudo crontab - || true

# Add new cron entry
(sudo crontab -l 2>/dev/null; echo "0 * * * * $SYNC_SCRIPT >> /opt/dailyfinance/backups/nginx-sync.log 2>&1") | sudo crontab -

echo "✓ Cron job installed"

# Create log file
sudo touch "${APP_DIR}/backups/nginx-sync.log"
sudo chmod 666 "${APP_DIR}/backups/nginx-sync.log"
echo "✓ Created log file"

# Run initial sync
echo ""
echo "Running initial sync..."
sudo bash "$SYNC_SCRIPT"

echo ""
echo "════════════════════════════════════════════════════"
echo "  Nginx monitoring installed successfully!"
echo "════════════════════════════════════════════════════"
echo ""
echo "The following will now happen automatically:"
echo "  ✓ Every hour: nginx config validated & synced with git"
echo "  ✓ If config is missing: automatically restored"
echo "  ✓ If config is invalid: automatic rollback & alert"
echo "  ✓ Logs available at: /opt/dailyfinance/backups/nginx-sync.log"
echo ""
echo "Verify with:"
echo "  sudo crontab -l | grep sync-nginx-config"
echo "  tail -f /opt/dailyfinance/backups/nginx-sync.log"
echo ""
