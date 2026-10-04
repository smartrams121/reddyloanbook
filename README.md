# Daily Finance — Collection Management Platform

A multi-owner microfinance collection management system for daily, weekly, and monthly lending businesses in India.

---

## Technology Stack

| Category | Tool/Technology | Version | Why We Used It |
|----------|----------------|---------|---------------|
| **Framework** | Next.js (App Router) | 14.2.35 | Full-stack React framework — SSR, API routes, file-based routing, middleware all in one |
| **Language** | TypeScript | 5.x | Type safety catches bugs at compile time, better IDE support |
| **UI Styling** | Tailwind CSS | 3.x | Utility-first CSS — rapid mobile-first responsive design without custom CSS |
| **ORM** | Prisma | 5.22.0 | Type-safe database queries, auto-generated client, easy schema migrations |
| **Database (Dev)** | SQLite | Embedded | Zero-config local development — no server needed, single file |
| **Database (Prod)** | PostgreSQL | 16 | Production-grade relational DB with concurrency, ACID transactions |
| **Auth - Passwords** | bcryptjs | 2.4.x | Industry-standard password hashing (12 salt rounds) |
| **Auth - Sessions** | jsonwebtoken | 9.x | JWT tokens for stateless session management in httpOnly cookies |
| **Auth - 2FA** | otplib + qrcode | 12.x | TOTP-based two-factor auth (Google Authenticator compatible) |
| **Validation** | Zod | 3.22.x | Runtime schema validation — validates every API request body |
| **Excel Export** | ExcelJS | 4.4.0 | Generate styled XLSX files for reports and business data export |
| **PDF Generation** | pdfkit | 0.20.2 | Server-side PDF creation for receipts, reports, customer statements |
| **Testing** | Vitest | 1.x | Fast test runner, TypeScript-native, compatible with Jest API |
| **Container** | Docker | Latest | Consistent deployment — same environment dev to production |
| **Orchestration** | Docker Compose | v2 | Multi-container management (app + PostgreSQL) with health checks |
| **Reverse Proxy** | Nginx | Latest | HTTP proxy, static asset caching, future SSL termination |
| **Cloud** | Oracle Cloud (OCI) | Always Free | Free ARM VM (6GB RAM) — zero infrastructure cost |
| **DNS** | DuckDNS | Free | Dynamic DNS for the server's public IP |
| **Version Control** | Git + GitHub | - | Source code management, commit history, collaboration |
| **AI Development** | Claude Code | Opus 4.6 | AI pair programming — code generation, debugging, deployment |
| **IDE** | VS Code | Latest | Primary development environment with Claude Code extension |
| **Package Manager** | npm | 10.x | Node.js dependency management |

---

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

### Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run test         # Run all tests
npm run test:watch   # Watch mode
npm run db:generate  # Prisma generate
npm run db:push      # Push schema to DB
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio (visual DB browser)
npm run db:reset     # Reset database and re-seed
npm run setup        # Full setup (install + generate + push + seed)
```

---

## Data Hierarchy

```
Platform Admin → Owner → Business → Village → Customer → Loan → Payments
```

## Architecture

| Layer | Components |
|-------|-----------|
| Client | Browser (Desktop + Mobile), Responsive Tailwind UI |
| Proxy | Nginx reverse proxy (:80 → :3000) |
| Application | Next.js 14 App Router (Server + Client Components, API Routes, Middleware) |
| Services | Auth (JWT+bcrypt), RBAC (36 permissions), Tenant Isolation, Zod Validation |
| Data | Prisma ORM → SQLite (dev) / PostgreSQL (prod), File uploads |

---

## Features

### Loan Management
- **Collection Types** — Daily, Weekly, and Monthly collection schedules
- **Interest Models** — ADDON (principal × configurable multiplier) and UPFRONT (interest deducted before disbursement)
- **Configurable Multiplier** — Per-business repayment multiplier (default 1.20 daily/weekly, 1.40 monthly)
- **Auto-Generated Schedules** — Payment schedules skip non-collection days
- **Loan Lifecycle** — Active → Overdue → Defaulter → Completed / Settled / Written Off
- **Grace Period** — Configurable per business before loan becomes overdue
- **CSV Bulk Import** — Upload loans via CSV file
- **Sortable Table** — Sort by customer, loan #, date, amount, agent, status with pagination

### Customer Management
- **Customer Profiles** — Name, phone (optional), location, photo, Aadhaar (hashed), guarantor
- **Collapsible Additional Details** — Photo, age, job type, address, guarantor in expandable section
- **CSV Bulk Import** — Upload customers via CSV (max 500)
- **Sortable Table** — Sort by name, phone, location, status, loans with pagination
- **Multi-select Filters** — Filter by Active, Overdue, Defaulter, Completed, No Loans, Village

### Payment Posting
- **Individual Payment** — Date filter, Payment Completed checkbox, default installment amount, Cash/UPI mode
- **Bulk Posting** — All locations or per-village, 10 per page, Submit & Next, auto-fill installments
- **View Payments** — Date presets (Today/Yesterday/7d/15d/30d/All/Custom), village + employee filters, sortable table
- **Agent Defaults** — Agent auto-selected from loan assignment, payment mode defaults to Cash
- **Desktop** — Download PDF + XLSX
- **Mobile** — Share PDF/XLSX via WhatsApp

### Employee Management
- **Global Management** — Create, edit, reset password, suspend, delete employees
- **Business Assignment** — Assign employees to businesses with village-level access control
- **Activity Dashboard** — Collections + disbursements with date/village filters
- **Agent Isolation** — Agents only see their own loans, assigned villages, and their payments

### Business Management
- **Create Business** — Name, city, collection type, multiplier, locations
- **Import from XLSX** — Upload exported business data to recreate with all data (Test → Import flow)
- **Export Data** — Download full business data as XLSX (5 sheets)
- **Settings** — Collapsible sections: Basic Info, Collection (multiplier, grace period), Other (WhatsApp, auto-logout)
- **Danger Zone** — Delete requires typing "DELETE" in confirmation modal

### Dashboard
- **Owner Dashboard** — Today's new loans, disbursed, collection across all businesses
- **Business Dashboard** — Stats grid (loans/repayable/outstanding, customers/loans/employees), date + village + employee filters
- **Agent Dashboard** — Redirects to personal activity page with collections/disbursements

### Reports & Exports
- **Six Report Types** — Customers, Loans, Villages, Employees, Payments
- **PDF + XLSX** — Download or share via WhatsApp
- **Date Range Filters** — All reports support custom date ranges

### Security & Access Control
- **4-Tier RBAC** — Platform Admin, Owner, Business Admin, Agent (36 permissions)
- **Tenant Isolation** — Business-level data separation enforced at API layer
- **Agent Scoping** — Village-level access control, own loans/payments only
- **Aadhaar Protection** — SHA-256 hashed, only last 4 digits stored
- **2FA** — TOTP-based for admins and owners
- **Rate Limiting** — Login and registration endpoints

### UI/UX
- **Mobile-First** — Responsive design, touch-friendly, smaller inputs on mobile
- **Desktop Header** — Customers, Locations, Loans, Payments, New Payment, Bulk Payments, Employees, Reports, Dashboard
- **Mobile Header** — Customers, Loans, Payments only
- **Collapsible Sections** — Settings, loan details, customer details, posting details
- **Pagination** — 15 desktop / 10 mobile default, options: 10/15/25/50/100/All
- **Sortable Tables** — Click column headers to sort ascending/descending
- **Android Fix** — DOM-attached anchors for file downloads (not window.open)

---

## Production Deployment

| Component | Detail |
|-----------|--------|
| Server | OCI Always Free ARM VM (VM.Standard.A1.Flex, 6GB RAM) |
| OS | Oracle Linux 9 |
| App | Docker container (Next.js standalone) |
| Database | PostgreSQL 16 (Docker container) |
| Proxy | Nginx reverse proxy |
| DNS | DuckDNS dynamic DNS |
| Deploy | Zero-downtime via blue-green Docker swap |
| Backup | Automated daily pg_dump |

### Deploy Command

```bash
ssh -i ssh_Keys/ssh-key.key opc@<server-ip>
cd /opt/dailyfinance
sudo bash deploy/scripts/zero-downtime-deploy.sh
```

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/          Login, register, forgot-password, change-password
│   ├── (main)/          Authenticated app pages
│   │   ├── dashboard/   Owner combined dashboard
│   │   ├── employees/   Global employee management
│   │   ├── businesses/  New business + XLSX import
│   │   ├── b/[id]/      Business-scoped pages
│   │   │   ├── dashboard/   Business dashboard + filters
│   │   │   ├── customers/   List, detail, new, edit, CSV upload
│   │   │   ├── loans/       List, new, edit, CSV upload
│   │   │   ├── posting/     Individual, bulk, view payments
│   │   │   ├── villages/    Location management
│   │   │   ├── employees/   Employee assignment
│   │   │   ├── reports/     Report viewer + download
│   │   │   └── settings/    Business settings + export
│   │   └── admin/       Platform admin
│   └── api/             REST API routes
├── lib/                 Core utilities (auth, loans, payments, schedule, etc.)
├── components/          React components (AppShell, UI)
└── middleware.ts        Auth + route protection
prisma/
├── schema.prisma        Database schema (18 models)
└── seed.ts              Test data seeder
documents/               Technical specification (7 files, 23 sections)
deploy/                  Docker, Nginx, deployment scripts
tests/                   Unit + integration tests
```

---

## Documentation

Full technical specification available in [`documents/`](documents/00_Index.md) — 23 sections covering requirements, architecture, data model, RBAC, API reference, security, compliance, CI/CD, and more.
