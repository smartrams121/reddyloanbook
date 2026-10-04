# Sections 13–16: Security, SOX Compliance, Governance, Test Cases

---

## 13. Security Architecture

### 13.1 Authentication Security

| Layer | Implementation |
|-------|---------------|
| Password Storage | bcryptjs with 12 salt rounds |
| Session Tokens | JWT (jsonwebtoken) in httpOnly, sameSite cookie |
| Session Expiry | Configurable per deployment (default 24h) |
| Auto-Logout | Per-business configurable timer (default 30 min) |
| First Login | `mustChangePassword` flag forces password change |
| 2FA | TOTP (Time-based One-Time Password) via otplib + qrcode |

### 13.2 Data Security

| Data | Protection |
|------|-----------|
| Aadhaar (National ID) | SHA-256 hash stored; only last 4 digits in `aadhaarLast4` |
| Passwords | Never stored plaintext; bcrypt hash only |
| File Uploads | Stored on server filesystem, served via authenticated routes |
| API Keys/Secrets | Environment variables (.env), never in codebase |

### 13.3 Access Control

| Mechanism | Implementation |
|-----------|---------------|
| Route Protection | `middleware.ts` — intercepts all requests, checks JWT cookie |
| RBAC | `permissions.ts` — 36 permissions across 4 roles, `assertPermission()` |
| Tenant Isolation | `scope.ts` — `assertBusinessAccess()` validates user has access to requested business |
| Agent Scoping | Village-level: agents only see assigned villages' customers, own loans, own payments |
| Rate Limiting | `rate-limit.ts` — in-memory limiter on login/register endpoints |

### 13.4 Transport Security

| Layer | Status |
|-------|--------|
| HTTPS | Planned (Let's Encrypt via Nginx) |
| HTTP | Current (internal network) |
| Cookie | httpOnly, sameSite (prevents XSS token theft) |

### 13.5 Input Validation

| Layer | Tool |
|-------|------|
| Client | HTML5 form validation (required, min, max, pattern) |
| Server | Zod schemas on every API route — reject malformed data before DB |
| Database | Prisma schema constraints (unique, @default, relations) |

---

## 14. SOX Compliance

### 14.1 Audit Trail

| Requirement | Implementation |
|-------------|---------------|
| Who did what | `AuditLog` model: userId, action, entityType, entityId, details |
| When | `createdAt` timestamp on AuditLog |
| From where | `ipAddress` field on AuditLog |
| What changed | `details` JSON field captures before/after state |

### 14.2 Financial Data Integrity

| Requirement | Implementation |
|-------------|---------------|
| Accurate calculations | Money in paise (integers) — no floating-point rounding errors |
| Atomic transactions | All financial writes in Prisma `$transaction` blocks |
| Sequence integrity | `customerSeq`, `loanSeq`, `receiptSeq` auto-increment in transactions |
| No backdating beyond limit | Payments restricted to max 1 month in past |
| No future dating | Payments blocked for future dates |
| Outstanding check | Payment amount cannot exceed loan outstanding balance |
| Auto-completion | Loan auto-marked COMPLETED when fully paid |

### 14.3 Access Controls

| Requirement | Implementation |
|-------------|---------------|
| Segregation of duties | 4-tier role hierarchy (Admin → Owner → Business Admin → Agent) |
| Least privilege | Agents can only post payments, not create/edit loans |
| Business isolation | `assertBusinessAccess()` on every business-scoped API |
| Password policy | Minimum 4 characters, forced change on first login |
| Session management | JWT expiry, auto-logout timer, manual logout |

### 14.4 Data Retention

| Data | Retention |
|------|----------|
| Payments | Soft delete (`isDeleted` flag) — never permanently lost |
| Audit logs | Permanent retention |
| Customer data | Retained until explicit deletion by owner |
| Backups | Daily automated, retained on server |

---

## 15. Governance & Assumptions

### 15.1 Data Governance

| Policy | Implementation |
|--------|---------------|
| Data ownership | Each business owner owns their data |
| Data isolation | Owner-level and business-level tenant isolation |
| Data export | Full business data export as XLSX (Settings → Export) |
| Data deletion | Danger Zone with "DELETE" confirmation; cascade deletes loans, payments, documents |
| Aadhaar handling | Hashed storage, last 4 only visible, compliant with UIDAI guidelines |

### 15.2 Backup Strategy

| Component | Strategy |
|-----------|---------|
| Database | Daily automated `pg_dump` via cron → local backup directory |
| Uploads | Volume-mounted `/app/uploads/` — included in server snapshots |
| Code | Git repository (GitHub) — full version history |
| Configuration | `.env` file on server (not in git) |

### 15.3 Regulatory Considerations

- **RBI Guidelines**: Platform designed for informal lending tracking; formal NBFC registration may be required for scale
- **Aadhaar Act**: SHA-256 hashing + last 4 storage follows UIDAI data minimization principles
- **DPDP Act (India)**: Personal data stored with purpose limitation; export/delete capabilities exist

---

## 16. Test Cases and Test Results

### 16.1 Test Framework

| Tool | Purpose |
|------|---------|
| Vitest | Unit and integration test runner |
| TypeScript | Type-safe test assertions |

### 16.2 Test Commands

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode for development
```

### 16.3 Unit Tests

| Test Suite | File | Cases |
|-----------|------|-------|
| Loan Calculations | `tests/unit/loan-calc.test.ts` | calculateLoan, validateLoanAmounts, calculateBalance, lastInstallmentAmount |
| Money Formatting | `tests/unit/money.test.ts` | formatPaiseShort, rupeesToPaise, edge cases (0, negative, large values) |

### 16.4 Integration Tests

| Test Suite | File | Cases |
|-----------|------|-------|
| Data Isolation | `tests/integration/isolation.test.ts` | Business-level data isolation, owner cannot access other owner's data |

### 16.5 Manual Test Cases

| # | Feature | Test Steps | Expected Result |
|---|---------|-----------|----------------|
| 1 | Login | Enter valid credentials → submit | Redirect to dashboard |
| 2 | Login (invalid) | Enter wrong password → submit | Error message |
| 3 | Create Customer | Fill name + village → submit | Customer created with auto-generated ID |
| 4 | Create Loan (ADDON) | Principal 10000, multiplier 1.20 | Total repayable = 12000, schedule generated |
| 5 | Post Payment | Select customer → loan → amount → submit | Payment recorded, receipt generated |
| 6 | Overdue Detection | Loan past end date + grace period | Status shows OVERDUE |
| 7 | Auto-Complete | Pay remaining balance | Loan status → COMPLETED |
| 8 | Agent Isolation | Login as agent, view loans | Only own assigned loans visible |
| 9 | Business Export | Settings → Download Data | XLSX with 5 sheets downloaded |
| 10 | Business Import | Upload XLSX → Test → Import | Business recreated with all data |
| 11 | Bulk Posting | Select village → fill amounts → submit 10 | 10 payments created, next batch loads |
| 12 | Android Download | Download XLSX on Android Chrome | File downloads (not blocked by popup blocker) |

---

**Footer:** Confidential — Daily Finance
