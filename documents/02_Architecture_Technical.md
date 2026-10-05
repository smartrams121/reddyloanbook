# Sections 4–6: Architecture, Technical Specs, Code Explanation

---

## 4. High-Level Architecture

### 4.1 System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Desktop      │  │  Mobile Web  │  │  API Consumer (curl) │   │
│  │  Browser      │  │  (Android/   │  │                      │   │
│  │  (Full UI)    │  │   iOS)       │  │                      │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
└─────────┼─────────────────┼─────────────────────┼───────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                     NGINX REVERSE PROXY (:80)                     │
│  - SSL termination (future)                                       │
│  - Static asset caching (/_next/static/ → 365d)                   │
│  - Proxy to Next.js (:3000)                                       │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│                     APPLICATION LAYER                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Next.js 14 App Router (Node.js)               │  │
│  │                                                            │  │
│  │  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌────────────┐ │  │
│  │  │ API Route│ │ Server     │ │ Client   │ │ Middleware  │ │  │
│  │  │ Handlers │ │ Components │ │ Comps    │ │ (Auth Guard)│ │  │
│  │  └────┬─────┘ └────────────┘ └──────────┘ └────────────┘ │  │
│  └───────┼────────────────────────────────────────────────────┘  │
│          │                                                       │
│  ┌───────▼────────────────────────────────────────────────────┐  │
│  │                    SERVICE LAYER (src/lib/)                 │  │
│  │  auth.ts │ permissions.ts │ scope.ts │ validators.ts       │  │
│  │  loan-status.ts │ schedule.ts │ loan-calc.ts │ money.ts    │  │
│  │  date.ts │ receipt.ts │ csv-parse.ts │ xlsx-import.ts      │  │
│  │  rate-limit.ts │ whatsapp.ts │ constants.ts │ i18n.ts      │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Prisma ORM (prisma-client-js v5.22.0)         │  │
│  └────────────────────────┬───────────────────────────────────┘  │
│                           │                                      │
│  ┌────────────────────────▼───────────────────────────────────┐  │
│  │  SQLite (dev: file:./dev.db)                                │  │
│  │  PostgreSQL 16 (prod: Docker container)                     │  │
│  │  18 tables, 25+ indexes                                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              File System (./uploads/)                       │  │
│  │              Customer photos, loan documents                │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Request Flow

```
Browser Request
  → Next.js Middleware (middleware.ts)
    → Check JWT cookie → redirect to /login if missing
    → Check route permissions → redirect if unauthorized
  → API Route Handler (src/app/api/...)
    → getSession() — cookie → JWT → DB lookup → AuthUser object
    → assertBusinessAccess(user, businessId) — tenant isolation
    → assertPermission(user, action) — RBAC check
    → Zod schema validation (request body)
    → Prisma ORM query → Database
    → JSON Response (or file stream for PDF/XLSX)
```

### 4.3 Deployment Architecture (Production)

```
┌─────────────────────────────────────────────────────┐
│  OCI Compute Instance (VM.Standard.A1.Flex, ARM)    │
│  Oracle Linux 9, 6GB RAM, 50GB storage              │
│                                                     │
│  ┌──────────┐    ┌──────────┐    ┌───────────┐     │
│  │  Nginx   │───▸│ Next.js  │───▸│PostgreSQL │     │
│  │  :80     │    │ :3000    │    │ :5432     │     │
│  │ (reverse │    │ (Docker) │    │ (Docker)  │     │
│  │  proxy)  │    │          │    │           │     │
│  └──────────┘    └──────────┘    └───────────┘     │
│                                                     │
│  Volumes: postgres_data, app_uploads                │
│  DuckDNS: Dynamic DNS                               │
│  Cron: Daily DB backup, session cleanup             │
└─────────────────────────────────────────────────────┘
```

---

## 5. Technical Specifications

### 5.1 Framework & Runtime

| Spec | Detail |
|------|--------|
| Framework | Next.js 14.2.35 (App Router) |
| Language | TypeScript 5.x (strict mode) |
| Runtime | Node.js 18+ |
| Styling | Tailwind CSS 3.x (utility-first, mobile-first) |
| ORM | Prisma 5.22.0 with prisma-client-js |
| Database | SQLite (dev), PostgreSQL 16 (prod) |
| Package Manager | npm |

### 5.2 Authentication

| Spec | Detail |
|------|--------|
| Password Hashing | bcryptjs, 12 salt rounds |
| Session Token | JWT (jsonwebtoken), stored in httpOnly cookie |
| Session Expiry | Configurable (default 24 hours) |
| 2FA | TOTP via otplib + qrcode (Google Authenticator compatible) |
| Route Protection | middleware.ts — checks cookie, redirects unauthenticated |

### 5.3 Data Conventions

| Convention | Implementation |
|------------|---------------|
| Money | Stored as integers in paise (1 ₹ = 100 paise). Display: `÷100` |
| Dates | Stored as `YYYY-MM-DD` strings. Display: `DD/MM/YYYY` |
| Timezone | IST (UTC+5:30) — `nowIST()` in `src/lib/date.ts` |
| IDs | cuid() auto-generated strings |
| Aadhaar | SHA-256 hash stored, only last 4 digits in `aadhaarLast4` |
| Phone | Indian 10-digit mobile: `/^[6-9]\d{9}$/` (optional field) |
| Sequences | Per-business: `customerSeq`, `loanSeq`, `receiptSeq` |

### 5.4 Interest Models

| Model | Calculation | Amount Given to Customer |
|-------|------------|-------------------------|
| ADDON | totalRepayable = principal × multiplier | principal |
| UPFRONT | totalRepayable = principal + interest | principal − interest |

### 5.5 Loan Status (Resolved)

Status is determined by `resolveLoanStatus()` (replaces `deriveLoanStatus()`), which checks for manual override first, then falls back to time-based derivation.

| Resolved Status | DB Status | Condition |
|---------------|-----------|-----------|
| ACTIVE | ACTIVE | today ≤ expectedEndDate + gracePeriod; OR `statusOverride = ACTIVE` (virtual restart from override date) |
| OVERDUE | ACTIVE | today > expectedEndDate + gracePeriod, ≤ defaulterPeriodDays; OR `statusOverride = OVERDUE` |
| DEFAULTER | ACTIVE | today > defaulterPeriodDays past grace period end; OR `statusOverride = DEFAULTER` |
| COMPLETED | COMPLETED | totalPaid ≥ totalRepayable; OR `statusOverride = COMPLETED` |

**Manual Override**: Owner/Admin can set `statusOverride` via Edit Loan. Setting to "Auto" clears the override and reverts to derived logic. Setting to ACTIVE performs a virtual restart (loan lifecycle restarts from `statusOverrideDate`).

### 5.6 ID Format (per business)

| Entity | Format | Example |
|--------|--------|---------|
| Customer | `{prefix}-C{seq.padStart(4,'0')}` | SF-C0001 |
| Loan | `{prefix}-L{seq.padStart(5,'0')}` | SF-L00001 |
| Receipt | `{prefix}-{seq.padStart(5,'0')}` | SF-00001 |

### 5.7 Internationalization (i18n)

**Architecture:**
- Custom i18n provider (`src/lib/i18n.ts`) with React context
- `useTranslation(namespace)` hook returns `t(key)` function
- Translations loaded dynamically per locale/namespace
- User preference stored in `User.preferredLanguage` field (default: `en`)

**Supported Languages:**

| Code | Language | Font |
|------|----------|------|
| `en` | English | System default (Arial/sans-serif) |
| `te` | Telugu (తెలుగు) | Noto Sans Telugu (Google CDN) |

**Translation File Structure:**
```
src/locales/
├── en/                    English translations
│   ├── common.json        Shared labels (buttons, nav, errors)
│   ├── auth.json          Login, register, forgot password
│   ├── customers.json     Customer management
│   ├── loans.json         Loan management
│   ├── payments.json      Payment posting
│   ├── dashboard.json     Dashboard stats and labels
│   ├── settings.json      Business settings
│   ├── employees.json     Employee management
│   ├── reports.json       Report labels
│   └── villages.json      Village management
└── te/                    Telugu translations (same 10 files)
```

**Language Switcher Locations:**
- Login page (bottom)
- Register page (bottom)
- Profile page (language preference)
- Header dropdown menu

**Rules:**
- Platform Admin always sees English regardless of preference
- Language preference persisted via `PATCH /api/profile/language`
- Fallback: if a translation key is missing in Telugu, English is used

---

## 6. Code Explanation

### 6.1 Directory Structure

```
src/
├── app/
│   ├── (auth)/              Auth pages (login, register, forgot-password, change-password)
│   ├── (main)/              Authenticated app pages
│   │   ├── dashboard/       Owner combined dashboard
│   │   ├── employees/       Global employee management
│   │   ├── businesses/new/  New business creation + XLSX import
│   │   ├── b/[businessId]/  Business-scoped pages
│   │   │   ├── dashboard/   Business dashboard + DateFilter
│   │   │   ├── customers/   Customer list, detail, new, edit, CSV upload
│   │   │   ├── loans/       Loan list, new, edit, CSV upload
│   │   │   ├── posting/     Payment hub, individual, bulk, view payments
│   │   │   ├── villages/    Village list, detail
│   │   │   ├── employees/   Employee assignment page
│   │   │   ├── users/       Employee detail, edit (legacy path, still used)
│   │   │   ├── reports/     Report viewer + download
│   │   │   ├── settings/    Business settings + export + danger zone
│   │   │   └── more/        Mobile menu page
│   │   ├── admin/           Platform admin pages
│   │   ├── faq/             FAQ accordion
│   │   └── profile/         User profile
│   └── api/                 REST API routes
│       ├── auth/            Login, logout, register, forgot-password, profile
│       ├── admin/           Platform admin APIs (owners, registrations, password resets)
│       ├── owner/           Owner APIs (businesses, agents, employees, villages)
│       ├── businesses/      Business creation + import
│       └── b/[businessId]/  Business-scoped APIs
│           ├── customers/   CRUD, bulk, import, [customerId] detail/pdf/report
│           ├── loans/       CRUD, bulk, import, [loanId] detail/pdf
│           ├── payments/    CRUD, bulk, import
│           ├── posting/     Village posting data
│           ├── villages/    CRUD, [villageId] detail
│           ├── employees/   Assignment management
│           ├── users/       User CRUD, [userId] activity
│           ├── reports/     JSON data + download (PDF/XLSX)
│           ├── settings/    Read/update + export
│           └── upload/      File upload handler
├── lib/                     Core utilities
├── locales/                 Translation files
│   ├── en/                  English (10 namespace JSON files)
│   └── te/                  Telugu (10 namespace JSON files)
└── components/              React components
    ├── layout/              AppShell (sidebar, header, navigation)
    └── ui/                  Reusable UI components
```

### 6.2 Core Libraries (`src/lib/`)

| File | Purpose |
|------|---------|
| `auth.ts` | `getSession()`, `hashPassword()`, `verifyPassword()`, JWT sign/verify, cookie management |
| `db.ts` | Prisma client singleton |
| `permissions.ts` | RBAC matrix — 36 permissions across 4 roles, `assertPermission()` |
| `scope.ts` | `assertBusinessAccess()` — tenant isolation, `getAccessibleVillageIds()` — village scoping for agents |
| `validators.ts` | Zod schemas: `createBusinessSchema`, `createCustomerSchema`, `createLoanSchema`, `createPaymentSchema`, `bulkPaymentSchema`, `createUserSchema` |
| `loan-status.ts` | `resolveLoanStatus()` — checks for manual override, then derives ACTIVE/OVERDUE/DEFAULTER/COMPLETED from dates + grace period + configurable defaulter period. Replaces `deriveLoanStatus()`. `deriveCustomerStatus()`. `getGracePeriod()` helper. |
| `loan-calc.ts` | `calculateLoan()` — totalRepayable, amountGiven, lastInstallmentAmount. `validateLoanAmounts()`. `calculateBalance()`. |
| `schedule.ts` | `generateSchedule()` — creates LoanScheduleEntry array from startDate + installments + collectionType + collectionDays. Handles DAILY (skip non-collection days), WEEKLY, MONTHLY. |
| `money.ts` | `formatPaiseShort()` — display ₹ with locale formatting. `rupeesToPaise()`. |
| `date.ts` | IST helpers: `nowIST()`, `todayIST()`, `formatDateISO()`, `formatDateDisplay()`, `parseISODate()`, `addDays()`, `addWeeks()`, `addMonths()`, `daysBetween()`. |
| `receipt.ts` | `nextReceiptNumber()`, `nextLoanNumber()`, `nextCustomerId()` — auto-increment sequences in Prisma transactions. |
| `csv-parse.ts` | Shared CSV parser: `parseCsvLine()` (handles quoted fields), `parseCsv<T>()` (generic typed). Used by customer, loan, payment CSV upload. |
| `xlsx-import.ts` | `parseBusinessXlsx()` — parses 5-sheet XLSX (Locations, Customers, Loans, Payments, Users) with cross-reference validation. Returns `ParseResult` with errors/warnings. |
| `xlsx-import-template.ts` | `generateImportTemplate()` — creates sample XLSX with correct headers, example rows, and Instructions sheet. |
| `constants.ts` | Enums: `Role`, `CollectionType`, `InterestModel`, `CustomerStatus`, `LoanStatus`, `DayOfWeek`, `DAY_OF_WEEK_JS_MAP`, `RATING_LABELS`. |
| `rate-limit.ts` | In-memory rate limiter for login/register endpoints. |
| `whatsapp.ts` | `buildWhatsAppUrl()` — constructs `wa.me` URLs with template variables. |
| `audit.ts` | Audit logging utility for sensitive operations. |
| `i18n.ts` | Internationalization provider, `useTranslation()` hook, locale/namespace loader, language context. |

### 6.3 Middleware (`src/middleware.ts`)

- Runs on every request before route handler
- Checks for JWT session cookie
- Redirects unauthenticated users to `/login`
- Allows public routes: `/login`, `/register`, `/forgot-password`, `/api/auth/*`
- Sets `x-user-id` header for downstream handlers

### 6.4 Components (`src/components/`)

| Component | Purpose |
|-----------|---------|
| `AppShell.tsx` | Main layout — sidebar navigation, header with business selector, role-based menu items, desktop/mobile navigation |
| `ResetPasswordModal.tsx` | Modal for password reset flow |

### 6.5 Key Page Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `CustomerList.tsx` | customers/ | Table with pagination, sort, multi-select, bulk actions |
| `LoanListClient.tsx` | loans/ | Table with pagination, sort, multi-select, bulk actions |
| `CsvBulkUpload.tsx` | customers/ | Customer CSV import with validate-then-confirm |
| `CsvBulkLoanUpload.tsx` | loans/ | Loan CSV import |
| `CsvBulkPaymentUpload.tsx` | posting/ | Payment CSV import |
| `VillageList.tsx` | villages/ | Village CRUD with pagination |
| `DateFilter.tsx` | dashboard/ | Date presets + village/employee filter for dashboard |
| `SearchBox.tsx` | customers/ | Reusable search input with URL param sync |
| `BusinessActions.tsx` | dashboard/ | Edit/Remove buttons for business cards |

---

**Footer:** Confidential — Daily Finance
