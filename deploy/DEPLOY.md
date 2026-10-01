# Daily Finance — OCI Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────┐
│  OCI Compute Instance (Oracle Linux 8/9)        │
│                                                 │
│  ┌──────────┐    ┌──────────┐    ┌───────────┐  │
│  │  Nginx   │───▸│ Next.js  │───▸│PostgreSQL │  │
│  │  :80     │    │ :3000    │    │ :5432     │  │
│  │ (reverse │    │ (Docker) │    │ (Docker)  │  │
│  │  proxy)  │    │          │    │           │  │
│  └──────────┘    └──────────┘    └───────────┘  │
│                                                 │
│  Volumes: postgres_data, app_uploads            │
└─────────────────────────────────────────────────┘
```

- **Nginx** — reverse proxy, static asset caching, future SSL termination
- **Next.js app** — Docker container, standalone build
- **PostgreSQL 16** — Docker container, persistent volume

---

## Prerequisites

- OCI Compute instance (Oracle Linux 8 or 9)
- Minimum: 1 OCPU, 2 GB RAM (Free Tier eligible)
- Recommended: 2 OCPU, 4 GB RAM
- Security list: allow TCP 80, 443 inbound
- SSH access to the instance

---

## Step-by-Step Deployment

### 1. SSH into the OCI Instance

```bash
ssh -i <private-key> opc@<public-ip>
sudo su -
```

### 2. Run the Setup Script

```bash
# Download or clone the repo first
cd /opt
git clone <your-repo-url> dailyfinance
cd /opt/dailyfinance

# Run system setup (installs Docker, Node.js, etc.)
bash deploy/scripts/setup-oci.sh
```

This installs: Docker, Docker Compose, Node.js 20 LTS, and Git.

### 3. Configure Environment

```bash
cp deploy/.env.production .env
```

Edit `.env` and change these values:

```bash
# MUST CHANGE — use strong values
POSTGRES_PASSWORD=your_strong_db_password_here
JWT_SECRET=your_random_64_char_string_here

# Update DATABASE_URL to match your POSTGRES_PASSWORD
DATABASE_URL="postgresql://financeapp:your_strong_db_password_here@postgres:5432/financeapp_db"
```

Generate a random JWT secret:

```bash
openssl rand -hex 32
```

### 4. Deploy

```bash
bash deploy/scripts/deploy.sh
```

This will:
1. Copy the PostgreSQL Prisma schema
2. Build the Docker images
3. Start PostgreSQL and wait for it to be healthy
4. Push the database schema
5. Load seed data (first deploy only)

### 5. Install Nginx (Reverse Proxy)

```bash
dnf install -y nginx
cp deploy/nginx.conf /etc/nginx/conf.d/dailyfinance.conf

# Remove default config
rm -f /etc/nginx/conf.d/default.conf

systemctl enable nginx
systemctl start nginx
```

### 6. Open Firewall

```bash
# Oracle Linux firewall
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

Also ensure the OCI Security List allows TCP 80 and 443 inbound.

### 7. Verify

Open `http://<public-ip>` in a browser.

Login: `platform_admin` / `system`

---

## Redeployment (Updating the App)

```bash
cd /opt/dailyfinance
git pull
bash deploy/scripts/deploy.sh
```

The deploy script:
- Rebuilds the Docker image with latest code
- Pushes any schema changes
- Skips seed data if users already exist
- Zero-downtime: new container starts before old stops

---

## Database Backup

### Manual Backup

```bash
bash deploy/scripts/backup.sh
```

### Automated Daily Backup (2 AM)

```bash
crontab -e
# Add this line:
0 2 * * * /opt/dailyfinance/deploy/scripts/backup.sh >> /var/log/dailyfinance-backup.log 2>&1
```

### Restore from Backup

```bash
gunzip < backups/dailyfinance_20261001_020000.sql.gz | \
  docker compose -f deploy/docker-compose.yml exec -T postgres \
  psql -U financeapp -d financeapp_db
```

---

## Useful Commands

```bash
# View logs
docker compose -f deploy/docker-compose.yml logs -f app
docker compose -f deploy/docker-compose.yml logs -f postgres

# Restart app only
docker compose -f deploy/docker-compose.yml restart app

# Stop everything
docker compose -f deploy/docker-compose.yml down

# Stop and delete all data (DESTRUCTIVE)
docker compose -f deploy/docker-compose.yml down -v

# Open Prisma Studio (database browser)
docker compose -f deploy/docker-compose.yml exec app npx prisma studio

# Run seed data (resets all data)
docker compose -f deploy/docker-compose.yml exec app npx tsx prisma/seed.ts

# Connect to PostgreSQL directly
docker compose -f deploy/docker-compose.yml exec postgres psql -U financeapp -d financeapp_db
```

---

## SSL / HTTPS (Optional)

Install Certbot for free Let's Encrypt SSL:

```bash
dnf install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

Certbot auto-renews. Verify:

```bash
certbot renew --dry-run
```

---

## Monitoring

### Check app health

```bash
curl -s http://localhost:3000/api/auth/check-username?username=test | head -1
# Should return JSON, not an error
```

### Check container status

```bash
docker compose -f deploy/docker-compose.yml ps
```

### Check disk usage

```bash
docker system df
df -h /opt/dailyfinance
```

---

## File Structure

```
deploy/
├── DEPLOY.md                    ← This file
├── Dockerfile                   ← Multi-stage Next.js build
├── docker-compose.yml           ← Production (PostgreSQL + app)
├── docker-compose.dev.yml       ← Dev (PostgreSQL only)
├── nginx.conf                   ← Reverse proxy config
├── .env.production              ← Environment template
├── .dockerignore                ← Docker build exclusions
├── prisma.schema.postgresql     ← PostgreSQL schema variant
└── scripts/
    ├── setup-oci.sh             ← One-time server setup
    ├── deploy.sh                ← Deploy / redeploy script
    └── backup.sh                ← Database backup script
```

---

## Test Accounts

All accounts use password: `system`

| Username | Role | Access |
|----------|------|--------|
| platform_admin | Platform Admin | Full system access |
| owner1 | Owner | Sai Daily Finance + Sri Lakshmi Finance |
| owner2 | Owner | Ganesh Finance |
| admin_sai | Business Admin | Sai Daily Finance only |
| agent1 | Agent | PM Palem, Madhurawada |
| agent2 | Agent | Gajuwaka |
| agent3 | Agent | PM Palem + Ameerpet (2 businesses) |
| agent_o2 | Agent | Ganesh Finance |

---

Internal Use Only
