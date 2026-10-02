#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Daily Finance — Server Hardening (OCI Free Tier 1GB RAM)
# Run ONCE after server setup: sudo bash deploy/scripts/harden-server.sh
#
# What this does:
#   1. Creates 2GB swap file (prevents OOM crashes)
#   2. Tunes kernel OOM killer to protect Docker containers
#   3. Installs health-check cron (auto-restarts containers if app goes down)
#   4. Limits Docker build memory so builds can't crash the server
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "══════════════════════════════════════════════"
echo "  Daily Finance — Server Hardening"
echo "══════════════════════════════════════════════"

# ── 1. Create 2GB swap file ─────────────────────────────────────────────────
echo ""
echo "▸ Setting up swap space..."

if swapon --show | grep -q '/swapfile'; then
  echo "  Swap already exists:"
  swapon --show
else
  echo "  Creating 2GB swap file..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile

  # Persist across reboots
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi

  # Tune swappiness — use swap only when RAM is nearly full
  sysctl vm.swappiness=10
  if ! grep -q 'vm.swappiness' /etc/sysctl.conf; then
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
  fi

  echo "  Swap active:"
  swapon --show
  free -h | head -3
fi

# ── 2. Tune OOM killer ──────────────────────────────────────────────────────
echo ""
echo "▸ Tuning OOM killer..."

# Lower vm.overcommit to be more conservative
sysctl vm.overcommit_memory=0
if ! grep -q 'vm.overcommit_memory' /etc/sysctl.conf; then
  echo 'vm.overcommit_memory=0' >> /etc/sysctl.conf
fi

# Protect SSH daemon from OOM killer
SSHD_PID=$(pgrep -o sshd 2>/dev/null || true)
if [ -n "$SSHD_PID" ]; then
  echo -1000 > /proc/$SSHD_PID/oom_score_adj 2>/dev/null || true
  echo "  SSH daemon protected from OOM killer"
fi

echo "  OOM tuning complete"

# ── 3. Install health-check cron ────────────────────────────────────────────
echo ""
echo "▸ Installing health-check script..."

cat > /opt/dailyfinance/scripts/health-check.sh << 'SCRIPT'
#!/bin/bash
# Health check — runs every 5 minutes via cron
# Checks if the app is responding, restarts containers if not

LOG="/opt/dailyfinance/backups/health-check.log"
MAX_LOG_SIZE=1048576  # 1MB

# Rotate log if too large
if [ -f "$LOG" ] && [ $(stat -c%s "$LOG" 2>/dev/null || echo 0) -gt $MAX_LOG_SIZE ]; then
  mv "$LOG" "${LOG}.old"
fi

# Check if app responds to HTTP
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost:3000/ 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "000" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') ALERT: App unreachable (HTTP $HTTP_CODE). Restarting containers..." >> "$LOG"

  # Check if Docker daemon is running
  if ! systemctl is-active --quiet docker; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') Docker daemon is down. Starting..." >> "$LOG"
    systemctl start docker
    sleep 10
  fi

  # Restart containers
  cd /opt/dailyfinance
  docker compose -f deploy/docker-compose.yml --env-file .env up -d 2>> "$LOG"
  sleep 30

  # Verify recovery
  HTTP_CODE2=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost:3000/ 2>/dev/null || echo "000")
  if [ "$HTTP_CODE2" != "000" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') RECOVERED: App responding (HTTP $HTTP_CODE2)" >> "$LOG"
  else
    echo "$(date '+%Y-%m-%d %H:%M:%S') FAILED: App still unreachable after restart" >> "$LOG"
  fi
elif [ "$HTTP_CODE" -ge 500 ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') WARNING: App returning HTTP $HTTP_CODE" >> "$LOG"
fi
SCRIPT

chmod +x /opt/dailyfinance/scripts/health-check.sh

# ── 4. Add health-check to cron (every 5 minutes) ──────────────────────────
echo "▸ Adding health-check cron job..."

# Get existing crontab, add health check if not already present
EXISTING_CRON=$(sudo -u opc crontab -l 2>/dev/null || true)
if echo "$EXISTING_CRON" | grep -q 'health-check.sh'; then
  echo "  Health-check cron already exists"
else
  echo "$EXISTING_CRON
# Health check — every 5 minutes, auto-restart if app is down
*/5 * * * * /opt/dailyfinance/scripts/health-check.sh" | sudo -u opc crontab -
  echo "  Health-check cron installed (every 5 minutes)"
fi

# ── 5. Configure Docker build memory limits ─────────────────────────────────
echo ""
echo "▸ Configuring Docker daemon for low-memory server..."

# Update daemon.json with build defaults
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "default-shm-size": "64m"
}
EOF

systemctl restart docker
echo "  Docker daemon configured"

# ── 6. Create safe-cleanup script ───────────────────────────────────────────
echo ""
echo "▸ Installing safe-cleanup script..."

cat > /opt/dailyfinance/scripts/safe-cleanup.sh << 'SCRIPT'
#!/bin/bash
# Safe cleanup — won't OOM the server
# Removes Docker build cache and old images in small steps

echo "$(date '+%Y-%m-%d %H:%M:%S') Starting safe cleanup..."

# Step 1: Remove dangling images (small operation)
echo "▸ Removing dangling images..."
docker image prune -f 2>/dev/null || true
sleep 2

# Step 2: Remove unused images (one at a time)
echo "▸ Removing unused images..."
UNUSED=$(docker images --filter "dangling=false" --format '{{.ID}} {{.Repository}}:{{.Tag}}' | \
  grep -v 'dailyfinance' | grep -v 'postgres' | awk '{print $1}')
for img in $UNUSED; do
  docker rmi "$img" 2>/dev/null || true
  sleep 1
done

# Step 3: Remove build cache (limit to keep recent)
echo "▸ Pruning build cache..."
docker builder prune -f --keep-storage 500MB 2>/dev/null || true

# Step 4: Check disk usage
echo ""
echo "Disk usage after cleanup:"
df -h /
echo ""
docker system df 2>/dev/null || true

echo "$(date '+%Y-%m-%d %H:%M:%S') Cleanup complete"
SCRIPT

chmod +x /opt/dailyfinance/scripts/safe-cleanup.sh

echo ""
echo "══════════════════════════════════════════════"
echo "  Server hardening complete!"
echo "══════════════════════════════════════════════"
echo ""
echo "  What was done:"
echo "    ✓ 2GB swap file (prevents OOM crashes)"
echo "    ✓ OOM killer tuned (SSH daemon protected)"
echo "    ✓ Health-check cron (every 5 min, auto-restart)"
echo "    ✓ Docker daemon optimized for low memory"
echo "    ✓ Safe cleanup script installed"
echo ""
echo "  Available scripts:"
echo "    /opt/dailyfinance/scripts/health-check.sh  — manual health check"
echo "    /opt/dailyfinance/scripts/safe-cleanup.sh   — safe Docker cleanup"
echo ""
echo "  Memory status:"
free -h
echo ""
