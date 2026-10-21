#!/bin/bash
# Weekly cleanup script for Daily Finance production server
# Runs every Sunday at 2:30 AM — zero downtime
# Never removes: running containers, Docker volumes (DB data), OS system files

LOG="/var/log/dailyfinance-cleanup.log"
echo "=== Cleanup started: $(date) ===" >> "$LOG"

# 1. Docker: remove ALL unused images (keeps only running container images)
echo "[1/8] Pruning unused Docker images..." >> "$LOG"
docker image prune -a -f >> "$LOG" 2>&1 || true

# 2. Docker: remove ALL build cache
echo "[2/8] Pruning Docker build cache..." >> "$LOG"
docker builder prune -a -f >> "$LOG" 2>&1 || true

# 3. Docker: remove stopped containers
echo "[3/8] Pruning stopped containers..." >> "$LOG"
docker container prune -f >> "$LOG" 2>&1 || true

# 4. Containerd: prune unused content (OCI runtime layers)
echo "[4/8] Pruning containerd layers..." >> "$LOG"
sudo ctr -n moby images prune --all >> "$LOG" 2>&1 || true

# 5. OS: clean package manager cache
echo "[5/8] Cleaning DNF cache..." >> "$LOG"
sudo dnf clean all >> "$LOG" 2>&1 || true

# 6. App: remove node_modules (not needed at runtime, Docker has its own copy)
echo "[6/8] Removing node_modules..." >> "$LOG"
rm -rf /opt/dailyfinance/node_modules >> "$LOG" 2>&1 || true
rm -rf /opt/dailyfinance/.next/cache >> "$LOG" 2>&1 || true

# 7. Logs: rotate old logs
echo "[7/8] Rotating logs..." >> "$LOG"
sudo journalctl --vacuum-time=7d >> "$LOG" 2>&1 || true
find /var/log -name "dailyfinance-*.log" -mtime +30 -delete 2>/dev/null || true

# 8. DB: clean expired sessions
echo "[8/9] Cleaning expired sessions..." >> "$LOG"
cd /opt/dailyfinance/deploy
docker compose exec -T postgres psql -U financeapp -d financeapp_db -c \
  "DELETE FROM \"Session\" WHERE \"expiresAt\" < NOW() - INTERVAL '7 days';" >> "$LOG" 2>&1 || true

# 9. DB: clean old audit logs (30 days)
echo "[9/9] Cleaning audit logs older than 30 days..." >> "$LOG"
docker compose exec -T postgres psql -U financeapp -d financeapp_db -c \
  "DELETE FROM \"AuditLog\" WHERE \"createdAt\" < NOW() - INTERVAL '30 days';" >> "$LOG" 2>&1 || true

# Report
echo "" >> "$LOG"
echo "Disk after cleanup:" >> "$LOG"
df -h / | tail -1 >> "$LOG"
echo "Docker:" >> "$LOG"
docker system df >> "$LOG" 2>&1
echo "=== Cleanup done: $(date) ===" >> "$LOG"
echo "" >> "$LOG"
