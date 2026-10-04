# Sections 10–12: Assumptions, Sequence Diagrams, UML Class Diagrams

---

## 10. Assumptions and Hypothesis

### 10.1 Business Assumptions

| # | Assumption | Rationale |
|---|-----------|-----------|
| 1 | All users operate in IST timezone | Target market is South India |
| 2 | Currency is always Indian Rupees | Single-currency platform |
| 3 | Phone numbers follow Indian 10-digit format (6-9 prefix) | Indian market only |
| 4 | Aadhaar is 12 digits, must be securely stored | Regulatory requirement |
| 5 | Collection happens on working days only (configurable) | Sunday typically off |
| 6 | Daily loans have 90-150 installments | Standard practice |
| 7 | Monthly loans use 1.40x multiplier by default | Industry standard |
| 8 | Daily/Weekly loans use 1.20x multiplier by default | Industry standard |
| 9 | Grace period before overdue: 30 days (daily), 4 weeks (weekly), 1 month (monthly) | Business-configurable |
| 10 | One business has one collection type (cannot mix daily+weekly) | Simplifies scheduling |

### 10.2 Technical Assumptions

| # | Assumption | Rationale |
|---|-----------|-----------|
| 1 | Agents use Android mobile browsers primarily | Field agents use budget phones |
| 2 | Internet may be intermittent (no offline mode in v1) | PWA planned for future |
| 3 | Single server deployment is sufficient | <1000 concurrent users expected |
| 4 | SQLite is sufficient for development | PostgreSQL for production |
| 5 | File uploads (photos, documents) stored on local filesystem | S3/cloud storage for future |
| 6 | Session-based auth (JWT cookie) not token-based API auth | Web app, not mobile API |

### 10.3 Hypothesis

| # | Hypothesis | Validation |
|---|-----------|-----------|
| 1 | Mobile-first UI increases agent adoption | Track usage metrics |
| 2 | Bulk posting by village is 5x faster than individual | Time comparison |
| 3 | Cash/UPI payment mode tracking reduces disputes | Dispute count before/after |
| 4 | Configurable multiplier/grace period reduces setup friction | Business onboarding time |
| 5 | Business XLSX import enables migration from paper/Excel | Import success rate |

---

## 11. Sequence Diagrams

### 11.1 Login Flow

```
User            Browser          Middleware        API Route         Database
 │                │                  │                │                │
 │── Enter creds ─▶│                  │                │                │
 │                │── POST /login ───▶│                │                │
 │                │                  │── forward ────▶│                │
 │                │                  │                │── find user ──▶│
 │                │                  │                │◀── user row ───│
 │                │                  │                │── bcrypt       │
 │                │                  │                │   compare ─────│
 │                │                  │                │── create       │
 │                │                  │                │   JWT token ───│
 │                │                  │                │── set httpOnly  │
 │                │◀── 200 + cookie ─│◀───────────────│   cookie       │
 │                │── redirect /dashboard ──▶│         │                │
 │                │                  │── check cookie │                │
 │                │                  │── decode JWT   │                │
 │                │                  │── allow ──────▶│                │
 │◀── Dashboard ──│◀─────────────────│◀───────────────│                │
```

### 11.2 Loan Creation Flow

```
Owner           Browser          API Route         Database
 │                │                  │                │
 │── Select       │                  │                │
 │   customer ───▶│                  │                │
 │                │── GET /loans ───▶│                │
 │                │   ?customerId    │── check active │
 │                │◀── active loans ─│◀── loans ──────│
 │                │                  │                │
 │── Fill loan    │                  │                │
 │   details ────▶│                  │                │
 │   (principal,  │                  │                │
 │    installments│                  │                │
 │    start date) │                  │                │
 │                │── POST /loans ──▶│                │
 │                │                  │── validate ────│
 │                │                  │── $transaction:│
 │                │                  │   increment    │
 │                │                  │   loanSeq ────▶│
 │                │                  │   create loan ▶│
 │                │                  │   generate     │
 │                │                  │   schedule ───▶│  (120 entries)
 │                │                  │   create       │
 │                │                  │   schedule ───▶│
 │                │◀── 201 {id,     ─│◀── commit ─────│
 │◀── Success ────│    loanNumber}   │                │
```

### 11.3 Payment Posting Flow (Individual)

```
Agent           Browser          API Route         Database
 │                │                  │                │
 │── Select date ─▶│                  │                │
 │   + customer   │── GET /payments ▶│                │
 │                │   ?date=...      │── paid IDs ───▶│
 │                │◀── paid list ────│◀───────────────│
 │                │── GET /loans ───▶│                │
 │                │   ?activeOnDate  │── eligible ───▶│
 │                │◀── loan IDs ────│◀───────────────│
 │                │── filter list ──│                │
 │                │                  │                │
 │── Select       │                  │                │
 │   customer ───▶│── GET /loans ──▶│── customer     │
 │                │   ?customerId   │   loans ──────▶│
 │                │◀── loans ───────│◀───────────────│
 │                │                  │                │
 │── Enter amount ▶│                  │                │
 │   (default =   │                  │                │
 │    installment) │                  │                │
 │── Select mode  │                  │                │
 │   (Cash/UPI) ─▶│                  │                │
 │── Post ────────▶│── POST         ─▶│                │
 │                │   /payments      │── $transaction:│
 │                │                  │   validate ────│
 │                │                  │   check        │
 │                │                  │   outstanding ▶│
 │                │                  │   increment    │
 │                │                  │   receiptSeq ─▶│
 │                │                  │   create       │
 │                │                  │   payment ────▶│
 │                │                  │   if fully paid│
 │                │                  │   → COMPLETED ▶│
 │                │◀── 201 {receipt}─│◀── commit ─────│
 │◀── Success ────│                  │                │
```

### 11.4 Business Import Flow

```
Owner           Browser          API Route         Database
 │                │                  │                │
 │── Upload XLSX ─▶│                  │                │
 │── Click Test ──▶│── POST /import ─▶│                │
 │                │   action=test    │── parse XLSX ──│
 │                │                  │── validate ────│
 │                │                  │   sheets       │
 │                │                  │   cross-refs   │
 │                │◀── {sheetResults,│                │
 │◀── Show report ─│   errors,       │                │
 │   (pass/fail)  │   warnings}     │                │
 │                │                  │                │
 │── Click Import ▶│── POST /import ─▶│                │
 │                │   action=import  │── $transaction:│
 │                │                  │   1. Business ─▶│
 │                │                  │   2. Villages ─▶│
 │                │                  │   3. Users ────▶│
 │                │                  │   4. Biz Assign▶│
 │                │                  │   5. Vil Assign▶│
 │                │                  │   6. Customers ▶│
 │                │                  │   7. Loans +   ▶│
 │                │                  │      Schedule   │
 │                │                  │   8. Payments ─▶│
 │                │                  │   9. Sequences ▶│
 │                │◀── 201 {counts} ─│◀── commit ─────│
 │◀── Redirect ───│   dashboard      │                │
```

---

## 12. UML Class Diagrams

### 12.1 Core TypeScript Interfaces

```
┌─────────────────────────┐
│     AuthUser            │
├─────────────────────────┤
│ id: string              │
│ username: string        │
│ fullName: string        │
│ role: Role              │
│ isActive: boolean       │
│ businessIds: string[]   │
│ activeBusinessId: string│
└─────────────────────────┘

┌─────────────────────────┐     ┌─────────────────────────┐
│  BusinessSettings       │     │     GracePeriodConfig   │
├─────────────────────────┤     ├─────────────────────────┤
│ collectionType: string  │     │ gracePeriodDaily: number│
│ defaultCollectionDay    │     │ gracePeriodWeekly: num  │
│ collectionDays: string  │     │ gracePeriodMonthly: num │
│ repayMultiplierDW: num  │     └─────────────────────────┘
│ repayMultiplierM: num   │
└─────────────────────────┘

┌─────────────────────────┐     ┌─────────────────────────┐
│    ScheduleInput        │     │    ScheduleEntry        │
├─────────────────────────┤     ├─────────────────────────┤
│ startDate: string       │     │ installmentNumber: num  │
│ numberOfInstallments    │     │ dueDate: string         │
│ installmentAmount: num  │     │ amount: number (paise)  │
│ lastInstallmentAmount   │     └─────────────────────────┘
│ collectionType          │
│ collectionDay?: DayOfWeek│
│ collectionDays: string  │
│ holidays: string[]      │
└─────────────────────────┘

┌─────────────────────────┐     ┌─────────────────────────┐
│    ParseResult          │     │    ImportError           │
│  (XLSX Import)          │     ├─────────────────────────┤
├─────────────────────────┤     │ sheet: string           │
│ villages: ImportedVill[]│     │ row: number             │
│ users: ImportedUser[]   │     │ field: string           │
│ customers: ImportedCust│     │ message: string         │
│ loans: ImportedLoan[]   │     └─────────────────────────┘
│ payments: ImportedPay[] │
│ errors: ImportError[]   │
│ warnings: ImportWarn[]  │
│ sheetResults: SheetRes[]│
└─────────────────────────┘

┌──────────────────────────────────────┐
│  DerivedLoanStatus (union type)      │
├──────────────────────────────────────┤
│ 'ACTIVE' | 'OVERDUE' | 'DEFAULTER'  │
│ | 'COMPLETED'                        │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Role (const enum)                   │
├──────────────────────────────────────┤
│ PLATFORM_ADMIN | OWNER |             │
│ BUSINESS_ADMIN | AGENT               │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  CollectionType (const enum)         │
├──────────────────────────────────────┤
│ DAILY | WEEKLY | MONTHLY             │
└──────────────────────────────────────┘
```

### 12.2 Zod Validation Schemas

```
createBusinessSchema
  ├── name: string (min 2)
  ├── city: string (min 2)
  ├── collectionType: enum [DAILY, WEEKLY, MONTHLY]
  ├── interestModel: enum [ADDON, UPFRONT] (default ADDON)
  ├── collectionDays: string (default all days)
  ├── repaymentMultiplierDailyWeekly: number (1-5, optional)
  ├── repaymentMultiplierMonthly: number (1-5, optional)
  └── villages: string[] (min 1)

createCustomerSchema
  ├── fullName: string (min 2)
  ├── phone: phoneSchema (optional)
  ├── villageId: string
  ├── age: number (18-100, optional)
  ├── aadhaar: 12 digits (optional)
  └── guarantorName, guarantorPhone, address, notes (optional)

createLoanSchema
  ├── customerId: string
  ├── loanAmount: number (int, positive, paise)
  ├── interestAmount: number (int, min 0, paise)
  ├── installmentAmount: number (int, positive, paise)
  ├── numberOfInstallments: number (int, positive)
  ├── startDate: string (YYYY-MM-DD)
  ├── collectionType: enum [DAILY, WEEKLY, MONTHLY]
  └── agentId, notes, documents (optional)

createPaymentSchema
  ├── loanId: string
  ├── amount: number (int, positive, paise)
  ├── paymentDate: string (YYYY-MM-DD)
  └── note, latitude, longitude (optional)
```

---

**Footer:** Confidential — Daily Finance
