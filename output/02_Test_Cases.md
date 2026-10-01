# Daily Finance — Test Cases Document

**Document Version:** 1.0
**Date:** 01/10/2026
**Classification:** Internal Use Only

---

## Test Case Index

| Module | Happy Path | Negative | Corner Cases | Total |
|--------|:---------:|:--------:|:------------:|:-----:|
| AUTH-LOGIN | 3 | 5 | 3 | 11 |
| AUTH-REGISTER | 3 | 6 | 3 | 12 |
| AUTH-PASSWORD | 3 | 4 | 2 | 9 |
| ADMIN-OWNERS | 4 | 4 | 2 | 10 |
| ADMIN-REGISTRATION | 3 | 3 | 2 | 8 |
| ADMIN-PASSWORD-RESET | 3 | 3 | 1 | 7 |
| BUSINESS-SETTINGS | 3 | 2 | 1 | 6 |
| VILLAGES | 3 | 3 | 2 | 8 |
| CUSTOMERS | 4 | 4 | 3 | 11 |
| LOANS | 4 | 4 | 3 | 11 |
| PAYMENTS | 4 | 4 | 3 | 11 |
| USERS-EMPLOYEES | 4 | 3 | 2 | 9 |
| REPORTS | 2 | 2 | 1 | 5 |
| BULK-OPS | 3 | 2 | 2 | 7 |
| **TOTAL** | **46** | **49** | **30** | **125** |

---

## Module 1: AUTH-LOGIN

### Happy Path

| TC# | Test Case | Precondition | Steps | Expected Result |
|-----|-----------|-------------|-------|-----------------|
| AUTH-L-HP-01 | Login with valid credentials | Active PA user exists | POST /api/auth/login with valid username/password | 200, success=true, auth-token cookie set, redirectTo present |
| AUTH-L-HP-02 | Login returns correct user info | Active user exists | POST /api/auth/login | Response contains user.id, user.fullName, user.role |
| AUTH-L-HP-03 | Logout clears session | Authenticated session | POST /api/auth/logout with valid cookie | 200, success=true, cookie cleared |

### Negative

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| AUTH-L-NEG-01 | Login with wrong password | POST /api/auth/login with wrong password | 401, "Invalid credentials" |
| AUTH-L-NEG-02 | Login with non-existent username | POST with unknown username | 401, "Invalid credentials" |
| AUTH-L-NEG-03 | Login with empty body | POST with {} | 400, validation error |
| AUTH-L-NEG-04 | Login with deactivated user | POST with isActive=false user | 401, "account has been deactivated" |
| AUTH-L-NEG-05 | Access /api/auth/me without auth | GET /api/auth/me without cookie | 401, "Unauthorized" |

### Corner Cases

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| AUTH-L-CC-01 | Rate limiting after 5 failed attempts | POST 5x with wrong password, then correct password | 429 on 6th attempt even with correct password |
| AUTH-L-CC-02 | Session expiry | Use expired session token | 401 on /api/auth/me |
| AUTH-L-CC-03 | Concurrent sessions | Login from two clients | Both sessions valid |

---

## Module 2: AUTH-REGISTER

### Happy Path

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| AUTH-R-HP-01 | Check username availability | GET /api/auth/check-username?username=newuser123 | 200, available=true |
| AUTH-R-HP-02 | Register with all fields | POST /api/auth/register with full valid data | 201, success=true |
| AUTH-R-HP-03 | Register without optional fields | POST without email, businessName, city, villages | 201, success=true |

### Negative

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| AUTH-R-NEG-01 | Register with taken username | POST with existing username | 409, "Username is already taken" |
| AUTH-R-NEG-02 | Register with weak password | POST with password "abc" | 400, validation error |
| AUTH-R-NEG-03 | Register with mismatched passwords | POST with password ≠ confirmPassword | 400, validation error |
| AUTH-R-NEG-04 | Register with invalid phone | POST with phone="12345" | 400, validation error |
| AUTH-R-NEG-05 | Register with pending username | POST with username that has PENDING request | 409, "pending" |
| AUTH-R-NEG-06 | Rate limit registration | POST 4x rapidly | 429 on 4th attempt |

### Corner Cases

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| AUTH-R-CC-01 | Username with dots/underscores | GET check-username?username=user.name_1 | available=true (valid chars) |
| AUTH-R-CC-02 | Username too short (< 4 chars) | GET check-username?username=ab | available=false |
| AUTH-R-CC-03 | Deleted user's username reuse | Register with username of deleted owner | 201, success (username freed) |

---

## Module 3: AUTH-PASSWORD

### Happy Path

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| AUTH-P-HP-01 | Forgot password creates request | POST /api/auth/forgot-password with valid phone | 200, generic message |
| AUTH-P-HP-02 | Change password (forced) | POST /api/auth/change-password with valid new password | 200, success=true, redirectTo="/dashboard" |
| AUTH-P-HP-03 | Change password via profile | PATCH /api/auth/profile with action=changePassword | 200, success=true, new cookie set |

### Negative

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| AUTH-P-NEG-01 | Change password with wrong current | PATCH profile with wrong currentPassword | 401, "incorrect" |
| AUTH-P-NEG-02 | Forgot password with invalid phone | POST with phone="abc" | 400, validation error |
| AUTH-P-NEG-03 | Change password too short | POST change-password with "ab" | 400, validation error |
| AUTH-P-NEG-04 | Change password without auth | POST change-password without cookie | 401 |

### Corner Cases

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| AUTH-P-CC-01 | Forgot password for non-existent phone | POST with unknown phone | 200, same generic message (no info leak) |
| AUTH-P-CC-02 | Multiple reset requests for same user | POST forgot-password 2x for same phone | Both create requests (up to rate limit) |

---

## Module 4: ADMIN-OWNERS

### Happy Path

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| ADM-O-HP-01 | List all owners | GET /api/admin/owners (as PA) | 200, array of owners with businesses |
| ADM-O-HP-02 | Create new owner | POST /api/admin/owners with valid data | 201, id + username + fullName |
| ADM-O-HP-03 | Get owner details | GET /api/admin/owners/:id (as PA) | 200, owner with businesses array |
| ADM-O-HP-04 | Update owner profile | PATCH /api/admin/owners/:id with {fullName} | 200, updated fields |

### Negative

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| ADM-O-NEG-01 | Create owner with duplicate username | POST with existing username | 409, "Username already taken" |
| ADM-O-NEG-02 | Non-PA tries to list owners | GET /api/admin/owners as OWNER | 403, PermissionError |
| ADM-O-NEG-03 | Delete owner with active businesses | DELETE /api/admin/owners/:id (has active biz) | 400, "Cannot delete" |
| ADM-O-NEG-04 | Get non-existent owner | GET /api/admin/owners/fake-id | 404 |

### Corner Cases

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| ADM-O-CC-01 | Delete owner frees username | DELETE owner, then check-username | username available |
| ADM-O-CC-02 | Deactivate owner invalidates sessions | PATCH isActive=false | All owner sessions deleted |

---

## Module 5: ADMIN-REGISTRATION

### Happy Path

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| ADM-RR-HP-01 | List pending registrations | GET /api/admin/registration-requests?status=PENDING | 200, filtered array |
| ADM-RR-HP-02 | Approve registration | POST /approve with valid PENDING request | 200, creates User + Business + Villages |
| ADM-RR-HP-03 | Reject registration | POST /reject with reason | 200, status=REJECTED |

### Negative

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| ADM-RR-NEG-01 | Approve non-PENDING request | POST /approve on REJECTED request | 400, "not pending" |
| ADM-RR-NEG-02 | Reject without reason | POST /reject with {} | 400, validation error |
| ADM-RR-NEG-03 | Approve with duplicate username (user created externally) | Create user with same username, then approve | 400, "username already exists" |

### Corner Cases

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| ADM-RR-CC-01 | Approve copies email to User | Approve request that has email | User.email = regRequest.email |
| ADM-RR-CC-02 | Pending count badge | GET /pending-count | 200, {count: N} matches pending count |

---

## Module 6: ADMIN-PASSWORD-RESET

### Happy Path

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| ADM-PR-HP-01 | List pending resets | GET /api/admin/password-resets?status=PENDING | 200, array with user details |
| ADM-PR-HP-02 | Reset password | POST /reset with newPassword | 200, password changed, sessions invalidated |
| ADM-PR-HP-03 | Cancel reset | POST /cancel with note | 200, status=CANCELLED |

### Negative

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| ADM-PR-NEG-01 | Reset non-PENDING request | POST /reset on COMPLETED request | 400 |
| ADM-PR-NEG-02 | Reset with weak password | POST /reset with password "ab" | 400, validation |
| ADM-PR-NEG-03 | Non-PA tries to reset | POST /reset as OWNER | 403 |

### Corner Cases

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| ADM-PR-CC-01 | Reset sets mustChangePassword | POST /reset | User.mustChangePassword = true |

---

## Module 7: BUSINESS-SETTINGS

### Happy Path

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| BIZ-S-HP-01 | Get business settings | GET /api/b/:bid/settings | 200, full settings object |
| BIZ-S-HP-02 | Update settings | PATCH with {gracePeriodDaily: 45} | 200, updated |
| BIZ-S-HP-03 | Export business data | GET /api/b/:bid/settings/export | 200, .xlsx binary |

### Negative

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| BIZ-S-NEG-01 | Access other owner's business | GET /api/b/:other-bid/settings | 403, ScopeError |
| BIZ-S-NEG-02 | Agent tries to edit settings | PATCH as AGENT | 403, PermissionError |

### Corner Cases

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| BIZ-S-CC-01 | Delete business cascades all data | DELETE /api/b/:bid/settings | All loans, customers, payments deleted |

---

## Module 8: VILLAGES

### Happy Path

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| VIL-HP-01 | List villages | GET /api/b/:bid/villages | 200, array with customer counts |
| VIL-HP-02 | Create village | POST with {name: "New Village"} | 201, village object |
| VIL-HP-03 | Update village | PATCH with {name: "Renamed"} | 200, updated |

### Negative

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| VIL-NEG-01 | Create duplicate village name | POST with existing name in same business | 400/409, unique constraint |
| VIL-NEG-02 | Delete village with customers | DELETE village that has customers | 400, "has customers" |
| VIL-NEG-03 | Agent creates village | POST as AGENT | 403, PermissionError |

### Corner Cases

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| VIL-CC-01 | Agent sees only assigned villages | GET villages as AGENT | Only assigned villages returned |
| VIL-CC-02 | Deactivate village | PATCH {isActive: false} | Village hidden from active lists |

---

## Module 9: CUSTOMERS

### Happy Path

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| CUST-HP-01 | List customers | GET /api/b/:bid/customers | 200, array with loan counts |
| CUST-HP-02 | Create customer | POST with required fields | 201, auto-generated customerId |
| CUST-HP-03 | Get customer detail | GET /api/b/:bid/customers/:cid | 200, full detail with loans + summary |
| CUST-HP-04 | Update customer | PATCH with {phone: "9876543211"} | 200, updated |

### Negative

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| CUST-NEG-01 | Create without required phone | POST without phone | 400, validation error |
| CUST-NEG-02 | Create with invalid phone | POST with phone="123" | 400, validation error |
| CUST-NEG-03 | Create with invalid villageId | POST with non-existent villageId | 404 or 400 |
| CUST-NEG-04 | Agent edits customer | PATCH as AGENT | 403, PermissionError |

### Corner Cases

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| CUST-CC-01 | Aadhaar stored as hash | POST with aadhaar="123456789012" | aadhaarHash = SHA-256 hash, aadhaarLast4 = "9012" |
| CUST-CC-02 | Customer ID auto-increment | Create 2 customers | Sequential customerId values |
| CUST-CC-03 | Customer with age boundary | POST with age=17 | 400, age must be 18-100 |

---

## Module 10: LOANS

### Happy Path

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| LOAN-HP-01 | List loans | GET /api/b/:bid/loans | 200, array with customer/agent info |
| LOAN-HP-02 | Create loan | POST with valid data | 201, loanNumber auto-generated, schedule created |
| LOAN-HP-03 | Get loan detail | GET /api/b/:bid/loans/:lid | 200, full detail with schedule |
| LOAN-HP-04 | Update loan | PATCH with {notes: "Updated"} | 200, updated |

### Negative

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| LOAN-NEG-01 | Create without customerId | POST without customerId | 400, validation error |
| LOAN-NEG-02 | Create with negative amount | POST with loanAmount=-100 | 400, validation error |
| LOAN-NEG-03 | Create with invalid date | POST with startDate="not-a-date" | 400, validation error |
| LOAN-NEG-04 | Agent creates loan | POST as AGENT | 403, PermissionError |

### Corner Cases

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| LOAN-CC-01 | Loan renewal links old loan | POST with renewFromLoanId | New loan linked, old loan closed |
| LOAN-CC-02 | Schedule generation accuracy | POST with 10 installments | 10 LoanScheduleEntry records with correct dates |
| LOAN-CC-03 | Loan number sequential | Create 2 loans | LN-0001, LN-0002 pattern |

---

## Module 11: PAYMENTS

### Happy Path

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| PAY-HP-01 | Post payment | POST /api/b/:bid/payments | 201, receiptNumber generated |
| PAY-HP-02 | List payments | GET /api/b/:bid/payments?loanId=x | 200, array with details |
| PAY-HP-03 | Bulk payment | POST /api/b/:bid/payments/bulk | 201, count + totalAmount |
| PAY-HP-04 | Get village posting data | GET /api/b/:bid/posting/village?villageId=x | 200, customers with outstanding |

### Negative

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| PAY-NEG-01 | Payment on non-existent loan | POST with loanId="fake" | 404 |
| PAY-NEG-02 | Payment with zero amount | POST with amount=0 | 400, validation |
| PAY-NEG-03 | Payment exceeds outstanding | POST with amount > outstanding | 400, "exceeds" or auto-complete |
| PAY-NEG-04 | Bulk with duplicate loanIds | POST bulk with same loanId twice | 400, "duplicate" |

### Corner Cases

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| PAY-CC-01 | Payment auto-completes loan | Post payment that makes totalPaid >= totalRepayable | Loan status = COMPLETED |
| PAY-CC-02 | Backdate payment | POST with paymentDate in past | 201, if user has backdate_payment permission |
| PAY-CC-03 | Update existing payment | POST with existingPaymentId | 200, updated=true |

---

## Module 12: USERS-EMPLOYEES

### Happy Path

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| USR-HP-01 | List employees | GET /api/b/:bid/users | 200, array with village assignments |
| USR-HP-02 | Create agent | POST with role=AGENT | 201, user created + assigned |
| USR-HP-03 | Update employee | PATCH with {fullName: "New Name"} | 200, updated |
| USR-HP-04 | Delete employee | DELETE /api/b/:bid/users/:uid | 200, removed from business |

### Negative

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| USR-NEG-01 | Create with duplicate username | POST with existing username | 409, "already taken" |
| USR-NEG-02 | Delete owner via employee endpoint | DELETE where role=OWNER | 400, "Cannot delete the business owner" |
| USR-NEG-03 | Agent creates employee | POST as AGENT | 403, PermissionError |

### Corner Cases

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| USR-CC-01 | Delete last assignment deletes User | Remove agent from only business | User record fully deleted, username freed |
| USR-CC-02 | Multi-business assignment | PATCH with businessIds=[b1,b2] | Assigned to both businesses |

---

## Module 13: REPORTS

### Happy Path

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| RPT-HP-01 | Generate loan report | GET /api/b/:bid/reports?entity=loans&from=...&to=... | 200, columns + rows |
| RPT-HP-02 | Download Excel report | GET /api/b/:bid/reports/download?format=xlsx | 200, .xlsx binary |

### Negative

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| RPT-NEG-01 | Report without date range | GET /api/b/:bid/reports?entity=loans | 400, "from/to required" |
| RPT-NEG-02 | Agent tries loan report | GET reports?entity=loans as AGENT | 403, PermissionError |

### Corner Cases

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| RPT-CC-01 | Report with no data in range | GET with future date range | 200, rows=[] (empty, no error) |

---

## Module 14: BULK-OPS

### Happy Path

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| BULK-HP-01 | Bulk status change | PATCH /api/b/:bid/customers/bulk with changeStatus | 200, updated=N |
| BULK-HP-02 | Bulk delete customers | DELETE /api/b/:bid/customers/bulk | 200, deleted=N |
| BULK-HP-03 | Bulk delete loans | POST /api/b/:bid/loans/bulk with action=delete | 200, count=N |

### Negative

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| BULK-NEG-01 | Delete customers with loans | DELETE bulk with customers that have loans | 400, "have active loans" |
| BULK-NEG-02 | Bulk with empty array | POST with customerIds=[] | 400, validation error |

### Corner Cases

| TC# | Test Case | Steps | Expected Result |
|-----|-----------|-------|-----------------|
| BULK-CC-01 | Bulk at max limit (500) | PATCH with 500 customerIds | 200, all processed |
| BULK-CC-02 | Bulk loan delete cascades | POST delete with loans that have payments | Payments + schedule entries deleted |

---

**Internal Use Only**
