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
dnf install -y git curl wget unzip

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

# ── 3. Install Node.js 20 LTS (for running prisma commands locally) ─────────
echo ""
echo "▸ Installing Node.js 20 LTS..."
dnf module enable -y nodejs:20
dnf install -y nodejs

echo "Node.js version:"
node --version
npm --version

# ── 4. Create app directory ──────────────────────────────────────────────────
echo ""
echo "▸ Creating application directory..."
APP_DIR="/opt/dailyfinance"
mkdir -p "$APP_DIR"

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
echo "  5. docker compose -f deploy/docker-compose.yml up -d"
echo "  6. Wait 10 seconds for PostgreSQL to start"
echo "  7. docker compose -f deploy/docker-compose.yml exec app npx prisma db push"
echo "  8. docker compose -f deploy/docker-compose.yml exec app npx tsx prisma/seed.ts"
echo ""
echo "Or use the deploy script:"
echo "  bash deploy/scripts/deploy.sh"
echo ""
