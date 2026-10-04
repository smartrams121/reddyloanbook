# Sections 7–9: Data Model, RBAC, API Reference

---

## 7. Data Model & Entity Relationships

### 7.1 Entity-Relationship Diagram

```
┌──────────┐     ┌──────────────┐     ┌───────────┐
│   User   │────<│UserBusiness  │>────│  Business  │
│          │     │ Assignment   │     │            │
│ id       │     └──────────────┘     │ id         │
│ username │                          │ name       │
│ fullName │     ┌──────────────┐     │ ownerId ──→│User
│ role     │────<│UserVillage   │     │ collType   │
│ password │     │ Assignment   │     │ multiplier │
│ isActive │     └──────┬───────┘     │ gracePeriod│
└──────────┘            │             └─────┬──────┘
     │                  │                   │
     │            ┌─────▼──────┐     ┌──────▼──────┐
     │            │  Village   │     │  Customer   │
     │            │ id, name   │────>│ id, custId  │
     │            │ businessId │     │ fullName    │
     │            └────────────┘     │ phone       │
     │                               │ villageId   │
     │                               │ businessId  │
     │                               └──────┬──────┘
     │                                      │
     │                               ┌──────▼──────┐
     │                               │    Loan     │
     │───────────────────────────────>│ id, loanNum │
     │ (agentId)                     │ customerId  │
     │                               │ businessId  │
     │                               │ loanAmount  │
     │                               │ totalRepay  │
     │                               │ status      │
     │                               └──┬───────┬──┘
     │                                  │       │
     │                           ┌──────▼──┐ ┌──▼────────┐
     │                           │Schedule │ │ Payment   │
     │──────────────────────────>│ Entry   │ │ id        │
     │ (collectorId)            │ dueDate │ │ loanId    │
                                 │ amount  │ │ amount    │
                                 └─────────┘ │ date      │
                                             │ collector │
                                             │ note      │
                                             └───────────┘
```

### 7.2 All Models

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| **User** | id, username (unique), passwordHash, fullName, phone, email, role, isActive, mustChangePassword | → ownedBusinesses, businessAssignments, villageAssignments, collectedPayments, assignedLoans |
| **Business** | id, name, city, ownerId, collectionType, interestModel, collectionDays, gracePeriods, repaymentMultipliers, receiptPrefix, sequences (customerSeq, loanSeq, receiptSeq) | → owner(User), villages, customers, loans, payments |
| **Village** | id, name, businessId, isActive | → business, customers, agentAssignments. Unique: [businessId, name] |
| **Customer** | id, customerId, fullName, phone, villageId, businessId, status, age, aadhaarHash, aadhaarLast4, photoPath, guarantorName | → village, business, loans. Unique: [businessId, customerId] |
| **Loan** | id, loanNumber, customerId, businessId, loanAmount, interestAmount, totalRepayable, amountGiven, installmentAmount, numberOfInstallments, lastInstallmentAmount, interestModel, collectionType, startDate, expectedEndDate, agentId, status, closedAt | → customer, business, agent(User), schedule, payments. Unique: [businessId, loanNumber] |
| **LoanScheduleEntry** | id, loanId, installmentNumber, dueDate, amount | → loan (cascade delete). Unique: [loanId, dueDate] |
| **Payment** | id, receiptNumber, loanId, businessId, amount, paymentDate, collectorId, note, isDeleted, latitude, longitude | → loan, business, collector(User). Unique: [businessId, receiptNumber] |
| **UserBusinessAssignment** | id, userId, businessId | Links User ↔ Business. Unique: [userId, businessId] |
| **UserVillageAssignment** | id, userId, villageId | Links User ↔ Village. Unique: [userId, villageId] |
| **Document** | id, loanId, businessId, filePath, originalName, mimeType | Loan proof attachments |
| **AuditLog** | id, userId, businessId, action, entityType, entityId, details, ipAddress | Audit trail |
| **Holiday** | id, businessId, date, name | Business holidays |
| **ExpenseCategory** | id, businessId, name | Expense categories |
| **Expense** | id, businessId, categoryId, amount, date, description, userId | Business expenses |
| **CashBookEntry** | id, businessId, type, amount, date, description | Cash book |
| **CashHandover** | id, businessId, fromUserId, toUserId, amount, date | Cash handovers |
| **PasswordResetRequest** | id, userId, requestedBy, status, completedAt | Password reset workflow |
| **PlatformSetting** | key (unique), value, updatedBy | Global settings |
| **RegistrationRequest** | id, username, fullName, phone, email, passwordHash, status | Self-service registration |

---

## 8. Role-Based Access Control

### 8.1 Roles

| Role | Scope | Description |
|------|-------|-------------|
| PLATFORM_ADMIN | Global | Manages owners, approves registrations, resets passwords, platform settings |
| OWNER | Own businesses | Creates businesses, manages employees, full access to all owned businesses |
| BUSINESS_ADMIN | Assigned business | Full business access except business creation/deletion |
| AGENT | Assigned villages | Records payments, views assigned customers/loans only |

### 8.2 Permission Matrix

| Permission | Platform Admin | Owner | Business Admin | Agent |
|-----------|:-:|:-:|:-:|:-:|
| create_business | - | ✓ | - | - |
| edit_business_settings | - | ✓ | ✓ | - |
| delete_business | - | ✓ | - | - |
| view_customer | - | ✓ | ✓ | ✓ |
| create_customer | - | ✓ | ✓ | - |
| edit_customer | - | ✓ | ✓ | - |
| delete_customer | - | ✓ | ✓ | - |
| view_loan | - | ✓ | ✓ | ✓ |
| create_loan | - | ✓ | ✓ | - |
| edit_loan | - | ✓ | ✓ | - |
| delete_loan | - | ✓ | ✓ | - |
| post_payment | - | ✓ | ✓ | ✓ |
| edit_payment | - | ✓ | ✓ | - |
| delete_payment | - | ✓ | ✓ | - |
| view_all_reports | - | ✓ | ✓ | - |
| manage_users | - | ✓ | ✓ | - |
| create_user | - | ✓ | ✓ | - |
| manage_villages | - | ✓ | ✓ | - |
| approve_registration | ✓ | - | - | - |
| manage_owners | ✓ | - | - | - |
| manage_platform_settings | ✓ | - | - | - |

### 8.3 Agent Data Isolation

| Data | Filter |
|------|--------|
| Customers | Only in agent's assigned villages |
| Loans | Only loans where `agentId = user.id` |
| Payments | Only for agent's assigned loans |
| Villages | Only assigned villages |
| Employees | Page blocked (403) |
| Dashboard | Redirects to own activity page |

---

## 9. API Endpoint Reference

### 9.1 Auth APIs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/login | Public | Login with username/password |
| POST | /api/auth/logout | Auth | Clear session cookie |
| POST | /api/auth/register | Public | Self-service registration |
| POST | /api/auth/forgot-password | Auth | Request password reset |
| POST | /api/auth/change-password | Auth | Change own password |
| GET | /api/auth/me | Auth | Get current user info |
| GET | /api/auth/check-username | Public | Check username availability |
| PATCH | /api/auth/profile | Auth | Update own profile |

### 9.2 Admin APIs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/admin/owners | Admin | List all owners |
| POST | /api/admin/owners | Admin | Create owner |
| GET/PATCH/DELETE | /api/admin/owners/[ownerId] | Admin | Manage owner |
| GET | /api/admin/registration-requests | Admin | List pending registrations |
| POST | /api/admin/registration-requests/[id]/approve | Admin | Approve registration |
| POST | /api/admin/registration-requests/[id]/reject | Admin | Reject registration |
| GET | /api/admin/password-resets | Admin | List password reset requests |
| POST | /api/admin/password-resets/[id]/reset | Admin | Execute password reset |
| GET/PATCH | /api/admin/platform-settings | Admin | Platform settings |

### 9.3 Owner APIs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/owner/businesses | Owner | List own businesses |
| GET | /api/owner/agents | Owner | List agents across businesses |
| GET | /api/owner/employees | Owner | List all employees |
| POST | /api/owner/employees | Owner | Create employee |
| PATCH | /api/owner/employees/[id] | Owner | Edit/reset/suspend employee |
| DELETE | /api/owner/employees/[id] | Owner | Delete employee |
| GET | /api/owner/villages | Owner | List villages across businesses |
| GET | /api/owner/password-resets | Owner | Employee password resets |

### 9.4 Business APIs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/businesses | Owner | Create business |
| GET | /api/businesses/import | Owner | Download import template |
| POST | /api/businesses/import | Owner | Test/import business from XLSX |

### 9.5 Business-Scoped APIs (`/api/b/[businessId]/...`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /customers | view_customer | List customers (agent-filtered) |
| POST | /customers | create_customer | Create customer |
| POST | /customers/import | create_customer | CSV bulk import |
| POST | /customers/bulk | edit_customer | Bulk edit/delete |
| GET | /customers/[id] | view_customer | Customer detail |
| PATCH/DELETE | /customers/[id] | edit_customer | Edit/delete customer |
| GET | /customers/[id]/pdf | view_customer | Customer PDF |
| GET | /customers/[id]/report | view_customer | Customer report (XLSX/PDF) |
| GET | /loans | view_loan | List loans (agent-filtered, activeOnDate filter) |
| POST | /loans | create_loan | Create loan with schedule |
| POST | /loans/import | create_loan | CSV bulk import |
| POST | /loans/bulk | delete_loan | Bulk delete |
| GET | /loans/[id] | view_loan | Loan detail with schedule |
| PATCH/DELETE | /loans/[id] | edit_loan | Edit/delete loan |
| GET | /loans/[id]/pdf | view_loan | Loan PDF |
| GET | /payments | post_payment | List payments (agent-filtered, date/village/collector filters) |
| POST | /payments | post_payment | Record individual payment |
| POST | /payments/bulk | post_payment | Bulk payment posting (with note) |
| POST | /payments/import | post_payment | CSV bulk import |
| GET | /posting/village | post_payment | Village posting data (with agent info) |
| GET | /villages | view_customer | List villages (agent-scoped) |
| POST | /villages | manage_villages | Create village |
| GET/PATCH/DELETE | /villages/[id] | manage_villages | Manage village |
| GET | /employees | edit_business_settings | Employee assignment list |
| POST | /employees | edit_business_settings | Assign/unassign employee |
| PATCH | /employees | edit_business_settings | Update village assignments |
| GET | /users | manage_users | List business users |
| POST | /users | create_user | Create user in business |
| GET | /users/[id] | manage_users | User detail |
| PATCH/DELETE | /users/[id] | manage_users | Edit/delete user |
| GET | /users/[id]/activity | manage_users | Collections + disbursements (with village filter) |
| GET | /reports | view_all_reports | Report data (JSON) |
| GET | /reports/download | view_all_reports | Download PDF/XLSX |
| GET/PATCH/DELETE | /settings | edit_business_settings | Business settings |
| GET | /settings/export | edit_business_settings | Export business data XLSX |
| POST | /upload | create_customer | File upload |

---

**Footer:** Confidential — Daily Finance
