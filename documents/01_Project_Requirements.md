# Sections 1–3: Project Description, Functional Specs, Non-Functional Requirements

---

## 1. Project Description and Requirements

### 1.1 Overview

**Daily Finance** is a multi-tenant microfinance collection management platform designed for daily, weekly, and monthly lending businesses operating in Andhra Pradesh/Telangana, India. The platform enables business owners to manage customers, disburse loans, track repayment collections, and generate financial reports.

### 1.2 Target Users

| Role | Description | Typical User |
|------|-------------|-------------|
| Platform Admin | Manages organizations, approves registrations, manages employee passwords, platform settings | System administrator |
| Owner | Owns 1+ businesses, manages agents, views reports | Finance business owner |
| Business Admin | Manages a single business on behalf of owner | Office manager |
| Agent | Collects payments, records transactions in the field | Field collection agent |

### 1.3 Business Context

- **Market**: Micro-lending businesses in South India (Andhra Pradesh, Telangana)
- **Currency**: Indian Rupees (₹), stored internally as paise (1 ₹ = 100 paise) to avoid floating-point errors
- **Timezone**: IST (UTC+5:30) — all dates pinned to Indian Standard Time
- **Collection Models**: Daily (installments every working day), Weekly (fixed day per week), Monthly (fixed day per month)
- **Interest Models**: ADDON (interest added on top of principal) and UPFRONT (interest deducted before disbursement)
- **National ID**: Aadhaar numbers are SHA-256 hashed; only last 4 digits stored

### 1.4 Key Requirements

1. Multi-owner, multi-business architecture with complete tenant isolation
2. Four-tier role hierarchy with 36 granular permissions (RBAC)
3. Loan lifecycle: Disbursement → Collection scheduling → Payment posting → Overdue/Defaulter → Settlement/Write-off/Renewal
4. Configurable per-business: repayment multiplier, grace period, defaulter period, collection days
5. Bulk operations: CSV import for customers/loans/payments, bulk payment posting by village, customer merge
6. Financial reporting: Collections, loans, villages, employees — PDF and XLSX export
7. Mobile-first responsive UI for field agents on Android phones
8. Self-service registration with admin approval workflow
9. Business data export/import for migration between accounts
10. Zero-downtime deployment on OCI cloud
11. Telugu (తెలుగు) language support with full i18n across all pages
12. Manual loan status override for owner/admin control
13. UI rebrand: "Business" terminology replaced with "Collection" across all labels
14. Organization model with separate org name, OrgID, and profile management
15. Customer merge for deduplication (select 2+ → pick master → consolidate loans)
16. System-wide banner for platform announcements
17. Daily Collection Summary report with Paid/Unpaid status tracking
18. Dashboard auto-refresh (60-second interval)

### 1.5 Data Hierarchy

```
Platform Admin
  └── Owner
        └── Business (Daily/Weekly/Monthly)
              ├── Village (Location)
              │     └── Customer
              │           └── Loan
              │                 ├── LoanScheduleEntry
              │                 └── Payment
              └── Employee (Agent/Business Admin)
                    ├── UserBusinessAssignment
                    └── UserVillageAssignment
```

---

## 2. Functional Specifications

### 2.1 Authentication & Authorization

| Feature | Description |
|---------|-------------|
| Login | Username + password, JWT stored in httpOnly cookie |
| Registration | Self-service with admin approval workflow; Organization Name, Owner Name, City (required), Email (required), Login Details sections; phone duplicate check; approval creates Owner account only (no auto-collection creation); old approved requests cleaned up for username reuse |
| Forgot Password | Accepts username OR phone number; Agent resets go to Owner, Owner resets go to Platform Admin; Platform Admin forgot password auto-resets to "system" (no approval needed); Password reset to username automatically; `mustChangePassword` forced on first login after reset |
| Change Password | Forced on first login (`mustChangePassword` flag) |
| 2FA | TOTP-based (Google Authenticator) via otplib + qrcode |
| Session | JWT with configurable expiry; Owner sessions persist until manual logout (1-year expiry, no inactivity timeout); Agents/BA keep 30-min inactivity timeout |

### 2.2 Customer Management

| Feature | Description |
|---------|-------------|
| Create Customer | Full Name (required), Phone (optional), Village (required), Photo, Age, Address, Aadhaar, Guarantor |
| Edit Customer | All fields editable |
| CSV Bulk Import | Upload CSV with validation → preview → confirm (max 500) |
| Customer Detail | Financial summary, loan list, payment history, PDF/WhatsApp share |
| Search | By name, phone, customer ID, address, aadhaar last 4, guarantor |
| Filters | Multi-select status (Active, Overdue, Defaulter, Completed, No Loans), Village |
| Table View | Sortable columns, pagination (15 desktop, 10 mobile) |
| Bulk Actions | Select multiple → delete (with confirmation) |
| Customer Merge | Select 2+ customers → Merge button → pick Master customer → all loans moved to Master, duplicate customers deleted; requires typing "MERGE" to confirm |

### 2.3 Loan Lifecycle

| Stage | Description |
|-------|-------------|
| **Create** | Select customer → Loan Details (agent, date, interest model) → Loan Payment (principal, installments, total repayment) → Auto-calculate schedule |
| **Active** | Installments due per schedule, agents collect payments |
| **Overdue** | Past expected end date + grace period |
| **Defaulter** | More than configurable defaulter period (default 365 days) past grace period end |
| **Completed** | Total paid ≥ total repayable (auto-completes on last payment) |
| **Paused** | Manually paused by owner |
| **Settled** | Settled for less than full amount (with reason) |
| **Written Off** | Bad debt written off (with reason) |
| **Renewal** | Create new loan from existing, old loan marked COMPLETED |

**Manual Status Override:**
- Owner/Admin can override derived loan status via Edit Loan → Loan Status dropdown
- Options: Auto (default derived), Active, Overdue, Defaulter, Completed
- Setting to Active restarts loan lifecycle from today (virtual restart)
- Override tracked with `statusOverride` and `statusOverrideDate` fields

**Loan Defaults:**
- Repayment multiplier: 1.20 for Daily/Weekly, 1.40 for Monthly (configurable per business)
- Defaulter period: configurable per business (default 365 days), replaces hardcoded 1-year logic
- Agent auto-selected based on customer's village assignment
- Schedule auto-generated from start date + collection type + business collection days
- No backdate limit on loan creation date (previously 30 days)

### 2.4 Payment Posting

#### Individual Payment (New Payment)
- Date filter with "Payment Completed" checkbox (shows paid vs pending customers)
- Only shows customers with ACTIVE loans started on/before posting date
- Default amount = expected installment (editable)
- Payment mode: Cash/UPI toggle (default Cash)
- Agent defaults to loan's assigned agent (editable)
- Loan summary collapsible with outstanding info
- Post & Next flow for rapid entry
- Customer names clickable (link to customer profile)
- Loan-level payment tracking with Paid/Pending badges per loan

#### Bulk Payment (Bulk Posting)
- Select Location (default: All Locations)
- 10 records per page with Prev/Next navigation
- Default amount = installment amount for each loan
- Submit (shows result) + Submit & Next (auto-loads next batch)
- Payment mode: Cash/UPI
- Payment Completed checkbox filter
- Defaulter checkbox (unchecked by default): shows Active + Overdue only; when checked, includes Defaulters
- Details section collapsible (posting date, submission date, collector, payment mode)
- Customer names clickable (link to customer profile)
- No backdate limit on payment posting date (previously 1 month)

#### View Payments
- Paid/Unpaid/Expected/Collected stats bar above table
- Unpaid count links to Bulk Posting page
- Date presets: Today, Yesterday, 7 Days, 15 Days, 30 Days, All, Custom
- Custom filters: Village + Employee multi-select
- Sortable table: Date, Customer, Village, Amount, Collector, Mode, Receipt
- Pagination (25 default)
- Desktop: Download PDF + XLSX; Mobile: Share via WhatsApp
- Clickable customer and collector names

### 2.5 Reports

| Report | Contents | Export |
|--------|----------|--------|
| Daily Collection Summary | All active loans with Paid/Unpaid status for selected date; Payment Status filter (All/Paid/Unpaid); default report type; default date preset "Today" | PDF, XLSX |
| Customers | All customers with CID, status, village, guarantor (no Age column) | PDF, XLSX |
| Loans | All loans with CID, amounts, status, agent, Start Date, Due Date (no Phone/Interest columns) | PDF, XLSX |
| Payments | Payment history with receipts (no Phone column) | PDF, XLSX |
| Villages | Per-village summary + per-village customer breakdown | PDF, XLSX |
| Employees | Per-employee collections and disbursements | PDF, XLSX |

### 2.6 Business Settings

| Setting | Description |
|---------|-------------|
| Basic Info | Collection ID and Collection Name only (city, address, phone, receipt prefix removed) |
| Collection | Type (read-only), collection day/days, repayment multiplier, grace period, defaulter period |
| Other | Auto-logout minutes (collapsible) |
| Export Data | Download full collection data as XLSX |
| Danger Zone | Delete collection (requires typing "DELETE" in modal) |

### 2.7 Employee Management

#### Global (Owner Objects → Manage Employees)
- Owner shown as first row (gold accent, "All Villages")
- Create employees with username, password, role (Agent/Business Admin)
- Edit, Reset Password (to username), Suspend/Activate, Delete
- Shows assigned businesses per employee

#### Collection-Scoped (Collection → Employees)
- Assign/unassign employees to the collection (checkbox)
- Per-employee village assignment (multi-select pills)
- View button → employee activity page
- Only visible to Owner/Admin (hidden from agents)

#### Employee Activity Page
- Date presets (Today, Yesterday, 7 Days, 1 Month) + village filter
- Collections stats (total collected, payment count) + collapsible table
- Disbursements stats (total disbursed, loan count) + collapsible table
- Agent dashboard redirects here

### 2.8 Business Import from XLSX

- Upload previously exported business XLSX file
- Test button validates structure, data types, cross-references
- Per-sheet pass/fail report with error details
- Import creates: Business → Villages → Users → Assignments → Customers → Loans (with schedule) → Payments
- Sample template download available
- Collapsible section on New Business page

### 2.9 UI Rebrand (Session 2026-10-05)

- "Business" terminology replaced with "Collection" across all user-facing labels:
  - My Businesses → My Collections
  - New Business → New Collection
  - Select Business → Select Collection
  - Business Settings → Collection Settings
  - Business Dashboard → Collection Dashboard
  - Record Payment → New Payment (everywhere)
- Header displays dynamic organization name (from `organizationName` field, falls back to first business name) instead of static "Daily Finance"
- Register page: Organization Name field, Owner Name field, City (required), Email (required), Login Details sections
- Sidebar: Collection section reordered: New Payment, New Customer, New Loan, Location, Employees, Reports, Settings. Settings moved from Owner to Collection section. FAQ renamed to "Help". Password Resets renamed to "Employee Password Management". "Manage Owners" renamed to "Organizations".
- Settings page labels: Collection ID (was Business ID), Collection Name only
- Owner pre-selected as default agent in New Collection form

### 2.10a Organization Model (Session 2026-10-06)

- `User.organizationName` field added (separate from business/collection names)
- OrgID = Owner's user ID (displayed in admin Organizations table and profile page)
- Profile page: Organization Details section with 5 editable fields (org name, owner name, phone, email, city)
- Header shows `organizationName` (falls back to first business name)
- `PATCH /api/profile/organization` endpoint for update and delete
- Removed: My Collections section from profile, edit button from profile card (edit via Organization Details instead)
- Danger Zone on profile: Delete Organization (owner only, blocked if collections exist)

### 2.10b Admin Page Redesign (Session 2026-10-06)

- Owners page redesigned as "Organizations" table view
- Columns: #, OrgID, Organization, Owner, City, Phone, Email, Collections, Customers, Loans, Payments, Created, Last Login, Status
- Search by OrgID, org name, owner, username, city, phone, email
- Pagination: 10 per page, sorted by last login descending
- "+ Register New Business" button (links to /register)
- Refresh button to reload data
- Removed: Edit Owner, Reset Password from actions menu
- Renamed: Suspend/Delete Owner → Suspend/Delete Organization
- Delete requires typing "DELETE" + force delete checkbox for cascade delete
- Force delete cascade deletes all businesses, data, and orphaned agents (fully deleted, not just deactivated)
- Removed dead code: admin/owners/new and admin/owners/[ownerId]/edit pages

### 2.10c System Banner (Session 2026-10-06)

- Platform Settings: new Banner tab
- Yellow banner displayed at top of all pages when message is set
- Stored as `system_banner` key in PlatformSetting model
- Admin can set/clear banner message via Platform Settings

### 2.10d Customer Merge (Session 2026-10-06)

- Select 2+ customers from customer list → Merge button appears
- Pick Master customer → all loans from duplicate customers moved to Master
- Duplicate customers deleted after loan transfer
- Requires typing "MERGE" to confirm
- `POST /api/b/{businessId}/customers/merge` endpoint

### 2.10 Telugu Language Support (i18n)

- Full Telugu (తెలుగు) language support across all pages
- 20 translation files: `locales/en/` and `locales/te/` with 10 namespaces each (common, auth, customers, loans, payments, dashboard, settings, employees, reports, villages)
- Custom i18n provider with `useTranslation()` hook
- Language switcher on: login page, register page, profile page, header dropdown
- `preferredLanguage` field on User model, persisted via `PATCH /api/profile/language`
- Noto Sans Telugu font loaded from Google CDN
- Platform Admin always displays in English (not affected by language switch)
- Collapsible sections on Profile page: Change Password, My Collections

### 2.11 Dashboard

#### Owner Dashboard
- Today's stats: New Loans, Disbursed amount, Collection amount
- My Collections list with outstanding and today's collection
- "+ New Collection" button at top
- 60-second auto-refresh (AutoRefresh component)

#### Collection Dashboard
- Top stats: Loans (amount + count), Repayable, Outstanding
- Clickable: Customers, Loans, Employees (link to respective pages)
- Date filter: Today, Yesterday, 7 Days, 1 Month, Custom
- Custom: Date range + Village multi-select + Employee multi-select
- Today's Collection section: Expected, Collected, New Loans, Paid count (links to View Payments), Unpaid count (links to Bulk Posting), Completed Loans
- "In Hand" stat removed
- Loan status badges (clickable, link to filtered loans page)
- 60-second auto-refresh (AutoRefresh component)

#### Agent Dashboard
- Redirects to employee activity page (`/b/{id}/users/{userId}`)

### 2.12 Collection Creation (Session 2026-10-06)

- New Collection form: Basic Info section removed (city, phone, address, receipt prefix no longer collected at creation)
- Collection Name moved to Collection Settings section
- Import: added Collection Type, Collection Days, Repayment Multiplier fields
- Import: zero-amount (₹0) payments accepted during import
- Import: city defaults to "Default" when not specified

### 2.13 Loan Detail & Loans Page (Session 2026-10-06)

- Loans page: "New Payment" button replaces "Payments" button
- Loan detail modal: payment history replaces repayment schedule display
- Loans list: Due Date column added

---

## 3. Non-Functional Requirements

### 3.1 Performance
- Page load: < 2 seconds for all pages
- API response: < 500ms for standard queries
- Bulk operations: Support up to 500 records per import
- Database: SQLite for dev, PostgreSQL 16 for production with indexes on frequently queried fields

### 3.2 Scalability
- Multi-tenant: Owner isolation via `ownerId`, Business isolation via `businessId`
- Horizontal: Docker container, can scale via load balancer (future)
- Database: PostgreSQL supports concurrent users (production)

### 3.3 Availability
- Production: OCI Always Free Tier VM (6GB RAM, ARM)
- Zero-downtime deployment via blue-green Docker swap
- Automated daily database backups
- Nginx reverse proxy with static asset caching

### 3.4 Mobile-First Design
- Responsive Tailwind CSS (mobile breakpoint: 768px)
- Touch-friendly: large buttons, swipe-friendly tables
- Bulk upload sections hidden on mobile
- Smaller date inputs on mobile (`text-xs py-1.5`)
- Mobile header: only Customers, Loans, Payments icons

### 3.5 Browser Support
- Chrome (Android + Desktop) — primary
- Safari (iOS) — secondary
- Samsung Internet — supported
- Edge, Firefox — supported

### 3.6 Data Integrity
- Money stored as integers (paise) — no floating-point errors
- All writes in Prisma transactions — atomic operations
- Unique constraints: `[businessId, customerId]`, `[businessId, loanNumber]`, `[businessId, receiptNumber]`, `[businessId, villageName]`
- Soft delete for payments (`isDeleted` flag)

---

**Footer:** Confidential — Daily Finance
