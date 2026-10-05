# Sections 17–18: CI/CD and Maintenance

---

## 17. CI/CD

### 17.1 GitHub Repository

| Property | Value |
|----------|-------|
| Repository | `smartrams121/reddyloanbook` |
| Branch | `main` (single branch workflow) |
| Visibility | Private |
| URL | https://github.com/smartrams121/reddyloanbook |

### 17.2 Repository Structure

```
Daily_Finance/
├── src/                    Application source code
│   ├── app/                Next.js App Router (pages + API routes)
│   ├── lib/                Core business logic libraries
│   └── components/         React components
├── prisma/
│   ├── schema.prisma       SQLite schema (local development)
│   └── seed.ts             Test data seeder
├── deploy/
│   ├── Dockerfile          Multi-stage Next.js Docker build
│   ├── docker-compose.yml  Production compose (PostgreSQL + app)
│   ├── nginx.conf          Reverse proxy configuration
│   ├── prisma.schema.postgresql  Production PostgreSQL schema
│   ├── DEPLOY.md           Deployment guide
│   └── scripts/
│       ├── setup-oci.sh            Server initial setup
│       ├── harden-server.sh        Security hardening
│       ├── deploy.sh               Standard deployment
│       ├── safe-deploy.sh          Memory-safe deployment (1GB RAM)
│       ├── zero-downtime-deploy.sh Zero-downtime deployment (6GB RAM)
│       └── backup.sh               Database backup
├── tests/
│   ├── unit/               Unit tests
│   └── integration/        Integration tests
├── documents/              Specification documents (this folder)
├── Memory/                 Session logs and CI/CD scripts reference
├── output/                 Generated files (reports, SQL scripts)
├── ssh_Keys/               SSH keys (gitignored)
├── CLAUDE.md               Project instructions for AI assistant
├── package.json            Dependencies
├── tsconfig.json           TypeScript configuration
├── tailwind.config.ts      Tailwind CSS configuration
└── .gitignore              Includes ssh_Keys/, .next/, node_modules/
```

### 17.3 Commit Process

```bash
# 1. Stage specific files (NEVER use git add -A to avoid ssh_Keys)
git add src/path/to/file.tsx src/app/api/path/route.ts

# 2. Commit with descriptive message + co-author attribution
git commit -m "$(cat <<'EOF'
Short description of changes

- Bullet point details
- Another change

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"

# 3. Push to main
git push origin main
```

### 17.4 Deployment Process (Zero-Downtime)

```
1. git push origin main              # Push code to GitHub
2. SSH into OCI server
3. git pull                           # Pull latest code
4. cp deploy/prisma.schema.postgresql prisma/schema.prisma  # Switch to PG schema
5. docker build -t dailyfinance_app:new .                   # Build new image
6. docker stop dailyfinance_app                             # Stop old container
7. docker tag dailyfinance_app:new dailyfinance_app:latest  # Retag
8. docker tag dailyfinance_app:new deploy-app:latest        # Tag for compose
9. docker compose up -d --no-build app                      # Start with pre-built image
10. Verify: curl http://localhost:3000/                      # Health check
```

**Critical Notes:**
- Must tag as BOTH `dailyfinance_app:latest` AND `deploy-app:latest` (compose uses `deploy-app`)
- Must use `--no-build` flag to prevent compose from rebuilding
- Must copy PostgreSQL schema before building (local dev uses SQLite)

### 17.5 Docker Configuration

**Dockerfile** (multi-stage build):
```
Stage 1: deps     — install node_modules
Stage 2: builder  — next build (standalone output)
Stage 3: runner   — minimal Node.js runtime, copy standalone + static
```

**docker-compose.yml**:
- PostgreSQL 16 Alpine with health check
- Next.js app depends on PostgreSQL healthy
- Persistent volumes: `postgres_data`, `app_uploads`
- Environment: DATABASE_URL, JWT_SECRET, SESSION_EXPIRY_HOURS

---

## 18. Maintenance

### 18.1 Scripts Reference

| Script | Location | Purpose |
|--------|----------|---------|
| `setup-oci.sh` | deploy/scripts/ | Initial server setup (Docker, Node.js, Git) |
| `harden-server.sh` | deploy/scripts/ | Security hardening (firewall, swap, fail2ban) |
| `deploy.sh` | deploy/scripts/ | Standard deployment (rebuild + restart) |
| `safe-deploy.sh` | deploy/scripts/ | Memory-safe deploy for 1GB servers |
| `zero-downtime-deploy.sh` | deploy/scripts/ | Zero-downtime deploy for 6GB+ servers |
| `backup.sh` | deploy/scripts/ | PostgreSQL pg_dump backup |

### 18.2 Production Migration Notes

**Session 2026-10-05 — New columns requiring ALTER TABLE on production PostgreSQL:**

| Table | Column | Type | Default | Purpose |
|-------|--------|------|---------|---------|
| User | preferredLanguage | String | "en" | Telugu i18n language preference |
| Business | defaulterPeriodDays | Int | 365 | Configurable defaulter threshold |
| Loan | statusOverride | String? | null | Manual loan status override |
| Loan | statusOverrideDate | String? | null | Date when override was set |

These columns are added via `prisma db push` (local dev) or `ALTER TABLE` statements on production. The `prisma db push --accept-data-loss` command on production (after copying the PostgreSQL schema) handles these automatically.

### 18.3 Database Management

| Task | Command |
|------|---------|
| Push schema changes | `npx prisma db push --accept-data-loss` |
| Run migrations | `npx prisma migrate dev --name description` |
| Generate client | `npx prisma generate` |
| Open visual browser | `npx prisma studio` |
| Reset + reseed | `npm run db:reset` |
| Seed data | `npx tsx prisma/seed.ts` |

**Production DB connection:**
```bash
source .env
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}" \
  npx prisma db push --accept-data-loss
```

### 18.4 Docker Commands

| Task | Command |
|------|---------|
| View running containers | `docker ps` |
| View app logs | `docker logs dailyfinance_app` |
| View DB logs | `docker logs dailyfinance_postgres` |
| Restart app | `docker restart dailyfinance_app` |
| Enter app container | `docker exec -it dailyfinance_app sh` |
| Enter DB container | `docker exec -it dailyfinance_postgres psql -U financeapp -d financeapp_db` |
| Remove old images | `docker image prune -f` |
| Check disk usage | `docker system df` |

### 18.5 Server Management

| Task | Command |
|------|---------|
| SSH into server | `ssh -i ssh_Keys/ssh-key-2026-10-01.key opc@80.225.201.199` |
| Check memory | `free -h` |
| Check disk | `df -h /` |
| Check Nginx | `sudo nginx -t && sudo systemctl status nginx` |
| Reload Nginx | `sudo nginx -s reload` |
| View Nginx logs | `sudo tail -f /var/log/nginx/access.log` |
| Restart Nginx | `sudo systemctl restart nginx` |

### 18.6 Local Development

| Task | Command |
|------|---------|
| Start dev server | `npm run dev` |
| Build production | `npm run build` |
| Run tests | `npm run test` |
| Fix stuck server | `taskkill /F /IM node.exe` then `rm -rf .next node_modules/.cache` |
| Seed local DB | `npm run db:seed` |
| Full setup | `npm run setup` |

### 18.7 Monitoring

| What | How |
|------|-----|
| App health | `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` |
| Container status | `docker ps --format 'table {{.Names}}\t{{.Status}}'` |
| DB health | `docker exec dailyfinance_postgres pg_isready -U financeapp` |
| Disk space | `df -h /` |
| Memory | `free -h` |

---

**Footer:** Confidential — Daily Finance
