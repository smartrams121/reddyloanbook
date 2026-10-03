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

## Recent Features

- **Business Import**: Upload exported XLSX to recreate a business with all data (villages, customers, loans, payments, employees). Test → Import flow with sample template download.
- **CSV Bulk Upload**: Loans and Payments pages support CSV bulk import (same pattern as customer CSV upload). Hidden on mobile.
- **Configurable Repayment Multiplier**: Per-business setting in Collection section (replaces hardcoded 1.20/1.40).
- **Grace Period in Overdue Logic**: Loan stays ACTIVE for grace period after expected end date before becoming OVERDUE.
- **Dashboard Filters**: Custom date range with village and employee multi-select filters for collection metrics.
- **Multi-select Status Filters**: Customers and Loans pages support selecting multiple status filters simultaneously.
- **Android Download Fix**: All file downloads and WhatsApp shares use DOM-attached anchors with delayed blob URL revocation for Android browser compatibility.
- **Danger Zone Confirmation**: Business delete requires typing "DELETE" in a modal.

## Conventions

- Output files go in `output/` directory
- Do not auto-commit without asking
