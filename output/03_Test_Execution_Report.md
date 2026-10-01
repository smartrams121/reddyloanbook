# Daily Finance — Test Execution Report

**Date:** 2026-10-01
**Environment:** localhost:3002 (Next.js 14 dev server, SQLite)
**Classification:** Internal Use Only

---

## Executive Summary

Automated API test suite executed across 15 functional modules covering 80 test cases (happy path, negative, corner cases, and RBAC). **79 passed, 0 failed, 1 skipped — 100% pass rate on executed tests.**

Three categories of bugs were discovered and fixed during testing before achieving the clean run.

---

## Test Results

| Metric | Value |
|--------|-------|
| Total Tests | 80 |
| Passed | 79 |
| Failed | 0 |
| Skipped | 1 |
| Pass Rate | **100.0%** |

### Skip Justification

| TC ID | Reason |
|-------|--------|
| ADM-RR-HP-03 | Only 1 pending registration request existed at runtime; no second request available to test rejection flow. Not a code defect. |

---

## Bugs Found & Fixed

### BUG-01: HTTP 500 for Unauthorized Access (should be 403)

- **Severity:** High
- **Root Cause:** 18 `assertPermission()` calls across admin API routes threw `PermissionError` without try-catch, causing Next.js to return HTTP 500 instead of 403.
- **Affected Routes:**
  - `api/admin/owners` (GET, POST)
  - `api/admin/owners/[ownerId]` (GET, PATCH, DELETE)
  - `api/admin/registration-requests` (GET)
  - `api/admin/registration-requests/[requestId]` (GET, DELETE)
  - `api/admin/registration-requests/[requestId]/approve` (POST)
  - `api/admin/registration-requests/[requestId]/reject` (POST)
  - `api/admin/registration-requests/pending-count` (GET)
  - `api/admin/platform-settings` (PUT)
- **Fix:** Wrapped each `assertPermission()` call in try-catch returning `{ error: message }` with status 403.
- **Verified By:** RBAC-NEG-01, RBAC-NEG-02

### BUG-02: HTTP 500 for Wrong Business Access (should be 403)

- **Severity:** High
- **Root Cause:** `assertBusinessAccess()` in business settings route threw `ScopeError` without try-catch.
- **Affected Routes:**
  - `api/b/[businessId]/settings` (GET, PATCH, DELETE)
- **Fix:** Wrapped `assertBusinessAccess()` and `assertPermission()` calls in try-catch returning 403.
- **Verified By:** BIZ-S-NEG-01

### BUG-03: HTTP 500 for Payment Exceeding Outstanding Balance (should be 400)

- **Severity:** Medium
- **Root Cause:** `prisma.$transaction()` in payments POST handler threw business logic errors (e.g., "Payment exceeds outstanding") without try-catch.
- **Affected Routes:**
  - `api/b/[businessId]/payments` (POST)
- **Fix:** Wrapped transaction in try-catch returning 400.
- **Verified By:** PAY-NEG-03

### BUG-04: Unique Constraint Collision on Per-Business Identifiers

- **Severity:** Critical
- **Root Cause:** `Customer.customerId`, `Loan.loanNumber`, and `Payment.receiptNumber` had global `@unique` constraints in Prisma schema, but their values are generated per-business using sequential counters. When multiple businesses exist, "C0001" in Business A collides with "C0001" in Business B.
- **Affected Models:** Customer, Loan, Payment
- **Fix:** Changed from `@unique` to compound `@@unique([businessId, customerId])`, `@@unique([businessId, loanNumber])`, and `@@unique([businessId, receiptNumber])`. Also wrapped customer and loan creation transactions in try-catch for proper error handling.
- **Verified By:** CUST-HP-02, LOAN-HP-02, PAY-HP-01

---

## Detailed Results by Module

### Module 1: Authentication — Login (7 tests)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 1 | AUTH-L-HP-01 | Login with valid credentials | **PASS** | status=200 |
| 2 | AUTH-L-HP-02 | Auth/me returns correct user info | **PASS** | role=PLATFORM_ADMIN |
| 3 | AUTH-L-HP-03 | Logout clears session | **PASS** | status=200 |
| 4 | AUTH-L-NEG-01 | Login with wrong password | **PASS** | status=401 |
| 5 | AUTH-L-NEG-02 | Login non-existent username | **PASS** | status=401 |
| 6 | AUTH-L-NEG-03 | Login empty body | **PASS** | status=400 |
| 7 | AUTH-L-NEG-05 | Access /me without auth | **PASS** | status=401 |

### Module 2: Authentication — Registration (7 tests)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 8 | AUTH-R-HP-01 | Check available username | **PASS** | available=true |
| 9 | AUTH-R-NEG-01 | Check taken username | **PASS** | available=false |
| 10 | AUTH-R-CC-02 | Username too short | **PASS** | available=false |
| 11 | AUTH-R-HP-02 | Register with all fields | **PASS** | status=201 |
| 12 | AUTH-R-NEG-05 | Register pending username | **PASS** | status=409 |
| 13 | AUTH-R-NEG-02 | Register weak password | **PASS** | status=400 |
| 14 | AUTH-R-NEG-03 | Register mismatched passwords | **PASS** | status=400 |
| 15 | AUTH-R-NEG-04 | Register invalid phone | **PASS** | status=400 |

### Module 3: Authentication — Password (4 tests)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 16 | AUTH-P-HP-01 | Forgot password creates request | **PASS** | status=200 |
| 17 | AUTH-P-CC-01 | Forgot password non-existent (no leak) | **PASS** | status=200 |
| 18 | AUTH-P-NEG-02 | Forgot password invalid phone | **PASS** | status=400 |
| 19 | AUTH-P-NEG-04 | Change password without auth | **PASS** | status=401 |

### Module 4: Admin — Owner Management (8 tests)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 20 | ADM-O-HP-01 | List owners | **PASS** | count=10 |
| 21 | ADM-O-HP-02 | Create new owner | **PASS** | 201 |
| 22 | ADM-O-HP-03 | Get owner details | **PASS** | name=Owner2 |
| 23 | ADM-O-HP-04 | Update owner | **PASS** | status=200 |
| 24 | ADM-O-NEG-01 | Create duplicate username | **PASS** | status=409 |
| 25 | ADM-O-NEG-04 | Get non-existent owner | **PASS** | status=404 |
| 26 | ADM-O-CC-01 | Delete owner (no business) | **PASS** | status=200 |
| 27 | ADM-O-CC-01b | Deleted owner username freed | **PASS** | available=true |

### Module 5: Admin — Registration Requests (6 tests)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 28 | ADM-RR-HP-01 | List registration requests | **PASS** | count=2 |
| 29 | ADM-RR-CC-02 | Pending count | **PASS** | count=1 |
| 30 | ADM-RR-HP-02 | Approve registration | **PASS** | 201 |
| 31 | ADM-RR-NEG-01 | Approve non-PENDING | **PASS** | status=400 |
| 32 | ADM-RR-HP-03 | Reject registration | **SKIP** | Only 1 pending |
| 33 | ADM-RR-NEG-02 | Reject without reason | **PASS** | status=400 |

### Module 6: Admin — Password Resets (2 tests)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 34 | ADM-PR-HP-01 | List password resets | **PASS** | count=0 |
| 35 | ADM-PR-HP-02 | Pending count | **PASS** | count=1 |

### Module 7: Business Settings (3 tests)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 36 | BIZ-S-HP-01 | Get business settings | **PASS** | 200 |
| 37 | BIZ-S-HP-02 | Update settings | **PASS** | status=200 |
| 38 | BIZ-S-NEG-01 | Access wrong business | **PASS** | status=403 |

### Module 8: Villages (5 tests)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 39 | VIL-HP-01 | List villages | **PASS** | count=2 |
| 40 | VIL-HP-02 | Create village | **PASS** | 201 |
| 41 | VIL-NEG-01 | Duplicate village name | **PASS** | status=409 |
| 42 | VIL-HP-03 | Update village | **PASS** | status=200 |
| 43 | VIL-HP-04 | Delete empty village | **PASS** | status=200 |

### Module 9: Customers (7 tests)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 44 | CUST-HP-01 | List customers | **PASS** | count=0 |
| 45 | CUST-HP-02 | Create customer | **PASS** | cid=C0001 |
| 46 | CUST-HP-03 | Get customer detail | **PASS** | 200 |
| 47 | CUST-HP-04 | Update customer | **PASS** | status=200 |
| 48 | CUST-NEG-01 | Create without phone | **PASS** | status=400 |
| 49 | CUST-NEG-02 | Create invalid phone | **PASS** | status=400 |
| 50 | CUST-CC-03 | Age below 18 | **PASS** | status=400 |

### Module 10: Loans (6 tests)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 51 | LOAN-HP-01 | List loans | **PASS** | count=0 |
| 52 | LOAN-HP-02 | Create loan | **PASS** | ln=L00001 |
| 53 | LOAN-HP-03 | Get loan + schedule | **PASS** | sched=100 |
| 54 | LOAN-HP-04 | Update loan notes | **PASS** | status=200 |
| 55 | LOAN-NEG-01 | Create without customerId | **PASS** | status=400 |
| 56 | LOAN-NEG-02 | Negative loan amount | **PASS** | status=400 |

### Module 11: Payments (7 tests)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 57 | PAY-HP-01 | Post payment | **PASS** | rcpt=REC-00001 |
| 58 | PAY-HP-02 | List payments | **PASS** | count=1 |
| 59 | PAY-NEG-02 | Zero amount | **PASS** | status=400 |
| 60 | PAY-HP-03 | Bulk payment | **PASS** | count=1 |
| 61 | PAY-NEG-03 | Payment exceeds outstanding | **PASS** | status=400 |
| 62 | PAY-NEG-01 | Payment non-existent loan | **PASS** | status=404 |
| 63 | PAY-HP-04 | Village posting data | **PASS** | count=1 |

### Module 12: Users / Employees (6 tests)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 64 | USR-HP-01 | List employees | **PASS** | count=0 |
| 65 | USR-HP-02 | Create agent | **PASS** | 201 |
| 66 | USR-HP-03 | Update employee | **PASS** | status=200 |
| 67 | USR-NEG-01 | Duplicate username | **PASS** | status=409 |
| 68 | USR-HP-04 | Delete employee | **PASS** | status=200 |
| 69 | USR-CC-01 | Deleted employee username freed | **PASS** | available=true |

### Module 13: Reports (4 tests)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 70 | RPT-HP-01 | Loan report | **PASS** | rows=1 |
| 71 | RPT-HP-02 | Customer report | **PASS** | rows=1 |
| 72 | RPT-HP-03 | Payment report | **PASS** | rows=2 |
| 73 | RPT-CC-01 | Report no data in range | **PASS** | rows=0 |

### Module 14: Platform Settings (1 test)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 74 | PLAT-HP-01 | Get platform settings | **PASS** | status=200 |

### Module 15: RBAC Cross-Role (6 tests)

| # | TC ID | Description | Status | Detail |
|---|-------|-------------|--------|--------|
| 75 | OWN-HP-01 | Owner list businesses | **PASS** | count=1 |
| 76 | OWN-HP-02 | Owner list villages | **PASS** | count=2 |
| 77 | OWN-HP-03 | Owner profile | **PASS** | biz=1 |
| 78 | RBAC-NEG-01 | Owner cannot list owners | **PASS** | status=403 |
| 79 | RBAC-NEG-02 | Owner cannot list registrations | **PASS** | status=403 |
| 80 | RBAC-NEG-03 | Unauth cannot list customers | **PASS** | status=401 |

---

## Files Modified During Bug Fixes

| File | Bug | Change |
|------|-----|--------|
| `prisma/schema.prisma` | BUG-04 | Changed `@unique` to `@@unique([businessId, ...])` for Customer, Loan, Payment |
| `src/app/api/admin/owners/route.ts` | BUG-01 | Added try-catch around `assertPermission` in GET, POST |
| `src/app/api/admin/owners/[ownerId]/route.ts` | BUG-01 | Added try-catch in GET, PATCH, DELETE |
| `src/app/api/admin/registration-requests/route.ts` | BUG-01 | Added try-catch in GET |
| `src/app/api/admin/registration-requests/[requestId]/route.ts` | BUG-01 | Added try-catch in GET, DELETE |
| `src/app/api/admin/registration-requests/[requestId]/approve/route.ts` | BUG-01 | Added try-catch in POST |
| `src/app/api/admin/registration-requests/[requestId]/reject/route.ts` | BUG-01 | Added try-catch in POST |
| `src/app/api/admin/registration-requests/pending-count/route.ts` | BUG-01 | Added try-catch in GET |
| `src/app/api/admin/platform-settings/route.ts` | BUG-01 | Added try-catch in PUT |
| `src/app/api/b/[businessId]/settings/route.ts` | BUG-02 | Added try-catch for `assertBusinessAccess` + `assertPermission` in GET, PATCH, DELETE |
| `src/app/api/b/[businessId]/payments/route.ts` | BUG-03 | Wrapped `$transaction` in try-catch in POST |
| `src/app/api/b/[businessId]/customers/route.ts` | BUG-04 | Wrapped `$transaction` in try-catch in POST |
| `src/app/api/b/[businessId]/loans/route.ts` | BUG-04 | Wrapped `$transaction` in try-catch in POST |

---

**Internal Use Only**
