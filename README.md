# Daily Finance — Collection Management Platform

A multi-owner finance collection management system for daily, weekly, and monthly lending businesses.

## Quick Start (Local Development)

### Prerequisites

- **Node.js 20 LTS** — Download from https://nodejs.org
- No Docker needed for local development (uses SQLite)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client + create database + seed test data
npm run setup
```

### Run

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Test Accounts

All test accounts use password: **`Test@123`**

| Username | Role | Access |
|---|---|---|
| `platform_admin` | Platform Admin | Full system access |
| `owner1` | Owner | Sai Daily Finance + Sri Lakshmi Finance |
| `owner2` | Owner | Ganesh Finance |
| `business_admin` | Business Admin | Sai Daily Finance only |
| `agent1` | Agent | PM Palem, Madhurawada |
| `agent2` | Agent | Gajuwaka |
| `agent3` | Agent | PM Palem + Ameerpet (2 businesses) |
| `agent4` | Agent | Ganesh Finance |

### Database Commands

```bash
npm run db:studio     # Open Prisma Studio (visual DB browser)
npm run db:seed       # Re-run seed data
npm run db:reset      # Reset database and re-seed
npm run db:migrate    # Run pending migrations
```

### Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** — mobile-first styling
- **Prisma** ORM + SQLite (local) / PostgreSQL (production)
- **bcryptjs** for password hashing
- **otplib** + **qrcode** for TOTP 2FA
- **Zod** for validation

## Project Structure

```
src/
├── app/
│   ├── (auth)/          Login, password change, 2FA setup
│   ├── (main)/          Authenticated app pages
│   │   ├── dashboard/   Owner combined dashboard
│   │   ├── b/[id]/      Business-scoped pages
│   │   └── ...
│   └── api/             REST API routes
├── lib/                 Core utilities (auth, money, loan calc, etc.)
├── components/          React components
└── middleware.ts        Auth + route protection
prisma/
├── schema.prisma        Database schema
└── seed.ts              Test data
tests/
├── unit/                Loan calculations, money formatting
└── integration/         Data isolation tests
```

## Data Hierarchy

Platform Admin → Owner → Business → Village → Customer → Loan → Payments

## Production Deployment (Phase 2)

Deployment guide for Oracle Cloud Always Free ARM VM will be added when ready.
Includes: Docker Compose (Next.js + PostgreSQL + Caddy), automated backups, and HTTPS.

---

Internal Use Only
