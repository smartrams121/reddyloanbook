# Daily Finance — Functional & Technical Specification Document

**Document Version:** 1.0
**Date:** 01/10/2026
**Client:** —
**Classification:** Internal Use Only
**Prepared By:** Development Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack](#3-technology-stack)
4. [Data Model & Entity Relationships](#4-data-model--entity-relationships)
5. [Role-Based Access Control (RBAC)](#5-role-based-access-control-rbac)
6. [Functional Specifications](#6-functional-specifications)
7. [API Endpoint Reference](#7-api-endpoint-reference)
8. [Sequence Diagrams](#8-sequence-diagrams)
9. [UML Class Diagrams](#9-uml-class-diagrams)
10. [Security Architecture](#10-security-architecture)
11. [SOX Compliance](#11-sox-compliance)
12. [Governance & Assumptions](#12-governance--assumptions)
13. [Non-Functional Requirements](#13-non-functional-requirements)

---

## 1. Executive Summary

**Daily Finance** is a multi-tenant finance collection management platform designed for micro-lending and daily/weekly/monthly loan collection businesses operating primarily in Andhra Pradesh/Telangana, India. The platform enables business owners to manage customers, disburse loans, track collections, and generate comprehensive reports.

### Key Capabilities

- **Multi-owner, multi-business** architecture with tenant isolation
- **Four-tier role hierarchy**: Platform Admin → Owner → Business Admin → Agent
- **Loan lifecycle management**: Disbursement, collection scheduling, payment posting, settlement, write-off, and renewal
- **Bulk operations**: CSV customer import, bulk payment posting, bulk loan actions
- **Financial reporting**: Collection reports, loan reports, village reports, employee activity, payslips, Excel/PDF export
- **Self-service registration** with admin approval workflow
- **Password reset** workflow with audit trail
- **Cash book** and expense tracking per business
- **Aadhaar (national ID) security**: SHA-256 hashing, only last 4 digits stored
- **IST timezone** pinned operations, DD/MM/YYYY display format
- **Money stored in paise** (integer, ÷100 at display layer) to avoid floating-point errors

---

## 2. Architecture Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Browser UI   │  │  Mobile Web  │  │  API Consumer (curl) │   │
│  │  (Next.js     │  │  (Responsive │  │                      │   │
│  │   React SSR)  │  │   Tailwind)  │  │                      │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
└─────────┼─────────────────┼─────────────────────┼───────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Next.js 14 App Router (Node.js)               │  │
│  │  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌────────────┐ │  │
│  │  │ API Route│ │ Server     │ │ Client   │ │ Middleware  │ │  │
│  │  │ Handlers │ │ Components │ │ Comps    │ │ (Auth Guard)│ │  │
│  │  └────┬─────┘ └────────────┘ └──────────┘ └────────────┘ │  │
│  └───────┼────────────────────────────────────────────────────┘  │
│          │                                                       │
│  ┌───────▼────────────────────────────────────────────────────┐  │
│  │                    SERVICE LAYER                            │  │
│  │  ┌────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐ │  │
│  │  │ Auth   │ │ Permissions│ │ Scope    │ │ Validators   │ │  │
│  │  │ (JWT + │ │ (RBAC      │ │ (Tenant  │ │ (Zod Schema) │ │  │
│  │  │ bcrypt)│ │  Matrix)   │ │  Isolat.)│ │              │ │  │
│  │  └────────┘ └────────────┘ └──────────┘ └──────────────┘ │  │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────────────┐  │  │
│  │  │ Rate Limit │ │ Date/IST   │ │ File Upload (fs)     │  │  │
│  │  │ (in-memory)│ │ Helpers    │ │                      │  │  │
│  │  └────────────┘ └────────────┘ └──────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Prisma ORM (prisma-client-js)                 │  │
│  └────────────────────────┬───────────────────────────────────┘  │
│                           │                                      │
│  ┌────────────────────────▼───────────────────────────────────┐  │
│  │              SQLite Database (file:./dev.db)                │  │
│  │              18 tables, 25+ indexes                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              File System (./uploads/)                       │  │
│  │              Customer photos, loan documents                │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
Browser → Next.js Middleware (auth redirect) → API Route Handler
  → getSession() (cookie → JWT → DB session → AuthUser)
  → assertPermission(user, action)
  → assertBusinessAccess(user, businessId)
  → Zod validation (request body)
  → Prisma ORM → SQLite
  → JSON Response
```

---

## 3. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js (App Router) | 14.2.35 | Full-stack React framework |
| Language | TypeScript | 5.x | Type-safe development |
| UI Styling | Tailwind CSS | 3.x | Utility-first CSS |
| ORM | Prisma | 5.22.0 | Database access & migrations |
| Database | SQLite | - | Embedded relational database |
| Auth - Hashing | bcryptjs | - | Password hashing (12 salt rounds) |
| Auth - Token | jsonwebtoken | - | JWT session tokens |
| Validation | Zod | - | Runtime schema validation |
| Excel Export | exceljs | - | .xlsx report generation |
| Runtime | Node.js | 18+ | Server runtime |
| Package Manager | npm | - | Dependency management |

---

## 4. Data Model & Entity Relationships

### 4.1 Entity-Relationship Diagram (ERD)

```
┌─────────────────┐       ┌──────────────────────┐
│ PlatformSetting │       │  RegistrationRequest  │
│─────────────────│       │──────────────────────│
│ key (unique)    │       │ username (unique)     │
│ value           │       │ fullName, phone       │
│ updatedBy       │       │ email, passwordHash   │
└─────────────────┘       │ businessName, city    │
                          │ villages, status      │
                          │ rejectionReason       │
                          └──────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          USER                                    │
│  id, username(unique), passwordHash, fullName, phone, email      │
│  role(PA|OWNER|BA|AGENT), isActive, mustChangePassword           │
│─────────────────────────────────────────────────────────────────│
│  ← Session (1:N, cascade)                                        │
│  ← PasswordResetRequest (1:N, cascade)                           │
│  ← SupportAccess (as owner or admin)                             │
│  ← AuditLog (1:N)                                                │
│  → Business (1:N as owner)                                       │
│  ↔ UserBusinessAssignment (M:N to Business)                      │
│  ↔ UserVillageAssignment (M:N to Village)                        │
│  ← Payment (1:N as collector)                                    │
│  ← Loan (1:N as assignedAgent)                                   │
│  ← CashHandover (as agent or receiver)                           │
│  ← Expense (as paidBy)                                           │
└─────────────────────────────────────────────────────────────────┘
         │ owns                    │ assigned to
         ▼                         ▼
┌──────────────────┐    ┌─────────────────────────┐
│    BUSINESS       │    │ UserBusinessAssignment   │
│──────────────────│    │─────────────────────────│
│ name, city        │    │ userId + businessId      │
│ ownerId → User    │    │ (unique combo)           │
│ collectionType    │    └─────────────────────────┘
│ interestModel     │
│ gracePeriods      │    ┌─────────────────────────┐
│ receiptSeq        │    │ UserVillageAssignment    │
│ loanSeq           │    │─────────────────────────│
│ customerSeq       │    │ userId + villageId       │
│ (unique: owner+   │    │ (unique combo)           │
│  name)            │    └─────────────────────────┘
└────────┬─────────┘
         │ has
         ▼
┌──────────────────┐     ┌──────────────────┐
│    VILLAGE        │────▶│    CUSTOMER       │
│──────────────────│     │──────────────────│
│ name              │     │ customerId(uniq) │
│ businessId        │     │ fullName, phone  │
│ (unique: biz+name)│     │ aadhaarHash      │
└──────────────────┘     │ aadhaarLast4     │
                          │ villageId        │
                          │ businessId       │
                          │ status           │
                          └────────┬─────────┘
                                   │ has
                                   ▼
                          ┌──────────────────┐
                          │      LOAN         │
                          │──────────────────│
                          │ loanNumber(uniq) │
                          │ customerId       │
                          │ businessId       │
                          │ agentId → User   │
                          │ loanAmount       │
                          │ interestAmount   │
                          │ totalRepayable   │
                          │ installmentAmt   │
                          │ startDate        │
                          │ status           │
                          │ renewedFromLoan  │
                          └───────┬──────────┘
                            │           │
                   ┌────────▼──┐  ┌─────▼──────────┐
                   │ Schedule   │  │   PAYMENT       │
                   │ Entry      │  │────────────────│
                   │───────────│  │ receiptNo(uniq)│
                   │ dueDate    │  │ amount (paise) │
                   │ amount     │  │ paymentDate    │
                   │ installNo  │  │ collectorId    │
                   └────────────┘  │ isDeleted      │
                                   └────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│    HOLIDAY        │  │ EXPENSE CATEGORY  │  │    EXPENSE        │
│──────────────────│  │──────────────────│  │──────────────────│
│ date, name        │  │ name              │  │ amount, date      │
│ businessId        │  │ businessId        │  │ categoryId        │
│ (unique: biz+date)│  │ (unique: biz+name)│  │ paidById → User   │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  CASH BOOK ENTRY  │  │  CASH HANDOVER    │  │    DOCUMENT       │
│──────────────────│  │──────────────────│  │──────────────────│
│ date              │  │ agentId → User   │  │ customerId?       │
│ openingCash       │  │ receivedById     │  │ loanId?           │
│ closingCash       │  │ amount, date     │  │ businessId        │
│ businessId        │  │ businessId       │  │ filePath, type    │
│ (unique: biz+date)│  └──────────────────┘  └──────────────────┘
└──────────────────┘

┌──────────────────┐
│   AUDIT LOG       │
│──────────────────│
│ action            │
│ entityType        │
│ entityId          │
│ oldValues (JSON)  │
│ newValues (JSON)  │
│ userId → User     │
│ businessId?       │
└──────────────────┘
```

### 4.2 Model Summary Table

| Model | Records | Key Relationships | Unique Constraints |
|-------|---------|-------------------|-------------------|
| User | Core entity | Owns businesses, assigned to businesses/villages | username |
| Session | Auth sessions | Belongs to User (cascade delete) | token |
| Business | Tenant unit | Owned by User, contains all business data | ownerId + name |
| Village | Geography | Belongs to Business, contains customers | businessId + name |
| Customer | Borrower | Belongs to Village + Business, has loans | customerId |
| Loan | Financial product | Belongs to Customer + Business, has payments | loanNumber |
| LoanScheduleEntry | Repayment plan | Belongs to Loan (cascade delete) | loanId + dueDate |
| Payment | Collection record | Belongs to Loan + Business, collected by User | receiptNumber |
| Holiday | Business calendar | Belongs to Business | businessId + date |
| ExpenseCategory | Expense type | Belongs to Business | businessId + name |
| Expense | Expense record | Belongs to Business + Category, paid by User | - |
| CashBookEntry | Daily cash | Belongs to Business | businessId + date |
| CashHandover | Agent→Owner cash | Between two Users in a Business | - |
| Document | File attachment | Optional Customer/Loan, required Business | - |
| AuditLog | Change tracking | By User, optional Business | - |
| PasswordResetRequest | Reset workflow | Belongs to User (cascade delete) | - |
| PlatformSetting | Global config | Standalone | key |
| RegistrationRequest | Signup queue | Standalone | username |
| SupportAccess | PA temp access | Between Owner and PA users | - |
| UserBusinessAssignment | User↔Biz M:N | User + Business | userId + businessId |
| UserVillageAssignment | User↔Village M:N | User + Village | userId + villageId |

---

## 5. Role-Based Access Control (RBAC)

### 5.1 Role Hierarchy

```
PLATFORM_ADMIN (Super Admin)
  │
  ├── Manages owners, registration requests, password resets
  ├── Platform settings (Contact Us, FAQ)
  ├── No direct business data access (needs SupportAccess grant)
  │
  ▼
OWNER (Business Owner)
  │
  ├── Full control over owned businesses
  ├── Creates Business Admins and Agents
  ├── Manages employee password resets
  ├── Financial reports, business comparison
  │
  ▼
BUSINESS_ADMIN (Business Administrator)
  │
  ├── Manages customers, loans, villages within assigned businesses
  ├── Creates Agents, assigns villages
  ├── All reporting, backdate payments, delete operations
  │
  ▼
AGENT (Field Agent)
  │
  ├── Views assigned villages/customers only
  ├── Creates customers, posts payments
  ├── Views own collection reports only
  └── Cannot edit/delete existing records
```

### 5.2 Permission Matrix (47 Actions)

| Permission | PLATFORM_ADMIN | OWNER | BUSINESS_ADMIN | AGENT |
|-----------|:-:|:-:|:-:|:-:|
| manage_owners | ✓ | | | |
| view_platform_summary | ✓ | | | |
| manage_platform_settings | ✓ | | | |
| manage_registration_requests | ✓ | | | |
| manage_password_resets | ✓ | | | |
| create_business | | ✓ | | |
| edit_business_settings | | ✓ | ✓ | |
| deactivate_business | | ✓ | | |
| create_business_admin | | ✓ | | |
| create_agent | | ✓ | ✓ | |
| assign_villages | | ✓ | ✓ | |
| reset_user_password | | ✓ | ✓ | |
| deactivate_user | | ✓ | ✓ | |
| add_village | | ✓ | ✓ | |
| edit_village | | ✓ | ✓ | |
| view_village_list | | ✓ | ✓ | ✓ |
| create_customer | | ✓ | ✓ | ✓ |
| edit_customer | | ✓ | ✓ | |
| delete_customer | | ✓ | ✓ | |
| move_customer_village | | ✓ | ✓ | |
| view_customer | | ✓ | ✓ | ✓ |
| create_loan | | ✓ | ✓ | |
| edit_loan | | ✓ | ✓ | |
| settle_loan | | ✓ | ✓ | |
| writeoff_loan | | ✓ | ✓ | |
| delete_loan | | ✓ | ✓ | |
| manage_loan_status | | ✓ | ✓ | |
| post_payment | | ✓ | ✓ | ✓ |
| edit_own_payment_today | | ✓ | ✓ | ✓ |
| edit_any_payment | | ✓ | ✓ | |
| delete_payment | | ✓ | ✓ | |
| backdate_payment | | ✓ | ✓ | |
| bulk_posting | | ✓ | ✓ | ✓ |
| view_all_reports | | ✓ | ✓ | |
| view_own_collection_report | | ✓ | ✓ | ✓ |
| view_other_agent_reports | | ✓ | ✓ | |
| view_business_comparison | | ✓ | | |
| record_cash_handover | | ✓ | ✓ | |
| manage_cash_book | | ✓ | ✓ | |
| manage_expenses | | ✓ | ✓ | |
| manage_holidays | | ✓ | ✓ | |
| manage_expense_categories | | ✓ | ✓ | |
| grant_support_access | | ✓ | | |
| manage_employee_password_resets | | ✓ | | |

### 5.3 Business Access Scoping

| Role | Business Access Logic |
|------|----------------------|
| PLATFORM_ADMIN | Only via active SupportAccess grant from the business owner |
| OWNER | All businesses where `Business.ownerId = user.id` |
| BUSINESS_ADMIN | Via `UserBusinessAssignment` records |
| AGENT | Via `UserBusinessAssignment` records; additionally village-scoped via `UserVillageAssignment` |

---

## 6. Functional Specifications

### 6.1 Authentication & Registration

| Feature | Description |
|---------|-------------|
| Login | Username/password with rate limiting (5 attempts / 15-min lockout) |
| Session | JWT cookie (`auth-token`), 24-hour expiry, 30-min inactivity auto-logout |
| Registration | Self-service for new owners; creates RegistrationRequest (PENDING) |
| Registration Approval | PA reviews, approves (creates User + Business + Villages) or rejects |
| Password Reset (Owner) | Owner requests via phone → PA resolves via admin panel |
| Password Reset (Employee) | Employee requests via phone → Owner resolves via owner panel |
| Forced Password Change | `mustChangePassword` flag enforced on login redirect |
| Username Availability | Real-time check; blocks if active User exists or PENDING request exists |

### 6.2 Business Management

| Feature | Description |
|---------|-------------|
| Create Business | Owner creates with name, city, collection type, interest model, villages |
| Business Settings | Grace periods, rating thresholds, WhatsApp template, auto-logout minutes |
| Archive Business | Owner deactivates business (soft delete) |
| Delete Business | Full cascade delete of all business data |
| Data Export | Full Excel export with styled worksheets per entity |

### 6.3 Customer Management

| Feature | Description |
|---------|-------------|
| Create Customer | Auto-generated customer ID (sequence-based), assigned to village |
| Edit Customer | Update profile, move between villages, change status |
| CSV Import | Bulk import up to 500 customers with validation preview |
| Bulk Actions | Bulk status change, bulk village move, bulk delete |
| Aadhaar Security | SHA-256 hashed on input, only last 4 digits stored |
| Customer Report | Per-customer loan history with payment details (Excel/PDF) |

### 6.4 Loan Management

| Feature | Description |
|---------|-------------|
| Create Loan | Auto-generated loan number, repayment schedule generated |
| Collection Types | DAILY, WEEKLY, MONTHLY with configurable collection day |
| Interest Models | ADDON (interest added to principal) or UPFRONT (interest deducted) |
| Loan Renewal | Create new loan linked to existing loan |
| Loan Settlement | Close loan at reduced amount with reason |
| Loan Write-off | Write off bad loan with reason |
| Loan Pause | Temporarily pause loan collections |
| Auto-completion | Loan auto-completes when total payments ≥ totalRepayable |
| Agent Assignment | Loans assigned to agents for collection tracking |
| Document Attachments | Photos/PDFs attached to loans |

### 6.5 Payment/Collection

| Feature | Description |
|---------|-------------|
| Individual Posting | Post payment to specific loan with receipt number |
| Village Bulk Posting | Post payments for all loans in a village at once |
| Bulk Payment API | Up to 200 payments in single transaction |
| Payment Edit | Edit own payment (same day for agents), any payment for admins |
| Payment Delete | Soft delete (isDeleted flag) |
| Backdating | Admin/owner can post payments for past dates |
| GPS Tracking | Optional latitude/longitude captured per payment |
| Receipt Numbers | Auto-generated, unique per business |

### 6.6 Reporting

| Report | Description |
|--------|-------------|
| Customer Report | All customers with loan counts, filterable by village/status |
| Loan Report | All loans with outstanding amounts, filterable by status |
| Village Report | Village-level aggregation of loans and collections |
| Employee Report | Agent activity with collection totals |
| Payment Report | All payments in date range |
| Payslip Report | Agent-wise payment summary for payroll |
| Download | Excel (.xlsx) and HTML (PDF-like) export formats |
| Business Comparison | Cross-business metrics (Owner only) |

### 6.7 Financial Operations

| Feature | Description |
|---------|-------------|
| Cash Book | Daily opening/closing cash with auto-calculated fields |
| Expenses | Categorized expense tracking per business |
| Cash Handover | Agent→Owner cash transfer recording |
| Expense Categories | Configurable per business |

---

## 7. API Endpoint Reference

### 7.1 Authentication APIs

---

#### POST /api/auth/login

**Description:** Authenticate user and create session.
**Auth:** Public (rate-limited: 5 attempts / 15 min)

**Request:**
```json
{
  "username": "9553947222",
  "password": "MyPassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "redirectTo": "/dashboard",
  "user": { "id": "clu...", "fullName": "Mahesh Babu", "role": "OWNER" }
}
```
Sets `auth-token` HttpOnly cookie.

**CURL:**
```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"username":"admin","password":"admin123"}'
```

**Error Responses:**
- `400` — Validation failed
- `401` — Invalid credentials
- `429` — Too many attempts (rate limited)

---

#### POST /api/auth/logout

**Description:** Destroy session and clear cookie.
**Auth:** Optional (reads cookie if present)

**CURL:**
```bash
curl -X POST http://localhost:3002/api/auth/logout \
  -b cookies.txt
```

**Response (200):**
```json
{ "success": true }
```

---

#### GET /api/auth/me

**Description:** Get current authenticated user context.
**Auth:** Required (any role)

**CURL:**
```bash
curl http://localhost:3002/api/auth/me \
  -b cookies.txt
```

**Response (200):**
```json
{
  "id": "clu...",
  "username": "admin",
  "fullName": "Platform Admin",
  "role": "PLATFORM_ADMIN",
  "activeBusinessId": null,
  "businessIds": [],
  "villageIds": []
}
```

---

#### GET /api/auth/check-username?username=john123

**Description:** Check if username is available for registration.
**Auth:** Public (rate-limited: 20/min)

**CURL:**
```bash
curl "http://localhost:3002/api/auth/check-username?username=john123"
```

**Response (200):**
```json
{ "available": true }
```

---

#### POST /api/auth/register

**Description:** Submit owner registration request.
**Auth:** Public (rate-limited: 3/hour)

**Request:**
```json
{
  "fullName": "Ravi Kumar",
  "phone": "9876543210",
  "email": "ravi@example.com",
  "username": "ravi_kumar",
  "password": "StrongPass1!",
  "confirmPassword": "StrongPass1!",
  "businessName": "Ravi Finance",
  "city": "Vizag",
  "villages": ["Pendurthi", "Gajuwaka"],
  "collectionType": "DAILY",
  "declaration": true
}
```

**CURL:**
```bash
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName":"Ravi Kumar",
    "phone":"9876543210",
    "username":"ravi_kumar",
    "password":"StrongPass1!",
    "confirmPassword":"StrongPass1!",
    "businessName":"Ravi Finance",
    "city":"Vizag",
    "villages":["Pendurthi"],
    "collectionType":"DAILY",
    "declaration":true
  }'
```

**Response (201):**
```json
{ "success": true, "message": "Registration submitted successfully" }
```

**Error Responses:**
- `400` — Validation failed
- `409` — Username taken or pending registration exists
- `429` — Rate limited

---

#### POST /api/auth/forgot-password

**Description:** Submit password reset request by phone number.
**Auth:** Public (rate-limited: 3/hour)

**Request:**
```json
{ "phone": "9876543210" }
```

**CURL:**
```bash
curl -X POST http://localhost:3002/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'
```

**Response (200):**
```json
{ "message": "If an account exists with this phone number, a password reset request has been submitted." }
```

---

#### POST /api/auth/change-password

**Description:** Change password (forced change flow).
**Auth:** Required (any role)

**Request:**
```json
{ "newPassword": "NewSecurePass1!" }
```

**CURL:**
```bash
curl -X POST http://localhost:3002/api/auth/change-password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"newPassword":"NewSecurePass1!"}'
```

**Response (200):**
```json
{ "success": true, "redirectTo": "/dashboard" }
```

---

#### GET /api/auth/profile

**Description:** Get current user profile with businesses (OWNER).
**Auth:** Required (any role)

**CURL:**
```bash
curl http://localhost:3002/api/auth/profile -b cookies.txt
```

**Response (200):**
```json
{
  "id": "clu...",
  "username": "owner1",
  "fullName": "Business Owner",
  "role": "OWNER",
  "phone": "9876543210",
  "businesses": [
    { "id": "clb...", "name": "Finance Co", "city": "Vizag", "isActive": true }
  ]
}
```

---

#### PATCH /api/auth/profile

**Description:** Multi-action profile update.
**Auth:** Required (varies by action)

**Action: changePassword**
```bash
curl -X PATCH http://localhost:3002/api/auth/profile \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"action":"changePassword","currentPassword":"OldPass1!","newPassword":"NewPass1!"}'
```

**Action: updateProfile**
```bash
curl -X PATCH http://localhost:3002/api/auth/profile \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"action":"updateProfile","fullName":"Updated Name","phone":"9876543211"}'
```

**Action: archiveBusiness** (OWNER only)
```bash
curl -X PATCH http://localhost:3002/api/auth/profile \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"action":"archiveBusiness","businessId":"clb..."}'
```

**Action: updateBusiness** (OWNER only)
```bash
curl -X PATCH http://localhost:3002/api/auth/profile \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"action":"updateBusiness","businessId":"clb...","name":"New Name","city":"Hyderabad"}'
```

---

### 7.2 Platform Admin APIs

---

#### GET /api/admin/owners

**Description:** List all owners with their businesses.
**Auth:** PLATFORM_ADMIN (manage_owners)

**CURL:**
```bash
curl http://localhost:3002/api/admin/owners -b cookies.txt
```

**Response (200):**
```json
[
  {
    "id": "clu...",
    "username": "owner1",
    "fullName": "Owner Name",
    "phone": "9876543210",
    "email": "owner@example.com",
    "isActive": true,
    "createdAt": "2026-09-27T07:14:29.774Z",
    "ownedBusinesses": [
      { "id": "clb...", "name": "Finance Co", "city": "Vizag", "isActive": true }
    ]
  }
]
```

---

#### POST /api/admin/owners

**Description:** Create a new owner user.
**Auth:** PLATFORM_ADMIN (manage_owners)

**Request:**
```json
{
  "fullName": "New Owner",
  "phone": "9876543210",
  "email": "new@example.com",
  "username": "new_owner",
  "password": "TempPass1!"
}
```

**CURL:**
```bash
curl -X POST http://localhost:3002/api/admin/owners \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"fullName":"New Owner","phone":"9876543210","username":"new_owner","password":"TempPass1!"}'
```

**Response (201):**
```json
{ "id": "clu...", "username": "new_owner", "fullName": "New Owner" }
```

---

#### GET /api/admin/owners/:ownerId

**Description:** Get owner details with businesses.
**Auth:** PLATFORM_ADMIN (manage_owners)

**CURL:**
```bash
curl http://localhost:3002/api/admin/owners/clu123 -b cookies.txt
```

---

#### PATCH /api/admin/owners/:ownerId

**Description:** Update owner profile, deactivate, or reset password.
**Auth:** PLATFORM_ADMIN (manage_owners)

**CURL:**
```bash
curl -X PATCH http://localhost:3002/api/admin/owners/clu123 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"fullName":"Updated Name","isActive":false,"resetPassword":"TempPass1!"}'
```

---

#### DELETE /api/admin/owners/:ownerId

**Description:** Permanently delete owner and all deactivated businesses. Blocks if active businesses exist.
**Auth:** PLATFORM_ADMIN (manage_owners)

**CURL:**
```bash
curl -X DELETE http://localhost:3002/api/admin/owners/clu123 -b cookies.txt
```

**Response (200):**
```json
{ "success": true }
```

**Error (400):**
```json
{ "error": "Cannot delete owner with active businesses: Finance Co. Deactivate or remove them first." }
```

---

#### GET /api/admin/registration-requests?status=PENDING&search=ravi

**Description:** List registration requests with duplicate phone detection.
**Auth:** PLATFORM_ADMIN (manage_registration_requests)

**CURL:**
```bash
curl "http://localhost:3002/api/admin/registration-requests?status=PENDING" -b cookies.txt
```

---

#### GET /api/admin/registration-requests/pending-count

**Description:** Count of pending registration requests (for badge display).
**Auth:** PLATFORM_ADMIN

**CURL:**
```bash
curl http://localhost:3002/api/admin/registration-requests/pending-count -b cookies.txt
```

**Response (200):**
```json
{ "count": 3 }
```

---

#### POST /api/admin/registration-requests/:requestId/approve

**Description:** Approve registration — creates User (OWNER) + Business + Villages in transaction.
**Auth:** PLATFORM_ADMIN (manage_registration_requests)

**CURL:**
```bash
curl -X POST http://localhost:3002/api/admin/registration-requests/clr123/approve \
  -b cookies.txt
```

**Response (200):**
```json
{
  "success": true,
  "message": "Registration approved",
  "userId": "clu...",
  "businessId": "clb...",
  "businessName": "Ravi Finance"
}
```

---

#### POST /api/admin/registration-requests/:requestId/reject

**Description:** Reject registration with reason.
**Auth:** PLATFORM_ADMIN (manage_registration_requests)

**CURL:**
```bash
curl -X POST http://localhost:3002/api/admin/registration-requests/clr123/reject \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"reason":"Incomplete documentation"}'
```

---

#### GET /api/admin/password-resets?status=PENDING

**Description:** List password reset requests for owners.
**Auth:** PLATFORM_ADMIN (manage_password_resets)

**CURL:**
```bash
curl "http://localhost:3002/api/admin/password-resets?status=PENDING" -b cookies.txt
```

---

#### POST /api/admin/password-resets/:requestId/reset

**Description:** Resolve password reset — sets new password, invalidates sessions, creates audit log.
**Auth:** PLATFORM_ADMIN (manage_password_resets)

**CURL:**
```bash
curl -X POST http://localhost:3002/api/admin/password-resets/clp123/reset \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"newPassword":"TempPass1!","note":"Reset per phone request"}'
```

---

#### POST /api/admin/password-resets/:requestId/cancel

**Description:** Cancel a pending password reset request.
**Auth:** PLATFORM_ADMIN (manage_password_resets)

**CURL:**
```bash
curl -X POST http://localhost:3002/api/admin/password-resets/clp123/cancel \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"note":"Duplicate request"}'
```

---

#### GET /api/admin/platform-settings

**Description:** Get platform settings (contact_us, faq).
**Auth:** Any authenticated user (GET), PLATFORM_ADMIN for PUT

**CURL:**
```bash
curl http://localhost:3002/api/admin/platform-settings -b cookies.txt
```

---

#### PUT /api/admin/platform-settings

**Description:** Upsert a platform setting.
**Auth:** PLATFORM_ADMIN (manage_platform_settings)

**CURL:**
```bash
curl -X PUT http://localhost:3002/api/admin/platform-settings \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"key":"contact_us","value":{"phone":"1800123456","email":"support@example.com"}}'
```

---

### 7.3 Owner APIs

---

#### GET /api/owner/businesses

**Description:** List owner's active businesses.
**Auth:** OWNER

**CURL:**
```bash
curl http://localhost:3002/api/owner/businesses -b cookies.txt
```

---

#### GET /api/owner/agents

**Description:** List all agents across owner's businesses.
**Auth:** OWNER

**CURL:**
```bash
curl http://localhost:3002/api/owner/agents -b cookies.txt
```

---

#### GET /api/owner/villages

**Description:** List all villages across owner's businesses.
**Auth:** OWNER

**CURL:**
```bash
curl http://localhost:3002/api/owner/villages -b cookies.txt
```

---

#### GET /api/owner/password-resets?status=PENDING

**Description:** List employee password reset requests.
**Auth:** OWNER (manage_employee_password_resets)

**CURL:**
```bash
curl "http://localhost:3002/api/owner/password-resets?status=PENDING" -b cookies.txt
```

---

### 7.4 Business-Scoped APIs

All routes below require the `businessId` path parameter and authenticated business access.

**Base URL pattern:** `/api/b/{businessId}/...`

---

#### GET /api/b/:businessId/settings

**Description:** Get business configuration.
**Auth:** Business access

**CURL:**
```bash
curl http://localhost:3002/api/b/clb123/settings -b cookies.txt
```

**Response (200):**
```json
{
  "id": "clb...",
  "name": "Finance Co",
  "city": "Vizag",
  "collectionType": "DAILY",
  "interestModel": "ADDON",
  "gracePeriodDaily": 30,
  "ratingGoodMaxPct": 50,
  "whatsappTemplate": "{{businessName}}: Received ₹{{amount}}...",
  "autoLogoutMinutes": 30
}
```

---

#### PATCH /api/b/:businessId/settings

**Description:** Update business settings.
**Auth:** Business access + edit_business_settings

**CURL:**
```bash
curl -X PATCH http://localhost:3002/api/b/clb123/settings \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"gracePeriodDaily":45,"autoLogoutMinutes":60}'
```

---

#### DELETE /api/b/:businessId/settings

**Description:** Permanently delete business and ALL data.
**Auth:** Business access + deactivate_business

**CURL:**
```bash
curl -X DELETE http://localhost:3002/api/b/clb123/settings -b cookies.txt
```

---

#### GET /api/b/:businessId/settings/export

**Description:** Export all business data as Excel workbook.
**Auth:** Business access + edit_business_settings

**CURL:**
```bash
curl http://localhost:3002/api/b/clb123/settings/export \
  -b cookies.txt -o business_export.xlsx
```

---

#### GET /api/b/:businessId/villages

**Description:** List villages with customer counts and agent assignments.
**Auth:** Business access

**CURL:**
```bash
curl http://localhost:3002/api/b/clb123/villages -b cookies.txt
```

---

#### POST /api/b/:businessId/villages

**Description:** Create a new village.
**Auth:** Business access + add_village

**CURL:**
```bash
curl -X POST http://localhost:3002/api/b/clb123/villages \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"New Village"}'
```

---

#### PATCH /api/b/:businessId/villages/:villageId

**CURL:**
```bash
curl -X PATCH http://localhost:3002/api/b/clb123/villages/clv456 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"Renamed Village","isActive":false}'
```

---

#### GET /api/b/:businessId/customers?villageId=x&status=ACTIVE&search=ravi

**Description:** List customers with filters.
**Auth:** Business access + view_customer

**CURL:**
```bash
curl "http://localhost:3002/api/b/clb123/customers?status=ACTIVE&search=ravi" -b cookies.txt
```

---

#### POST /api/b/:businessId/customers

**Description:** Create customer with auto-generated ID.
**Auth:** Business access + create_customer

**CURL:**
```bash
curl -X POST http://localhost:3002/api/b/clb123/customers \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "fullName":"Ravi Kumar",
    "phone":"9876543210",
    "villageId":"clv456",
    "age":35,
    "address":"123 Main St",
    "jobType":"Farmer"
  }'
```

---

#### GET /api/b/:businessId/customers/:customerId

**Description:** Full customer details with loans, payments, and summary.
**Auth:** Business access + view_customer

**CURL:**
```bash
curl http://localhost:3002/api/b/clb123/customers/cust001 -b cookies.txt
```

---

#### PATCH /api/b/:businessId/customers/:customerId

**Description:** Update customer fields.
**Auth:** Business access + edit_customer

**CURL:**
```bash
curl -X PATCH http://localhost:3002/api/b/clb123/customers/cust001 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"phone":"9876543211","status":"CLOSED"}'
```

---

#### POST /api/b/:businessId/customers/import

**Description:** Bulk CSV import (up to 500 customers). Two-step: validate, then confirm.
**Auth:** Business access + create_customer

**Step 1 — Validate:**
```bash
curl -X POST http://localhost:3002/api/b/clb123/customers/import \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "customers": [
      {"fullName":"Test","phone":"9876543210","villageName":"Pendurthi"},
      {"fullName":"Bad","phone":"123","villageName":"Unknown"}
    ]
  }'
```

**Step 2 — Confirm:**
```bash
curl -X POST http://localhost:3002/api/b/clb123/customers/import \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "customers": [{"fullName":"Test","phone":"9876543210","villageName":"Pendurthi"}],
    "confirm": true
  }'
```

---

#### PATCH /api/b/:businessId/customers/bulk

**Description:** Bulk edit customers (change status or village).
**Auth:** Business access + edit_customer

**CURL:**
```bash
curl -X PATCH http://localhost:3002/api/b/clb123/customers/bulk \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"customerIds":["c1","c2"],"action":"changeStatus","status":"CLOSED"}'
```

---

#### DELETE /api/b/:businessId/customers/bulk

**Description:** Bulk delete customers (blocks if any have loans).
**Auth:** Business access + delete_customer

**CURL:**
```bash
curl -X DELETE http://localhost:3002/api/b/clb123/customers/bulk \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"customerIds":["c1","c2"]}'
```

---

#### GET /api/b/:businessId/loans?status=ACTIVE&customerId=x

**Description:** List loans with customer and agent info.
**Auth:** Business access

**CURL:**
```bash
curl "http://localhost:3002/api/b/clb123/loans?status=ACTIVE" -b cookies.txt
```

---

#### POST /api/b/:businessId/loans

**Description:** Create loan with auto-generated number and repayment schedule.
**Auth:** Business access + create_loan

**CURL:**
```bash
curl -X POST http://localhost:3002/api/b/clb123/loans \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "customerId":"cust001",
    "loanAmount":5000000,
    "interestAmount":500000,
    "collectionType":"DAILY",
    "installmentAmount":55000,
    "numberOfInstallments":100,
    "startDate":"2026-10-01",
    "agentId":"agent123",
    "notes":"First loan"
  }'
```

**Note:** All amounts in paise (5000000 = ₹50,000).

**Response (201):**
```json
{ "id": "cll...", "loanNumber": "LN-0001", "totalRepayable": 5500000 }
```

---

#### GET /api/b/:businessId/loans/:loanId

**Description:** Full loan details with schedule.
**Auth:** Business access

**CURL:**
```bash
curl http://localhost:3002/api/b/clb123/loans/cll456 -b cookies.txt
```

---

#### PATCH /api/b/:businessId/loans/:loanId

**Description:** Update loan (recalculates schedule if amounts change).
**Auth:** Business access + edit_loan

**CURL:**
```bash
curl -X PATCH http://localhost:3002/api/b/clb123/loans/cll456 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"agentId":"newAgent123","notes":"Reassigned"}'
```

---

#### POST /api/b/:businessId/loans/bulk

**Description:** Bulk loan actions (delete).
**Auth:** Business access + delete_loan

**CURL:**
```bash
curl -X POST http://localhost:3002/api/b/clb123/loans/bulk \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"loanIds":["l1","l2"],"action":"delete"}'
```

---

#### POST /api/b/:businessId/payments

**Description:** Post or update a payment.
**Auth:** Business access + post_payment

**CURL:**
```bash
curl -X POST http://localhost:3002/api/b/clb123/payments \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "loanId":"cll456",
    "amount":55000,
    "paymentDate":"2026-10-01",
    "note":"Daily collection"
  }'
```

**Response (201):**
```json
{
  "id": "clp...",
  "receiptNumber": "RCP-0001",
  "amount": 55000,
  "createdAt": "2026-10-01T05:30:00.000Z"
}
```

---

#### POST /api/b/:businessId/payments/bulk

**Description:** Bulk payment posting (up to 200 payments).
**Auth:** Business access + post_payment

**CURL:**
```bash
curl -X POST http://localhost:3002/api/b/clb123/payments/bulk \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "paymentDate":"2026-10-01",
    "payments":[
      {"loanId":"l1","amount":55000},
      {"loanId":"l2","amount":30000}
    ]
  }'
```

---

#### GET /api/b/:businessId/posting/village?villageId=x&date=2026-10-01

**Description:** Get village customers with outstanding loans for payment posting page.
**Auth:** Business access + post_payment

**CURL:**
```bash
curl "http://localhost:3002/api/b/clb123/posting/village?villageId=clv456&date=2026-10-01" \
  -b cookies.txt
```

---

#### GET /api/b/:businessId/reports?entity=loans&from=2026-09-01&to=2026-09-30

**Description:** Generate report data.
**Auth:** Business access + view_all_reports

**Entities:** `customers`, `loans`, `villages`, `employees`, `payments`, `payslips`

**CURL:**
```bash
curl "http://localhost:3002/api/b/clb123/reports?entity=loans&from=2026-09-01&to=2026-09-30" \
  -b cookies.txt
```

---

#### GET /api/b/:businessId/reports/download?entity=loans&from=2026-09-01&to=2026-09-30&format=xlsx

**Description:** Download report as Excel or PDF.
**Auth:** Business access + view_all_reports

**CURL:**
```bash
curl "http://localhost:3002/api/b/clb123/reports/download?entity=loans&from=2026-09-01&to=2026-09-30&format=xlsx" \
  -b cookies.txt -o report.xlsx
```

---

#### GET /api/b/:businessId/users

**Description:** List employees assigned to business.
**Auth:** Business access

**CURL:**
```bash
curl http://localhost:3002/api/b/clb123/users -b cookies.txt
```

---

#### POST /api/b/:businessId/users

**Description:** Create employee (BUSINESS_ADMIN or AGENT).
**Auth:** Business access + create_business_admin or create_agent

**CURL:**
```bash
curl -X POST http://localhost:3002/api/b/clb123/users \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "fullName":"New Agent",
    "phone":"9876543210",
    "username":"new_agent",
    "password":"TempPass1!",
    "role":"AGENT",
    "businessIds":["clb123"],
    "villageIds":["clv456"]
  }'
```

---

#### PATCH /api/b/:businessId/users/:userId

**Description:** Update employee profile, assignments, password, or status.
**Auth:** Business access + specific permissions per field

**CURL:**
```bash
curl -X PATCH http://localhost:3002/api/b/clb123/users/clu789 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"fullName":"Updated Agent","villageIds":["v1","v2"],"businessIds":["b1","b2"]}'
```

---

#### DELETE /api/b/:businessId/users/:userId

**Description:** Remove employee from business. Deletes User record entirely if no assignments remain.
**Auth:** Business access + deactivate_user

**CURL:**
```bash
curl -X DELETE http://localhost:3002/api/b/clb123/users/clu789 -b cookies.txt
```

---

#### POST /api/b/:businessId/upload?type=photo

**Description:** Upload file (photo or document).
**Auth:** Business access

**CURL:**
```bash
curl -X POST "http://localhost:3002/api/b/clb123/upload?type=photo" \
  -b cookies.txt \
  -F "file=@photo.jpg"
```

**Response (201):**
```json
{ "photoPath": "/uploads/photos/abc123.jpg" }
```

---

## 8. Sequence Diagrams

### 8.1 User Login Flow

```
Browser              API(/auth/login)        Auth Service         Database
  │                       │                      │                   │
  │──POST credentials────▶│                      │                   │
  │                       │──checkRateLimit──────▶│                   │
  │                       │◀─────allowed─────────│                   │
  │                       │──validate(loginSchema)│                   │
  │                       │──findUser────────────────────────────────▶│
  │                       │◀────────────────user record──────────────│
  │                       │──verifyPassword──────▶│                   │
  │                       │◀────────match────────│                   │
  │                       │──createSession───────────────────────────▶│
  │                       │◀────────────────session + JWT────────────│
  │◀─200 + Set-Cookie────│                      │                   │
  │  (auth-token=JWT)     │                      │                   │
```

### 8.2 Owner Registration & Approval Flow

```
New Owner           API(/auth/register)    Platform Admin    API(/admin/.../approve)    Database
  │                      │                      │                    │                      │
  │──POST registration──▶│                      │                    │                      │
  │                      │──validate─────────────────────────────────────────────────────────│
  │                      │──check username unique────────────────────────────────────────────▶│
  │                      │◀──────────────────────────────────────────────────────available───│
  │                      │──create RegistrationRequest(PENDING)──────────────────────────────▶│
  │◀─201 submitted──────│                      │                    │                      │
  │                      │                      │                    │                      │
  │                      │                      │──GET requests─────▶│                      │
  │                      │                      │◀─list with badges─│                      │
  │                      │                      │                    │                      │
  │                      │                      │──POST approve─────▶│                      │
  │                      │                      │                    │──$transaction──────────▶│
  │                      │                      │                    │  create User(OWNER)    │
  │                      │                      │                    │  create Business       │
  │                      │                      │                    │  create Villages       │
  │                      │                      │                    │  update RegRequest     │
  │                      │                      │◀─success──────────│◀─────────────commit────│
```

### 8.3 Loan Disbursement Flow

```
Owner/Admin         API(/b/:bid/loans)                    Database
  │                      │                                    │
  │──POST new loan──────▶│                                    │
  │                      │──getSession()                      │
  │                      │──assertBusinessAccess()            │
  │                      │──assertPermission(create_loan)     │
  │                      │──validate(createLoanSchema)        │
  │                      │──verify customer exists────────────▶│
  │                      │◀───────────customer───────────────│
  │                      │──increment loanSeq─────────────────▶│
  │                      │◀───────────new sequence────────────│
  │                      │──calculate schedule                │
  │                      │  (dates, installments, amounts)    │
  │                      │──$transaction──────────────────────▶│
  │                      │  create Loan                        │
  │                      │  create LoanScheduleEntry[] (batch) │
  │                      │  create Document[] (if attached)    │
  │                      │  if renewFromLoanId:                │
  │                      │    update old loan (status,closedAt)│
  │◀─201 {loanNumber}──│◀──────────────commit───────────────│
```

### 8.4 Payment Posting Flow

```
Agent               API(/b/:bid/payments)                 Database
  │                      │                                    │
  │──POST payment───────▶│                                    │
  │                      │──getSession()                      │
  │                      │──assertBusinessAccess()            │
  │                      │──assertPermission(post_payment)    │
  │                      │──validate(loanId, amount, date)    │
  │                      │──find loan with totals─────────────▶│
  │                      │◀───────────loan + paid sum─────────│
  │                      │──check: outstanding > 0?           │
  │                      │──increment receiptSeq──────────────▶│
  │                      │──create Payment────────────────────▶│
  │                      │◀───────────payment─────────────────│
  │                      │──check: totalPaid >= totalRepayable?│
  │                      │──if yes: update loan status=COMPLETED▶│
  │◀─201 {receiptNumber}│                                    │
```

### 8.5 Password Reset Flow

```
User                API(/auth/forgot)    PA/Owner    API(/admin/pw-resets/:id/reset)    Database
  │                      │                  │                    │                         │
  │──POST {phone}───────▶│                  │                    │                         │
  │                      │──find user by phone───────────────────────────────────────────▶│
  │                      │──create PasswordResetRequest(PENDING)─────────────────────────▶│
  │◀─200 generic msg────│                  │                    │                         │
  │                      │                  │──GET pending───────▶│                         │
  │                      │                  │◀─list──────────────│                         │
  │                      │                  │──POST reset────────▶│                         │
  │                      │                  │                    │──hashPassword            │
  │                      │                  │                    │──update user.passwordHash▶│
  │                      │                  │                    │──set mustChangePassword   │
  │                      │                  │                    │──invalidate sessions─────▶│
  │                      │                  │                    │──update request(COMPLETED)▶│
  │                      │                  │                    │──create AuditLog──────────▶│
  │                      │                  │◀─success──────────│                         │
```

---

## 9. UML Class Diagrams

### 9.1 Core Domain Model

```
┌──────────────────────┐         ┌──────────────────────┐
│       <<entity>>      │         │       <<entity>>      │
│         User          │ 1    N  │       Session         │
│──────────────────────│────────▶│──────────────────────│
│ +id: String           │         │ +id: String           │
│ +username: String     │         │ +token: String        │
│ +passwordHash: String │         │ +activeBusinessId?    │
│ +fullName: String     │         │ +expiresAt: DateTime  │
│ +phone?: String       │         │ +lastActivityAt       │
│ +email?: String       │         └──────────────────────┘
│ +role: Role           │
│ +isActive: Boolean    │    1    N  ┌──────────────────────┐
│ +mustChangePassword   │───────────▶│     Business          │
└──────────┬───────────┘   owns     │──────────────────────│
           │                         │ +id: String           │
           │ M:N                     │ +name: String         │
           │ (UserBizAssignment)     │ +city: String         │
           │                         │ +collectionType       │
           ▼                         │ +interestModel        │
   ┌───────────────┐                 │ +receiptSeq: Int      │
   │ BusinessAssign │                │ +loanSeq: Int         │
   │───────────────│                │ +customerSeq: Int     │
   │ userId         │                └──────────┬───────────┘
   │ businessId     │                           │ 1:N
   └───────────────┘                           ▼
                                      ┌──────────────────┐
                                      │     Village       │
                                      │──────────────────│
                                      │ +name: String     │
                                      │ +businessId       │
                                      │ +isActive         │
                                      └────────┬─────────┘
                                               │ 1:N
                                               ▼
                                      ┌──────────────────┐
                                      │    Customer       │
                                      │──────────────────│
                                      │ +customerId       │
                                      │ +fullName         │
                                      │ +phone            │
                                      │ +aadhaarHash?     │
                                      │ +aadhaarLast4?    │
                                      │ +status           │
                                      └────────┬─────────┘
                                               │ 1:N
                                               ▼
                                      ┌──────────────────┐       ┌──────────────────┐
                                      │      Loan         │ 1:N  │    Payment        │
                                      │──────────────────│──────▶│──────────────────│
                                      │ +loanNumber       │       │ +receiptNumber    │
                                      │ +loanAmount       │       │ +amount: Int      │
                                      │ +totalRepayable   │       │ +paymentDate      │
                                      │ +installmentAmt   │       │ +collectorId      │
                                      │ +status           │       │ +isDeleted        │
                                      │ +agentId?         │       └──────────────────┘
                                      │ +renewedFromLoan? │
                                      └────────┬─────────┘
                                               │ 1:N
                                               ▼
                                      ┌──────────────────┐
                                      │ LoanScheduleEntry │
                                      │──────────────────│
                                      │ +installmentNo    │
                                      │ +dueDate          │
                                      │ +amount           │
                                      └──────────────────┘
```

### 9.2 Authentication Class Model

```
┌────────────────────────────┐
│      <<service>>            │
│      AuthService            │
│────────────────────────────│
│ +hashPassword(pwd): hash    │
│ +verifyPassword(pwd,hash)   │
│ +signToken(payload): JWT    │
│ +verifyToken(token): payload│
│ +createSession(userId,role) │
│ +getSession(): AuthUser     │
│ +invalidateUserSessions(id) │
│ +setActiveBusiness(sid,bid) │
└────────────────────────────┘

┌────────────────────────────┐     ┌────────────────────────────┐
│      <<service>>            │     │      <<service>>            │
│    PermissionService        │     │      ScopeService           │
│────────────────────────────│     │────────────────────────────│
│ +hasPermission(role,action) │     │ +assertBusinessAccess()     │
│ +assertPermission(user,act) │     │ +assertVillageAccess()      │
│                             │     │ +getAccessibleBusinessIds() │
│ PERMISSION_MATRIX:          │     │ +getAccessibleVillageIds()  │
│  Map<Role, Set<Action>>     │     │ +businessWhere()            │
└────────────────────────────┘     │ +villageFilter()            │
                                    └────────────────────────────┘

┌────────────────────────────┐     ┌────────────────────────────┐
│      <<service>>            │     │      <<service>>            │
│     RateLimitService        │     │      DateService            │
│────────────────────────────│     │────────────────────────────│
│ +checkRateLimit(store,key,  │     │ +nowIST(): Date             │
│    maxAttempts, windowMs)   │     │ +todayIST(): string         │
│ +recordRateLimitHit()       │     │ +formatDateDisplay(iso)     │
│                             │     │ +addDays/Weeks/Months()     │
│ In-memory sliding window    │     │ +daysBetween(start,end)     │
└────────────────────────────┘     └────────────────────────────┘
```

---

## 10. Security Architecture

### 10.1 Authentication Security

| Control | Implementation |
|---------|---------------|
| Password Hashing | bcrypt with 12 salt rounds |
| Session Tokens | JWT signed with configurable secret (`JWT_SECRET` env var) |
| Cookie Security | HttpOnly, Secure (production), SameSite=Lax |
| Session Expiry | Configurable (default 24 hours) |
| Inactivity Timeout | 30-minute auto-logout (configurable per business) |
| Rate Limiting | Login: 5 attempts / 15 min; Registration: 3/hour; Forgot-password: 3/hour |
| Forced Password Change | `mustChangePassword` flag on reset |

### 10.2 Authorization Security

| Control | Implementation |
|---------|---------------|
| RBAC | 47-action permission matrix, enforced via `assertPermission()` |
| Tenant Isolation | `assertBusinessAccess()` ensures users only access authorized businesses |
| Village Scoping | Agents restricted to assigned villages via `assertVillageAccess()` |
| PA Access | Platform Admin has NO business access by default — requires explicit `SupportAccess` grant from owner |

### 10.3 Data Security

| Control | Implementation |
|---------|---------------|
| Aadhaar Protection | SHA-256 hashed on input; only last 4 digits stored in plaintext |
| SQL Injection | Prevented by Prisma ORM parameterized queries |
| XSS Prevention | React's built-in JSX escaping; no `dangerouslySetInnerHTML` usage |
| CSRF Protection | SameSite cookie attribute + HttpOnly flag |
| File Upload | Type validation (images/PDFs only), size limits (5MB photo, 10MB document) |
| Sensitive Data | `.env` credentials never committed; JWT secret configurable |

### 10.4 Input Validation

| Boundary | Implementation |
|----------|---------------|
| API Request Bodies | Zod schema validation on every mutating endpoint |
| Phone Numbers | Regex: `/^[6-9]\d{9}$/` (Indian 10-digit mobile) |
| Usernames | 3-30 chars, alphanumeric + underscore only |
| Passwords (Registration) | Min 8 chars, uppercase + number + special character |
| Amounts | Integer only (paise), positive values enforced |
| Dates | YYYY-MM-DD format validated |
| File Uploads | MIME type + size validated server-side |

### 10.5 Security Headers & Transport

| Control | Status |
|---------|--------|
| HTTPS | Enforced in production (Secure cookie flag) |
| Content Security Policy | Via Next.js default headers |
| X-Frame-Options | Via Next.js default headers |
| Rate Limiting | In-memory per-IP sliding window |

---

## 11. SOX Compliance

### 11.1 Audit Trail (SOX Section 302/404)

| Requirement | Implementation |
|-------------|---------------|
| **Change Tracking** | `AuditLog` model records all significant changes with `oldValues`/`newValues` (JSON), `userId`, `action`, `entityType`, `entityId` |
| **User Attribution** | Every audit log entry linked to authenticated `userId` |
| **Timestamp** | `createdAt` auto-set on every log entry |
| **Password Changes** | Audit log created on every password reset with `resolvedBy` and `note` fields |
| **Financial Operations** | Payments, loans, expenses tracked via AuditLog |
| **Soft Deletes** | Payments use `isDeleted` flag — original records preserved |

### 11.2 Access Controls (SOX Section 404)

| Requirement | Implementation |
|-------------|---------------|
| **Segregation of Duties** | 4-tier role hierarchy; Agents cannot approve/modify loans; PA cannot access business data without grant |
| **Least Privilege** | 47 granular permissions; Agents have only 7 actions |
| **Access Reviews** | `SupportAccess` has expiry; PA access is time-bounded |
| **Authentication** | Password complexity, forced change, rate limiting |
| **Session Management** | Auto-expiry, inactivity timeout, single-session-per-user on password reset |

### 11.3 Data Integrity (SOX Section 404)

| Requirement | Implementation |
|-------------|---------------|
| **Transaction Integrity** | Prisma `$transaction` for multi-table operations (registration approval, loan creation, business deletion) |
| **Referential Integrity** | Foreign keys enforced at database level |
| **Unique Constraints** | Business names per owner, loan numbers, receipt numbers, customer IDs all unique |
| **Money Precision** | Integer storage in paise — no floating-point rounding errors |
| **Date Consistency** | All dates in IST, stored as YYYY-MM-DD strings |

### 11.4 Reporting & Monitoring

| Requirement | Implementation |
|-------------|---------------|
| **Financial Reports** | Loan, payment, customer, village, employee, payslip reports |
| **Export Capability** | Excel (.xlsx) and HTML/PDF export for all reports |
| **Data Export** | Full business data export for auditor review |
| **Registration Audit** | Full lifecycle tracked: PENDING → APPROVED/REJECTED with reviewer ID and timestamp |
| **Password Reset Audit** | Full lifecycle: PENDING → COMPLETED/CANCELLED with resolver ID, note, and timestamp |

---

## 12. Governance & Assumptions

### 12.1 Governance

| Area | Policy |
|------|--------|
| **Data Ownership** | Business data owned by the OWNER; PA has administrative access only |
| **Access Provisioning** | PA creates Owners; Owners create Business Admins and Agents |
| **Access Revocation** | Deactivation (`isActive=false`) + session invalidation on deactivate/delete |
| **Change Management** | All schema changes via `prisma db push`; no auto-migrations in production |
| **Backup** | SQLite file-based — backup is file copy of `dev.db` |
| **Password Policy** | Registration: min 8, uppercase + number + special; Internal: min 4 |
| **Session Policy** | 24-hour max, 30-min inactivity timeout |

### 12.2 Assumptions

| # | Assumption | Impact |
|---|-----------|--------|
| 1 | **Single-server deployment** — SQLite is embedded, no multi-instance support | Cannot horizontally scale; rate limiting is per-instance |
| 2 | **IST timezone only** — all dates pinned to UTC+5:30 | Users in other timezones see IST dates |
| 3 | **Indian phone numbers only** — regex `/^[6-9]\d{9}$/` | International numbers not supported |
| 4 | **Currency is INR** — amounts in paise (integer) | No multi-currency support |
| 5 | **File storage is local** — uploads stored on server filesystem | No CDN/S3; files lost if server disk fails |
| 6 | **No email/SMS notifications** — removed due to cost constraints | Users must check the app for updates |
| 7 | **Rate limiting is in-memory** — resets on server restart | Brute-force protection lost on restart |
| 8 | **Single database** — all tenants in same SQLite file | No per-tenant database isolation |
| 9 | **No real-time updates** — standard request/response pattern | Dashboard data requires page refresh |
| 10 | **Browser-based only** — no native mobile app | Responsive web design for mobile access |

### 12.3 Constraints

| Constraint | Detail |
|-----------|--------|
| Max CSV import | 500 customers per batch |
| Max bulk payment | 200 payments per batch |
| Max bulk customer ops | 500 customers per batch |
| Max bulk loan delete | 100 loans per batch |
| Photo upload | Max 5MB, images only |
| Document upload | Max 10MB, images + PDFs |
| Receipt prefix | Max 5 characters, uppercase only |

---

## 13. Non-Functional Requirements

### 13.1 Performance

| Metric | Target |
|--------|--------|
| API Response Time | < 500ms for standard CRUD operations |
| Report Generation | < 5s for date-range reports |
| Excel Export | < 10s for full business export |
| Page Load | < 3s initial load (Next.js SSR) |

### 13.2 Availability

| Metric | Target |
|--------|--------|
| Uptime | 99.5% (single-server) |
| Recovery | SQLite file backup/restore |
| Data Durability | File-level backup of SQLite DB + uploads directory |

### 13.3 Scalability Limits

| Dimension | Current Capacity |
|-----------|-----------------|
| Concurrent Users | ~50 (SQLite write lock limitation) |
| Total Businesses | Hundreds (SQLite practical limit) |
| Loans per Business | Thousands |
| Payments | Hundreds of thousands |

---

**Internal Use Only**
