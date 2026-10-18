# Daily Finance

## Project Overview

Multi-owner microfinance collection management platform for daily, weekly, and monthly lending businesses in India. Agents collect repayments from customers organized by village.

Data hierarchy: Platform Admin → Owner → Business → Village → Customer → Loan → Payments

## Tech Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS (mobile-first)
- Prisma ORM — SQLite (local dev) / PostgreSQL (production)
- PDF generation: pdfkit (server-side) with NotoSans + NotoSansTelugu static TTF fonts
- Excel export: exceljs
- Auth: bcryptjs (passwords), jsonwebtoken (JWT), otplib + qrcode (TOTP 2FA)
- Validation: Zod
- Tests: Vitest
- i18n: Custom provider at `src/lib/i18n.tsx` with English + Telugu (20 translation files each)

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run test         # Run all tests
npm run test:watch   # Watch mode
npm run db:generate  # Prisma generate
npm run db:push      # Push schema to DB
npm run db:migrate   # Run migrations
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio (visual DB browser)
npm run db:reset     # Reset database and re-seed
npm run setup        # Full setup (install + generate + push + seed)
```

## Architecture

```
src/
├── app/
│   ├── (auth)/          Login, register, forgot-password, change-password, 2FA
│   ├── (main)/          Authenticated app pages
│   │   ├── dashboard/   Owner combined dashboard
│   │   ├── b/[id]/      Business-scoped pages (customers, loans, villages, posting, users, audit-logs)
│   │   ├── admin/       Platform admin (organizations, registration requests, password resets, settings)
│   │   ├── faq/         Help (FAQ accordion)
│   │   ├── contact-us/  Contact Us (mobile: action buttons, desktop: text)
│   │   └── profile/     User profile with photo upload
│   └── api/             REST API routes (auth, admin, owner, b/[businessId])
├── lib/                 Core utilities (auth, db, money, date, loan-status, audit, scope, rate-limit, csv-parse, xlsx-import, schedule, constants, i18n, agent-permissions, pdf-helpers)
├── components/          React components (ui/, layout/, permissions/)
└── middleware.ts        Auth + route protection
prisma/
├── schema.prisma        Database schema (SQLite locally, PostgreSQL in prod)
└── seed.ts              Test data seeder
tests/
├── unit/                Loan calculations, money formatting
└── integration/         Data isolation tests
deploy/
├── Dockerfile           Multi-stage Next.js build (ARM-compatible)
├── docker-compose.yml   Production (PostgreSQL + app)
├── nginx.conf           Reverse proxy config
├── prisma.schema.postgresql  Production schema (copy before build)
├── DEPLOY.md            Full deployment guide
└── scripts/             monitor.sh, backup.sh, cleanup.sh, restore-owner.sh
```

## Key Domain Concepts

- **Roles**: PLATFORM_ADMIN, OWNER, BUSINESS_ADMIN (Partner), AGENT
- **Permissions**: 36 actions via RBAC. Owner=full, Partner=near-full, Agent=customizable via permission grid (15 toggles, 3 presets: Collector/Field Manager/Full Access)
- **Collection types**: DAILY, WEEKLY, MONTHLY
- **Interest models**: ADDON (added on top), UPFRONT (deducted before disbursement)
- **Repayment multiplier**: Configurable per business (default 1.20 Daily/Weekly, 1.40 Monthly)
- **Money**: Stored in paise (Indian currency subunit), displayed as rupees
- **Loan lifecycle**: ACTIVE → (grace period) → OVERDUE → (defaulter period) → DEFAULTER / COMPLETED / PAUSED / SETTLED / WRITTEN_OFF
- **Grace period**: Configurable per business (default 30 days Daily, 4 weeks Weekly, 1 month Monthly)
- **Defaulter period**: Configurable per business (default 365 days)
- **City**: Owner-level field (User.city), not per-collection. Set at registration, editable in Profile → Organization Details
- **Aadhaar**: SHA-256 hashed, only last 4 digits stored
- **Payment modes**: Cash / UPI
- **Payment upsert**: Server-side duplicate prevention — same loan+date always updates existing payment

## Test Accounts (Local Dev)

All use password: `Test@123`

| Username | Role |
|---|---|
| platform_admin | Platform Admin |
| owner1 | Owner (Sai Daily Finance + Sri Lakshmi Finance) |
| owner2 | Owner (Ganesh Finance) |
| business_admin | Business Admin (Sai Daily Finance) |
| agent1 | Agent (PM Palem, Madhurawada) |
| agent2 | Agent (Gajuwaka) |
| agent3 | Agent (PM Palem + Ameerpet, 2 businesses) |
| agent4 | Agent (Ganesh Finance) |

## Production

- OCI Always Free ARM VM (VM.Standard.A1.Flex, 2 OCPUs, 12 GB RAM) + Oracle Linux 9
- Region: ap-mumbai-1 (Mumbai)
- Docker Compose: Next.js + PostgreSQL + DuckDNS dynamic DNS
- Nginx reverse proxy with SSL (Let's Encrypt)
- GitHub repo: private (smartrams121/reddyloanbook)

### Server Monitoring & Maintenance

| Script | Schedule | What |
|---|---|---|
| `monitor.sh` | Every 15 min (cron) | Health check + auto-restart + DuckDNS update + response time logging |
| `backup.sh` | Daily 2:00 AM | PostgreSQL pg_dump (90-day retention) |
| `cleanup.sh` | Weekly Sunday 2:30 AM | Docker prune + SSL renewal + session cleanup + audit log cleanup (30 days) |

### High Availability

- UptimeRobot: external monitoring (email/SMS on downtime)
- OCI boot volume: Silver auto-backup policy (weekly, 5 snapshots)
- Health check: auto-restart if app unreachable (every 15 min)
- Response time logging: `/opt/dailyfinance/backups/response-times.log` (flags >2s as SLOW)

## Features by Session

### Session 2026-10-03
- Business Import (XLSX), CSV Bulk Upload, Configurable Repayment Multiplier
- Grace Period in Overdue Logic, Employee Management, View Payments Page
- Agent Access Control (village-based), Agent Dashboard, Record Payment, Bulk Posting
- Table UI with pagination/sorting, Header Navigation, Collapsible Sections
- Android Download Fix, Zero-Downtime Deploy

### Session 2026-10-05
- Telugu i18n (20 files), UI Rebrand (Business→Collection), Configurable Defaulter Period
- Manual Loan Status Override, Bulk Posting Defaulter Filter, Password Reset Simplification
- Owner in Employees, Permissions Update for Business Admin, Report/Loans column changes

### Session 2026-10-06
- Admin Page Redesign (Organizations table), Organization Model, Registration Flow redesign
- Password & Session management, Sidebar Reorder, Customer Merge, System Banner
- Dashboard Improvements (auto-refresh, paid/unpaid), Daily Collection Summary report
- Collection Creation simplified, Payment Flow improvements, Profile redesign
- Delete Flow (cascade), Dead Code Removal, Terminology updates

### Session 2026-10-08
- Customer consistency fixes (family fields, GPS, edit page), Edit Loan form rewrite
- Granular Agent ACL: 15-toggle permission grid with cascade rules, 3 presets
- Village-based loan/payment access (replacing agentId filtering)
- Report improvements (field ordering, CID sort, PDF cell borders, Telugu font support)
- UI redesign: blue gradient header, Cricbuzz-style mobile footer, iOS safe area
- Dashboard abbreviated amounts with tap-to-toggle, Customer/Loan PDF+XLSX generation
- Mobile-responsive table columns, naming consistency fixes
- Server: cron consolidation, PostgreSQL tuning, disk cleanup, boot volume expansion
- GitHub Actions TWA workflow for Android APK builds

### Session 2026-10-16–17
- **Telugu translations expanded**: ~82 new keys across Dashboard, DateFilter, Reports, View Payments, Bulk Posting, AppShell nav, Permission Grid, Owner Dashboard
- **City field refactored**: Moved from Business to User model. Registration→approval carries city. Backfilled 6 existing owners from RegistrationRequest
- **Refresh buttons**: Owner dashboard, global employees, business employees, locations pages. Uses `window.location.reload()` for full refresh including header dropdown
- **Password reset share buttons**: WhatsApp + Email share modal after password reset on 3 pages (admin, owner, employees). Extended to registration approve/reject and employee creation (4 variants: password-reset, approved, rejected, employee-created)
- **Permission cascade fix**: Removed payments.view→record/bulk dependency. Create+edit locked together for record/bulk payment (upsert behavior)
- **"All" location toggle**: Assign locations section — select/deselect all villages at once
- **Audit Logs**: Full feature for fraud detection
  - Logging on 8 APIs: Edit Loan, Delete Loan, Edit Customer, Delete Customer, Edit Payment (individual+bulk), Change Permissions, Suspend/Activate/Delete Employee
  - Collector names resolved (not IDs), receipt/customer/loan info in entries
  - `diffFields()` helper for clean old/new comparison
  - View page: `/b/{id}/audit-logs` with date filters, action filters, expandable diff table
  - PDF download (beautified: color-coded badges, styled tables, page footers)
  - Excel download endpoint
  - Desktop: PDF + Excel buttons. Mobile: Share PDF + Share Excel (Web Share API)
  - Owner + Partner only (Agent blocked)
  - 30-day auto-cleanup in maintenance cron
  - Audit Logs button on Reports page header
  - Sidebar link below Reports
- **Duplicate payment fix**: Server-side upsert — same loan+date always updates existing payment (both individual and bulk posting APIs)
- **Detail modal improvements**: Hide blank fields in Customer Details and Loan Details modals. XLSX→Excel label everywhere
- **Desktop/Mobile button split**: Desktop shows PDF+Excel buttons, mobile shows Share PDF+Share Excel (WhatsApp). Applied to Reports, Audit Logs
- **Profile photo upload**: `User.photoPath` field, POST/DELETE `/api/auth/profile/upload`, saves to `public/uploads/profiles/`. Gallery/Camera/Remove buttons. Fullscreen viewer on click. Photo shows in header + sidebar avatars
- **Profile page reordered**: 1) Profile (with photo) → 2) Org Details → 3) Language → 4) Change Password (collapsed) → 5) Danger Zone (collapsed)
- **Contact Us redesign**: Platform Admin: new WhatsApp Number field in settings. Desktop: old style with visible phone/WhatsApp/email. Mobile: action buttons only (Call Customer Care, Email Customer Care, WhatsApp Message) — no raw values shown
- **Server upgrade**: 1→2 OCPUs, 6→12 GB RAM (OCI Always Free, $0). Swap dropped to 0
- **OCI boot volume auto-backup**: Silver policy (weekly, 5 snapshots)
- **Response time monitoring**: `monitor.sh` logs response times every 15 min, flags >2s as SLOW
- **GitHub repo**: Changed from public to private

## Documentation

- **Spec Document (online)**: https://smartrams121.github.io/reddyloanbook/documents/Daily_Finance_Specification.html
- Source files: `documents/` (7 markdown files + 1 HTML)

## Session Memory

- Full session log: `Memory/session_2026_10_03.md`
- CI/CD scripts reference: `Memory/cicd_scripts.md`

## Setting Up a New Computer

```bash
# 1. Clone the repo
git clone https://github.com/smartrams121/reddyloanbook.git Daily_Finance
cd Daily_Finance
npm install

# 2. Create .env for local dev
cp .env.example .env
# Edit .env — set any random JWT_SECRET for local dev

# 3. Setup local database
npm run db:generate
npm run db:push
npm run db:seed

# 4. Generate SSH key for this computer
ssh-keygen -t rsa -b 2048 -f ssh_Keys/ssh-key-new
# DO NOT commit ssh_Keys/ — it's in .gitignore

# 5. Add the new public key to the server
# (Run this from a computer that already has SSH access, OR use OCI Cloud Shell)
# From existing computer:
ssh -i ssh_Keys/ssh-key-2026-10-01.key opc@80.225.201.199 \
  "cat >> ~/.ssh/authorized_keys" < ssh_Keys/ssh-key-new.pub

# From OCI Cloud Shell (if no existing computer):
# Login at cloud.oracle.com → Cloud Shell → paste the public key:
# echo "ssh-rsa AAAA..." >> /home/opc/.ssh/authorized_keys

# 6. Test SSH
ssh -i ssh_Keys/ssh-key-new opc@80.225.201.199 "hostname"

# 7. Start dev server
npm run dev
```

Each computer gets its own SSH key. Multiple keys can coexist on the server. If a computer is lost, remove its public key from `~/.ssh/authorized_keys` on the server.

## Deployment

- SSH: `ssh -i ssh_Keys/<your-key> opc@80.225.201.199`
- Always copy PostgreSQL schema before build: `cp deploy/prisma.schema.postgresql prisma/schema.prisma`
- Tag image as BOTH `dailyfinance_app:latest` AND `deploy-app:latest`
- Use `--no-build` with docker compose
- Do NOT deploy without user confirmation
- For new schema columns: run ALTER TABLE on production PostgreSQL before deploying the app

## Deploy Steps (copy-paste)

```bash
# Standard deploy from local machine
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "cd /opt/dailyfinance && \
  git checkout -- prisma/schema.prisma && \
  git pull origin main && \
  cp deploy/prisma.schema.postgresql prisma/schema.prisma && \
  docker build -f deploy/Dockerfile -t dailyfinance_app:latest . && \
  docker tag dailyfinance_app:latest deploy-app:latest && \
  cd deploy && docker compose up -d --no-build"

# If schema has new columns, run migration BEFORE deploy:
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "docker exec dailyfinance_postgres \
  psql -U financeapp -d financeapp_db -c 'ALTER TABLE \"TableName\" ADD COLUMN IF NOT EXISTS \"column\" TEXT;'"
```

## Production DB Access

```bash
# Connect to production PostgreSQL
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "docker exec -it dailyfinance_postgres \
  psql -U financeapp -d financeapp_db"
```

## Server Health Check

```bash
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "uptime && free -h && docker ps && \
  curl -s -o /dev/null -w 'HTTP %{http_code} in %{time_total}s' http://localhost:3000/login"
```

## Server Cron Jobs (on OCI, not in git)

```bash
# View crontab
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "crontab -l"

# Current schedule:
# */15 * * * *  /opt/dailyfinance/deploy/scripts/monitor.sh     # Health check + DuckDNS + response time
# 0 2 * * *     /opt/dailyfinance/deploy/scripts/backup.sh      # DB backup (90-day retention)
# 30 2 * * 0    /opt/dailyfinance/deploy/scripts/cleanup.sh     # Docker prune + SSL + sessions + audit log cleanup (30 days)
```

**Log files on server:**
- `/opt/dailyfinance/backups/health-check.log` — only written on failures/restarts
- `/opt/dailyfinance/backups/response-times.log` — every 15 min, flags >2s as SLOW
- `/opt/dailyfinance/backups/backup.log` — daily backup results
- `/opt/dailyfinance/backups/maintenance.log` — weekly cleanup results
- `/opt/dailyfinance/backups/duckdns.log` — DuckDNS IP update status
- `/opt/dailyfinance/backups/dailyfinance_*.sql.gz` — daily DB backups

## Common Troubleshooting

- **Prisma generate fails (EPERM)**: Dev server has the DLL locked. Kill node first: `taskkill /F /IM node.exe` (Windows)
- **Dev server shows unstyled page**: `.next` cache stale. Run `rm -rf .next node_modules/.cache && npm run dev`
- **Transaction timeout on bulk posting**: Audit log writes inside transaction take too long. Move `createAuditLog()` calls outside the transaction
- **Variable fonts crash PDFKit**: Use static TTF fonts only (`public/fonts/NotoSans-*.ttf`)
- **PDF 0KB response**: Telugu characters in Content-Disposition filename. Use `encodeURIComponent()` on filenames
- **iOS date input zoom**: Ensure `font-size: 16px` on date inputs (in `globals.css`)

## Conventions

- Output files go in `output/` directory
- Do not auto-commit without asking
- Do not deploy to OCI without asking
- ssh_Keys/ is in .gitignore — never stage it
- Local dev: kill node, rm -rf .next + node_modules/.cache, then npm run dev
- PDF fonts: use static TTF (NotoSans + NotoSansTelugu) in `public/fonts/`, not variable fonts
- Mixed Telugu+Latin text in PDFs: use `splitMixedText()` from `src/lib/pdf-helpers.ts`
- Money display: `formatPaiseShort()` for abbreviated amounts, `formatPaiseAbbr()` for tap-to-toggle
- Audit logging: use `createAuditLog()` from `src/lib/audit.ts` for all edit/delete operations. Move audit writes outside DB transactions to avoid timeout
