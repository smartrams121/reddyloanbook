# Daily Finance

## Project Overview

Multi-owner microfinance collection management platform for daily, weekly, and monthly lending businesses in India. Agents collect repayments from customers organized by village.

Data hierarchy: Platform Admin → Owner → Business → Village → Customer → Loan → Payments

## Tech Stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS (mobile-first)
- Prisma ORM — SQLite (local dev) / PostgreSQL (production)
- PDF generation: pdfkit (server-side), @react-pdf/renderer
- Excel export: exceljs
- Auth: bcryptjs (passwords), jsonwebtoken (JWT), otplib + qrcode (TOTP 2FA)
- Validation: Zod
- Tests: Vitest

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
│   │   ├── b/[id]/      Business-scoped pages (customers, loans, villages, posting, users)
│   │   ├── admin/       Platform admin (owners, registration requests, password resets, settings)
│   │   ├── faq/         FAQ accordion
│   │   └── profile/     User profile
│   └── api/             REST API routes (auth, admin, owner, b/[businessId])
├── lib/                 Core utilities (auth, db, money, date, loan-calc, loan-status, audit, scope, rate-limit, receipt, whatsapp, csv-parse, xlsx-import, schedule, constants)
├── components/          React components (ui/, layout/, ResetPasswordModal)
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
├── DEPLOY.md            Full deployment guide
└── scripts/             setup-oci.sh, deploy.sh, provision-oci.sh, backup.sh, safe-deploy.sh
```

## Key Domain Concepts

- **Roles**: PLATFORM_ADMIN, OWNER, BUSINESS_ADMIN, AGENT (36 permissions via RBAC)
- **Collection types**: DAILY, WEEKLY, MONTHLY
- **Interest models**: ADDON (added on top), UPFRONT (deducted before disbursement)
- **Repayment multiplier**: Configurable per business (default 1.20 Daily/Weekly, 1.40 Monthly)
- **Money**: Stored in paise (Indian currency subunit), displayed as rupees
- **Loan lifecycle**: ACTIVE → (grace period) → OVERDUE → (1 year) → DEFAULTER / COMPLETED / PAUSED / SETTLED / WRITTEN_OFF
- **Grace period**: Configurable per business (default 30 days Daily, 4 weeks Weekly, 1 month Monthly)
- **Aadhaar**: SHA-256 hashed, only last 4 digits stored
- **Payment modes**: Cash / UPI (recorded as note on payment)

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

- OCI Always Free ARM VM (VM.Standard.A1.Flex) + Oracle Linux 9
- Docker Compose: Next.js + PostgreSQL + DuckDNS dynamic DNS
- Nginx reverse proxy
- Automated daily DB backups, session cleanup, SSL renewal via cron

## Recent Features (Session 2026-10-03)

- **Business Import**: Upload exported XLSX to recreate a business with all data. Test → Import flow with sample template.
- **CSV Bulk Upload**: Loans and Payments CSV bulk import. Hidden on mobile.
- **Configurable Repayment Multiplier**: Per-business setting (replaces hardcoded 1.20/1.40).
- **Grace Period in Overdue Logic**: Wired into all 18 deriveLoanStatus call sites.
- **Employee Management**: Global create/edit/suspend/delete + business-scoped assignment with village multi-select.
- **View Payments Page**: Dedicated page with date/village/employee filters, sortable table, PDF/XLSX download.
- **Agent Access Control**: Agents only see their own loans, assigned village customers, and their payments. Employees page blocked.
- **Agent Dashboard**: Redirects to activity page with collections/disbursements stats.
- **Record Payment**: Date filter, Payment Completed checkbox, eligible customer filter by loan start date, default installment amount, payment mode (Cash/UPI).
- **Bulk Posting**: All Locations default, 10 per page, Submit & Next, payment mode, Payment Completed filter.
- **Table UI**: Plain table layout for Customers/Loans/Payments with pagination (15 default, 10 mobile), sortable columns, multi-select status filters.
- **Header Navigation**: Desktop has all icons (Customers, Locations, Loans, Payments, New Payment, Bulk Payments, Employees, Reports, Dashboard). Mobile shows Customers, Loans, Payments only.
- **Collapsible Sections**: Settings (Basic Info, Other), New Loan (Loan Details), New Customer (Additional Details), New Business (Import), Record Payment (Loan Summary), Bulk Posting (Details).
- **Android Download Fix**: DOM-attached anchors with delayed blob URL revocation.
- **Zero-Downtime Deploy**: Script tags image as both names, uses --no-build flag.

## Session Memory

- Full session log: `Memory/session_2026_10_03.md`
- CI/CD scripts reference: `Memory/cicd_scripts.md`
- Document to generate: `output/01_Functional_Technical_Specification.md` (23 sections, pending)

## Deployment

- SSH: `ssh -i ssh_Keys/ssh-key-2026-10-01.key opc@80.225.201.199`
- Always copy PostgreSQL schema before build: `cp deploy/prisma.schema.postgresql prisma/schema.prisma`
- Tag image as BOTH `dailyfinance_app:latest` AND `deploy-app:latest`
- Use `--no-build` with docker compose
- Do NOT deploy without user confirmation

## Conventions

- Output files go in `output/` directory
- Do not auto-commit without asking
- Do not deploy to OCI without asking
- ssh_Keys/ is in .gitignore — never stage it
- Local dev: kill node, rm -rf .next + node_modules/.cache, then npm run dev
