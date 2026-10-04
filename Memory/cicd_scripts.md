# CI/CD Scripts Reference

## Git Commit Pattern

```bash
cd /c/Users/rtadi001/ClaudeAI/Daily_Finance

# Stage specific files (never use git add -A to avoid ssh_Keys)
git add \
  "src/app/(main)/b/[businessId]/path/file.tsx" \
  src/app/api/b/\[businessId\]/path/route.ts \
  src/lib/file.ts

# Commit with heredoc for multi-line message
git commit -m "$(cat <<'EOF'
Short description of changes

- Detail 1
- Detail 2

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"

# Push
git push origin main
```

## OCI Deployment Script (inline)

```bash
SSH_KEY="/c/Users/rtadi001/ClaudeAI/Daily_Finance/ssh_Keys/ssh-key-2026-10-01.key"
SSH_HOST="opc@80.225.201.199"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_HOST" 'bash -s' 2>&1 <<'REMOTE'
set -e
cd /opt/dailyfinance

echo "▸ Pull..."
sudo git pull
echo "  $(git log --oneline -1)"

echo "▸ Build..."
sudo cp deploy/prisma.schema.postgresql prisma/schema.prisma
sudo DOCKER_BUILDKIT=1 docker build -f deploy/Dockerfile -t dailyfinance_app:new . 2>&1 | tail -3

echo "▸ Swap..."
sudo docker stop dailyfinance_app 2>/dev/null || true
sudo docker rm dailyfinance_app 2>/dev/null || true
sudo docker rmi dailyfinance_app:latest deploy-app:latest 2>/dev/null || true
sudo docker tag dailyfinance_app:new dailyfinance_app:latest
sudo docker tag dailyfinance_app:new deploy-app:latest
sudo docker rmi dailyfinance_app:new 2>/dev/null || true
sudo docker compose -f deploy/docker-compose.yml --env-file .env up -d --no-build app 2>&1 | tail -3
sleep 8

HC=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/ 2>/dev/null || echo "000")
echo "App: $HC | $(git log --oneline -1)"
REMOTE
```

## Key Notes

### Docker Image Naming
- Docker Compose uses image name `deploy-app` (from `build:` directive in docker-compose.yml)
- Must tag as BOTH `dailyfinance_app:latest` AND `deploy-app:latest`
- Must use `--no-build` flag: `docker compose up -d --no-build app`
- Without `--no-build`, compose rebuilds from Dockerfile ignoring our pre-built image

### PostgreSQL Schema
- Always copy before build: `sudo cp deploy/prisma.schema.postgresql prisma/schema.prisma`
- Local dev uses SQLite (`prisma/schema.prisma`), production uses PostgreSQL (`deploy/prisma.schema.postgresql`)
- Both schemas must be kept in sync for new fields

### SSH Key
- Valid key: `ssh_Keys/ssh-key-2026-10-01.key`
- Server: `opc@80.225.201.199`
- ssh_Keys/ is in .gitignore

### Local Dev Server
```powershell
# Kill stuck processes
taskkill /F /IM node.exe

# Clean caches (required after production build or when stuck)
rm -rf .next node_modules/.cache

# Start in new window
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WindowStyle Normal
```

### DB Migration (production)
```bash
source .env
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}" \
  npx prisma db push --accept-data-loss
```

## Zero-Downtime Deploy Script (file-based)
Located at: `deploy/scripts/zero-downtime-deploy.sh`
- Builds new image while old app serves traffic
- Starts new container on port 3001, health checks
- Switches Nginx, swaps containers, restores Nginx
- Auto-rollback if health check fails
- Run: `sudo bash deploy/scripts/zero-downtime-deploy.sh`
