#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Daily Finance — OCI (Oracle Linux) Server Setup Script
# Run as root or with sudo on a fresh Oracle Linux 8/9 instance
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "══════════════════════════════════════════════"
echo "  Daily Finance — OCI Server Setup"
echo "══════════════════════════════════════════════"

# ── 1. System updates ────────────────────────────────────────────────────────
echo ""
echo "▸ Updating system packages..."
dnf update -y
dnf install -y git curl wget unzip certbot python3-certbot-nginx

# ── 2. Install Docker ────────────────────────────────────────────────────────
echo ""
echo "▸ Installing Docker..."
dnf install -y dnf-utils
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable docker
systemctl start docker

echo "Docker version:"
docker --version
docker compose version

# ── 3. Docker log rotation (prevent disk fill) ──────────────────────────────
echo ""
echo "▸ Configuring Docker log rotation..."
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
systemctl restart docker

# ── 4. Install Node.js 20 LTS (for running prisma commands on host) ────────
echo ""
echo "▸ Installing Node.js 20 LTS..."
dnf module enable -y nodejs:20
dnf install -y nodejs

echo "Node.js version:"
node --version
npm --version

# ── 5. Install Nginx reverse proxy ──────────────────────────────────────────
echo ""
echo "▸ Installing Nginx..."
dnf install -y nginx
systemctl enable nginx
systemctl start nginx

# ── 6. Open firewall ports ──────────────────────────────────────────────────
echo ""
echo "▸ Opening firewall ports (22, 80, 443, 3000)..."
firewall-cmd --permanent --add-port=22/tcp   2>/dev/null || true
firewall-cmd --permanent --add-port=80/tcp   2>/dev/null || true
firewall-cmd --permanent --add-port=443/tcp  2>/dev/null || true
firewall-cmd --permanent --add-port=3000/tcp 2>/dev/null || true
firewall-cmd --reload 2>/dev/null || true

# ── 7. Create app directory and backup directory ────────────────────────────
echo ""
echo "▸ Creating application directories..."
APP_DIR="/opt/dailyfinance"
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/backups"
mkdir -p "$APP_DIR/scripts"
chown -R opc:opc "$APP_DIR"

# ── 8. Create maintenance scripts ───────────────────────────────────────────
echo ""
echo "▸ Creating maintenance scripts..."

cat > "$APP_DIR/scripts/db-backup.sh" << 'SCRIPT'
#!/bin/bash
BACKUP_DIR=/opt/dailyfinance/backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/dailyfinance_${TIMESTAMP}.sql.gz"

docker exec dailyfinance_postgres pg_dump -U financeapp financeapp_db | gzip > "${BACKUP_FILE}"

if [ $? -eq 0 ]; then
    echo "$(date): Backup successful -> ${BACKUP_FILE} ($(du -sh "${BACKUP_FILE}" | cut -f1))"
else
    echo "$(date): ERROR - Backup failed!"
    exit 1
fi

find ${BACKUP_DIR} -name 'dailyfinance_*.sql.gz' -mtime +7 -delete
echo "$(date): Old backups cleaned (7-day retention)"
SCRIPT

cat > "$APP_DIR/scripts/db-cleanup.sh" << 'SCRIPT'
#!/bin/bash
docker exec dailyfinance_postgres psql -U financeapp financeapp_db -c "
  DELETE FROM \"Session\" WHERE \"expiresAt\" < NOW();
" 2>&1 | tail -1

docker exec dailyfinance_postgres psql -U financeapp financeapp_db -c "
  UPDATE \"SupportAccess\" SET \"isActive\" = false
  WHERE \"isActive\" = true AND \"expiresAt\" < NOW();
" 2>&1 | tail -1

echo "$(date): Session and support access cleanup complete"
SCRIPT

chmod +x "$APP_DIR/scripts/db-backup.sh"
chmod +x "$APP_DIR/scripts/db-cleanup.sh"

# ── 9. Set up cron jobs ─────────────────────────────────────────────────────
echo ""
echo "▸ Installing maintenance cron jobs..."

sudo -u opc crontab << 'CRON'
# Daily Finance Maintenance Jobs
# ─────────────────────────────────────────────────────────────

# DB backup - daily at 2:00 AM IST (20:30 UTC previous day)
30 20 * * * /opt/dailyfinance/scripts/db-backup.sh >> /opt/dailyfinance/backups/backup.log 2>&1

# Session & support access cleanup - every 6 hours
0 */6 * * * /opt/dailyfinance/scripts/db-cleanup.sh >> /opt/dailyfinance/backups/cleanup.log 2>&1

# SSL cert renewal check - twice daily (Certbot recommended)
30 2,14 * * * sudo certbot renew --quiet --post-hook 'sudo systemctl reload nginx'

# OS security updates - weekly Sunday at 3:00 AM IST (21:30 UTC Saturday)
30 21 * * 6 sudo dnf update -y --security >> /opt/dailyfinance/backups/os-update.log 2>&1

# Docker prune unused images - weekly Sunday at 4:00 AM IST
30 22 * * 6 docker image prune -f >> /opt/dailyfinance/backups/docker-prune.log 2>&1
CRON

echo ""
echo "══════════════════════════════════════════════"
echo "  System setup complete!"
echo "══════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. cd $APP_DIR"
echo "  2. git clone <your-repo-url> ."
echo "  3. cp deploy/.env.production .env"
echo "  4. Edit .env — change passwords and JWT_SECRET"
echo "  5. cd deploy && docker compose up -d"
echo "  6. Wait for PostgreSQL healthcheck to pass"
echo "  7. cd $APP_DIR && DATABASE_URL='postgresql://...' npx prisma db push"
echo "  8. Set up SSL: sudo certbot --nginx -d your-domain.duckdns.org"
echo ""
echo "Or use the deploy script:"
echo "  bash deploy/scripts/deploy.sh"
echo ""
echo "Maintenance (auto-configured via cron):"
echo "  - DB backup:      daily 2:00 AM IST, 7-day retention"
echo "  - Session cleanup: every 6 hours"
echo "  - SSL renewal:    twice daily (certbot)"
echo "  - OS updates:     weekly Sunday 3:00 AM IST"
echo "  - Docker prune:   weekly Sunday 4:00 AM IST"
echo "  - Log rotation:   10MB × 3 files per container"
echo ""
