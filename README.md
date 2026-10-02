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

## Features

### Loan Management
- **Collection Types** — Daily, Weekly, and Monthly loan collection schedules
- **Interest Models** — ADDON (interest added on top) and UPFRONT (interest deducted before disbursement)
- **Monthly Quick-Select** — Quick-select buttons [3–12 months] with ×1.40 multiplier for monthly loans
- **Weekly Installments** — Enter installment amount; weeks auto-calculated
- **Auto-Generated Schedules** — Payment schedules skip Sundays/holidays for daily, respect weekly/monthly patterns
- **Loan Renewals** — Link new loans to existing active loans with balance carry-forward
- **View Loan Details** — Full loan detail modal with all fields and schedule table
- **Payment History** — View all payments for a loan with summary (repayable/paid/outstanding)
- **Share PDF & WhatsApp** — Download loan PDF or share summary via WhatsApp
- **Edit & Delete** — Inline action bar for editing or deleting loans

### Customer Management
- **Customer Profiles** — Full name, phone, Aadhaar (hashed), location, guarantor, photo
- **View Customer Details** — Detail modal with financial summary (total principal, repayable, paid, outstanding)
- **Customer Ratings** — Auto-calculated 1–4 scale based on repayment history
- **Share PDF & WhatsApp** — Download customer PDF or share summary via WhatsApp
- **Edit & Delete** — Inline action bar for editing or deleting customers

### Payments
- **Individual Posting** — Search a customer and record a single payment
- **Bulk Posting** — Collect payments for all customers in a location at once
- **View Payments** — Search by customer name/phone/ID and view full payment history with totals

### Reports & Exports
- **Six Report Types** — Customers, Loans, Villages, Employees, Payments, Collection Payslips
- **PDF Generation** — Server-side PDF generation using pdfkit
- **Excel Export** — Styled XLSX exports with formatted headers

### Security & Access Control
- **Role-Based Access** — Platform Admin, Owner, Business Admin, Agent (36 permissions)
- **Two-Factor Authentication** — TOTP-based 2FA for admins and owners
- **Aadhaar Protection** — SHA-256 hashed, only last 4 digits stored
- **Rate Limiting** — Login lockout, registration throttling
- **Data Isolation** — Strict per-owner data separation at the query level

### Progressive Web App (PWA)
- **Installable** — Add to home screen on Android and iOS
- **Offline Fallback** — Branded offline page when network is unavailable
- **App Shell Caching** — Faster repeat visits via service worker cache

## Production Deployment

Deployed on Oracle Cloud Always Free ARM VM (VM.Standard.A1.Flex):
- Docker Compose: Next.js app + PostgreSQL + DuckDNS dynamic DNS
- Automated database backups
- Zero-downtime deployment via safe-deploy script

---

Internal Use Only
