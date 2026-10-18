# Daily Finance — Collection Management Platform

A multi-owner microfinance collection management system for daily, weekly, and monthly lending businesses in India.

---

## Features

- **Multi-tenant** — Platform Admin → Owners → Partners → Agents with role-based access
- **Loan Management** — Daily, Weekly, Monthly collection types with ADDON/UPFRONT interest models
- **Payment Posting** — Individual + Bulk posting with village-level collection, Cash/UPI modes
- **Granular Permissions** — 15-toggle permission grid for agents (Collector / Field Manager / Full Access presets)
- **Audit Logs** — Track all edits/deletes for fraud detection with PDF + Excel export
- **Reports** — Daily Collection Summary, Customers, Loans, Payments, Locations, Employees, Pay Slips
- **PDF + Excel** — Download or share via WhatsApp on mobile
- **Telugu Language** — Full Telugu (తెలుగు) translation support
- **Mobile-first** — Responsive design optimized for field agents on mobile devices
- **Customer Management** — Photo upload, GPS location, family references, Aadhaar (hashed)
- **Employee Management** — Create, assign to businesses/villages, permissions, password resets
- **Profile Photos** — Upload from gallery/camera, fullscreen viewer
- **Contact Us** — WhatsApp, Call, Email actions (mobile-optimized)

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS (mobile-first) |
| Database | Prisma ORM — SQLite (dev) / PostgreSQL (prod) |
| PDF | PDFKit with NotoSans + NotoSansTelugu fonts |
| Excel | ExcelJS |
| Auth | JWT + bcrypt + optional TOTP 2FA |
| Validation | Zod |
| Tests | Vitest |
| Deploy | Docker + Nginx on OCI Always Free ARM VM |

---

## Quick Start

### Prerequisites

- **Node.js 20 LTS** — Download from https://nodejs.org

### Setup

```bash
npm install
npm run setup    # Generate Prisma client + create DB + seed test data
npm run dev      # Start at http://localhost:3000
```

### Test Accounts

All use password: **`Test@123`**

| Username | Role | Access |
|---|---|---|
| `platform_admin` | Platform Admin | Full system access |
| `owner1` | Owner | Sai Daily Finance + Sri Lakshmi Finance |
| `business_admin` | Partner | Sai Daily Finance |
| `agent1` | Agent | PM Palem, Madhurawada |

### Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run test         # Run tests
npm run db:studio    # Visual DB browser
npm run db:reset     # Reset and re-seed database
```

---

## Architecture

```
src/
├── app/
│   ├── (auth)/          Login, register, forgot-password
│   ├── (main)/          Authenticated pages
│   │   ├── dashboard/   Owner + Business dashboards
│   │   ├── b/[id]/      Business-scoped (customers, loans, posting, reports, audit-logs)
│   │   ├── admin/       Platform admin (organizations, settings)
│   │   └── profile/     User profile with photo upload
│   └── api/             REST API routes
├── lib/                 Core utilities (auth, i18n, audit, permissions, pdf-helpers)
├── components/          React components (ui/, layout/, permissions/)
└── middleware.ts        Auth + route protection
prisma/
├── schema.prisma        Database schema
└── seed.ts              Test data seeder
deploy/
├── Dockerfile           Multi-stage ARM build
├── docker-compose.yml   PostgreSQL + Next.js
└── scripts/             Monitoring, backup, maintenance
```

---

## Data Model

```
Platform Admin → Owner → Business → Village → Customer → Loan → Payments
```

- **4 Roles**: Platform Admin, Owner, Partner (Business Admin), Agent
- **36 Permissions** via RBAC with granular agent permission grid
- **Loan Lifecycle**: Active → Grace Period → Overdue → Defaulter → Completed/Settled/Written Off
- **Money**: Stored in paise, displayed as rupees with abbreviated amounts
- **Audit Trail**: All edits/deletes logged with old/new values, 30-day retention

---

## Production Deployment

| Component | Detail |
|-----------|--------|
| Server | OCI Always Free ARM VM (2 OCPUs, 12 GB RAM) |
| OS | Oracle Linux 9 |
| App | Docker container (Next.js standalone) |
| Database | PostgreSQL 16 (Docker container) |
| Proxy | Nginx + Let's Encrypt SSL |
| DNS | DuckDNS dynamic DNS |
| Monitoring | UptimeRobot + health check cron (15 min) |
| Backups | Daily DB backup (90-day retention) + weekly OCI boot volume snapshot |

See [deploy/DEPLOY.md](deploy/DEPLOY.md) for full deployment guide.

---

## Documentation

Full technical specification: **[View Online](https://smartrams121.github.io/reddyloanbook/documents/Daily_Finance_Specification.html)**

Source files in [`documents/`](documents/)

---

## Onboarding for New Developers

### Local Setup

```bash
git clone https://github.com/smartrams121/reddyloanbook.git
cd reddyloanbook
npm install
npm run setup    # Creates local SQLite DB with test data
npm run dev      # http://localhost:3000
```

### AI Coding Assistants

| Tool | Reads | What to say |
|---|---|---|
| Claude Code | `CLAUDE.md` (automatic) | Just start working — it picks up context |
| OpenAI Codex | `AGENTS.md` (automatic) | "Read AGENTS.md for full project context" |
| Cursor / Copilot | Neither (manual) | "Read AGENTS.md for project context before helping" |

`AGENTS.md` contains: architecture, commands, deploy steps, server details, cron jobs, troubleshooting, and all feature history.

### Getting Production Server Access

1. Generate an SSH key on your computer:
   ```bash
   ssh-keygen -t rsa -b 2048 -f ~/.ssh/dailyfinance-key
   ```
2. Send the **public key** (`.pub` file) to the project owner
3. Owner adds it to the server — then you can SSH in:
   ```bash
   ssh -i ~/.ssh/dailyfinance-key opc@80.225.201.199
   ```

### Important Rules

- **Never commit** `ssh_Keys/`, `.env`, or any credentials
- **Never deploy** without confirming with the project owner
- **Database changes** (new columns) need `ALTER TABLE` on production PostgreSQL before deploying the app code
- **Cron jobs** run automatically on the server (monitoring every 15 min, backups daily, cleanup weekly) — no manual maintenance needed
- Full deploy steps, DB access commands, and troubleshooting are documented in `AGENTS.md`

## License

Private — All rights reserved.
