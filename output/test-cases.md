# Daily Finance — Regression Test Cases

## Test Accounts (Local Dev)
| Username | Password | Role |
|---|---|---|
| platform_admin | Test@123 | Platform Admin |
| owner1 | Test@123 | Owner |
| business_admin | Test@123 | Partner |
| agent1 | Test@123 | Agent |

---

## 1. OWNER Test Cases

### 1.1 Authentication
- [ ] Login with correct credentials → redirects to /dashboard
- [ ] Login with wrong password → shows error
- [ ] Forgot password → submits request → appears in Platform Admin's password resets
- [ ] Change password from Profile → works, forced re-login
- [ ] Session persists across browser close (no 30-min timeout)
- [ ] Sign Out → redirects to login, session destroyed

### 1.2 Dashboard
- [ ] Shows Welcome message with owner name
- [ ] Shows collection count + summary stats
- [ ] Collection cards show name, city, customers, outstanding, today's collection
- [ ] Click collection card → navigates to business dashboard
- [ ] Auto-refreshes every 60 seconds
- [ ] "+ New Collection" button → navigates to /businesses/new

### 1.3 Business Dashboard
- [ ] Total Loan Amount, Repayable, Outstanding stats correct
- [ ] Customers, Loans, Employees counts correct
- [ ] Today's Collection: Expected, Collected, New Loans, Completed Loans
- [ ] Paid count → click → View Payments page
- [ ] Unpaid count → click → Bulk Posting page
- [ ] Date filter (Today, Yesterday, 7 Days, 1 Month, Custom) updates stats
- [ ] Loan status badges (Active, Overdue, Defaulter, Completed) → click → filtered loans
- [ ] "New Payment" button → Record Payment page
- [ ] "New Customer" button → New Customer page

### 1.4 Collection Creation
- [ ] New Collection form shows: Collection Name, Type, Days, Multiplier, Locations, Employees
- [ ] Collection Type toggle (Daily/Weekly/Monthly) works
- [ ] Collection Days pills toggle (Daily only)
- [ ] At least one location required
- [ ] Owner pre-selected in Assign Employees
- [ ] Partners pre-selected in Assign Employees
- [ ] Create → redirects to dashboard, collection appears
- [ ] Import: upload XLSX → Test → Import works
- [ ] Import: Collection Type/Days/Multiplier fields present

### 1.5 Customers
- [ ] Customer list shows CID, Name, Phone, Location, Status, Loans
- [ ] Search by name, phone, CID, location, aadhaar works
- [ ] Filter by status (Active, Overdue, Defaulter, Completed, No Loans)
- [ ] Filter by village (horizontal scroll tabs)
- [ ] New Customer → form with auto-generated CID, editable
- [ ] Edit Customer → all fields editable including CID
- [ ] Customer name is clickable → profile page
- [ ] Select 1 → View, New Payment, Edit, Delete buttons
- [ ] Select 2+ → Merge button appears
- [ ] Merge → pick Master → type MERGE → loans moved, duplicates deleted
- [ ] Customer detail: Total Loans, Total Loan Amount, Total Paid, Outstanding
- [ ] Customer detail: loan cards with Paid/Due amounts and progress bar

### 1.6 Loans
- [ ] Loan list shows Loan#, Customer, Date, Due Date, Loan, Outstanding, Agent, Status
- [ ] Search by name, phone, loan number works
- [ ] Filter by status (Active, Overdue, Defaulter, Completed)
- [ ] New Loan → customer search → select → loan form
- [ ] Agent dropdown shows: Agents (village) + Partners + Owner with role labels
- [ ] Auto-select priority: Agent in village → Partner → Owner
- [ ] Loan creation date: no backdate limit
- [ ] Interest model toggle (Add-on / Upfront)
- [ ] Auto-calculated fields: Total Repayment, Installment, Due Date
- [ ] Loan ID auto-generated, editable
- [ ] Select loan → View → Loan Details modal with payment history
- [ ] Loan Details: Outstanding, Total Paid, Pending Installments shown
- [ ] Select loan → New Payment → navigates to payment page for that loan
- [ ] Select loan → Edit → all fields editable + Loan Status dropdown
- [ ] Loan Status override: Active restarts lifecycle from today
- [ ] Due Date column visible in table

### 1.7 Payments
- [ ] New Payment: search customer → select loan → enter amount → Post
- [ ] Only active loans shown (completed loans dimmed)
- [ ] Paid/Pending badges per loan on selected date
- [ ] Payment mode: Cash/UPI toggle
- [ ] Post & New → records and goes to next customer
- [ ] Post & Next Day → records and advances date
- [ ] Posting date: no backdate limit
- [ ] ₹0 payment allowed
- [ ] Customer name clickable → profile
- [ ] Bulk Posting: All Locations default, 10 per page
- [ ] Bulk Posting: Defaulter checkbox (unchecked by default)
- [ ] Bulk Posting: Holiday checkbox → all amounts ₹0
- [ ] Bulk Posting: Submit & Next pagination
- [ ] View Payments: Paid/Unpaid stats bar
- [ ] View Payments: date filter, village filter, employee filter
- [ ] View Payments: table with Receipt, Customer, CID, Amount, Date, Village, Agent, Mode

### 1.8 Reports
- [ ] Default report type: Daily Collection Summary
- [ ] Default date: Today
- [ ] Daily Collection Summary: shows all active loans with Paid/Unpaid status
- [ ] Payment Status filter: All / Paid / Unpaid
- [ ] View, PDF, XLSX buttons work
- [ ] Share PDF / Share XLSX (WhatsApp) work on mobile
- [ ] Customers report: no Age column, has CID
- [ ] Loans report: no Phone/Interest, has CID/Start Date/Due Date
- [ ] Payments report: no Phone column
- [ ] Download respects filters

### 1.9 Employees
- [ ] Owner shown as first row with gold accent, "All Villages", View button
- [ ] Partners shown with purple accent, "All Villages", no village toggle
- [ ] Agents shown with blue accent, expandable village assignment
- [ ] Assign/unassign employees to collection
- [ ] Agent village toggle pills work
- [ ] View button → user activity page (works for Owner too)

### 1.10 Settings
- [ ] Basic Info: Collection ID (read-only), Collection Name (editable)
- [ ] Collection: Type (read-only), Day, Days, Multiplier, Grace Period, Defaulter Period
- [ ] UID Formatting: Customer/Loan/Receipt ID format, prefix, padding, start, max
- [ ] Other: WhatsApp Template, Auto Logout
- [ ] Save Settings → success message
- [ ] Export Data: Download XLSX works
- [ ] Export Data: Download PDF / Share PDF works
- [ ] Danger Zone: Delete Collection → type DELETE → deletes

### 1.11 Profile
- [ ] Shows name, username, role, phone
- [ ] Language switcher: English / Telugu
- [ ] Change Password (collapsible)
- [ ] Organization Details: OrgID, Org Name, Owner Name, Phone, Email, City — all editable
- [ ] Danger Zone: Delete Organization (blocked if collections exist)

### 1.12 Sidebar Navigation
- [ ] Collection section: New Payment, New Customer, New Loan, Location, Employees, Reports, Settings
- [ ] Owner section: New Collection, Manage Employees, Employee Password Management
- [ ] Help section: Contact Us, FAQ
- [ ] Sign Out at bottom

### 1.13 Header
- [ ] Shows organization name (or first business name)
- [ ] Collection dropdown (top-right)
- [ ] Profile dropdown: name, role, language toggle, Profile & Settings, Help, Contact Us, FAQ, Sign Out
- [ ] System banner shows when set by Platform Admin

---

## 2. PARTNER Test Cases

### 2.1 Authentication
- [ ] Login → redirects to dashboard or select-business
- [ ] Only sees assigned collections in dropdown
- [ ] 30-minute inactivity timeout active
- [ ] Forgot password → request goes to Owner

### 2.2 Access Control
- [ ] Can ONLY see assigned collections (not all owner's collections)
- [ ] Can create new collections
- [ ] Can delete assigned collections (deactivate_business permission)
- [ ] Can view business comparison for assigned collections
- [ ] Can manage employees (create, assign, password resets)
- [ ] Can create customers, loans, payments in assigned collections
- [ ] Can edit/delete customers, loans in assigned collections
- [ ] Can view all reports for assigned collections
- [ ] Can edit collection settings for assigned collections
- [ ] Cannot delete the organization
- [ ] Cannot see collections not assigned to them
- [ ] Shows "All Villages" (no village restriction)

### 2.3 Dashboard
- [ ] Shows stats only for assigned collections
- [ ] All dashboard features work same as Owner for assigned collections

### 2.4 Loans & Payments
- [ ] Can create loans with self as agent (Partner label in dropdown)
- [ ] Can record payments with self as collector
- [ ] Can edit loan status
- [ ] All payment flows work (single, bulk, view)

### 2.5 Profile
- [ ] Shows role as "Partner"
- [ ] Organization Details visible but check if editable
- [ ] No Danger Zone (delete org)

---

## 3. AGENT Test Cases

### 3.1 Authentication
- [ ] Login → redirects to assigned business dashboard (or activity page)
- [ ] 30-minute inactivity timeout active
- [ ] Forgot password → request goes to Owner

### 3.2 Access Control — Restrictions
- [ ] Can ONLY see assigned collections
- [ ] Can ONLY see customers in assigned villages
- [ ] Can ONLY see loans where agentId = self
- [ ] Can ONLY see payments collected by self
- [ ] CANNOT create customers
- [ ] CANNOT create loans
- [ ] CANNOT edit loans
- [ ] CANNOT delete anything
- [ ] CANNOT access Employees page (blocked)
- [ ] CANNOT access Settings page
- [ ] CANNOT access Reports (except own collection report)
- [ ] CANNOT see other agents' data

### 3.3 Payments (Agent's primary function)
- [ ] Can record individual payments
- [ ] Can do bulk posting
- [ ] Can edit own payments made today only
- [ ] Cannot edit payments from previous days
- [ ] Cannot edit other agents' payments
- [ ] Payment mode selection works (Cash/UPI)

### 3.4 Dashboard
- [ ] Redirects to activity page (not full dashboard)
- [ ] Shows own collections and disbursements
- [ ] Date filter works

### 3.5 Navigation
- [ ] Sidebar shows limited items (no Employees, Settings, Reports for admin)
- [ ] Header shows assigned collection name
- [ ] FAQ visible (categories 2, 3, 4 — not Admin category)

### 3.6 Profile
- [ ] Shows role as "Agent"
- [ ] Can change password
- [ ] Can switch language
- [ ] No Organization Details section
- [ ] No Danger Zone

---

## 4. PLATFORM ADMIN Test Cases

### 4.1 Authentication
- [ ] Login → redirects to /admin/owners
- [ ] Forgot password → auto-resets to "system", forced change on login

### 4.2 Organizations Page
- [ ] Table view with: #, OrgID, Organization, Owner, City, Phone, Email, Collections, Customers, Loans, Payments, Created, Last Login, Status
- [ ] Search by OrgID, org name, owner, username, city, phone, email
- [ ] Pagination: 10 per page, Previous/Next
- [ ] Sorted by last login (desc)
- [ ] Refresh button works
- [ ] "+ Register New Business" → opens /register in new tab
- [ ] Suspend Organization → owner can't login, shows "suspended"
- [ ] Activate Organization → restores access
- [ ] Delete Organization → type DELETE → force delete checkbox
- [ ] Force delete → cascade deletes all data + orphaned agents

### 4.3 Registration Requests
- [ ] Shows pending requests with name, username, phone, email, business name, city
- [ ] Approve → creates Owner account only (no auto-collection)
- [ ] Reject → with reason
- [ ] Status tabs: All, Pending, Approved, Rejected

### 4.4 Password Resets
- [ ] Shows Owner password reset requests
- [ ] Reset → sets password to username, forced change on login

### 4.5 Platform Settings
- [ ] Banner tab: set message → yellow banner appears for all users
- [ ] Banner tab: clear message → banner disappears
- [ ] Contact Us tab: phone, email, address, notes
- [ ] FAQ tab: add/edit/remove FAQs with category dropdown

### 4.6 Navigation
- [ ] Sidebar: Organizations, Registration Requests, Password Resets, Platform Settings, My Profile
- [ ] Always English (no language switcher)
- [ ] No business/collection access

---

## 5. Cross-Role Tests

### 5.1 Data Isolation
- [ ] Owner A cannot see Owner B's data
- [ ] Agent in Org A cannot see Org B's data
- [ ] Partner only sees assigned collections

### 5.2 Telugu Language
- [ ] Switch to Telugu → all UI labels change
- [ ] Switch back to English → restored
- [ ] Language persists after page reload
- [ ] Language persists after logout/login
- [ ] Data values (names, amounts) NOT translated

### 5.3 System Banner
- [ ] Platform Admin sets banner → all users see it
- [ ] Platform Admin clears → banner disappears
- [ ] Banner shows on all pages

### 5.4 Password Reset Flow
- [ ] Agent forgot → Owner resets → password = username → forced change
- [ ] Owner forgot → Platform Admin resets → password = username → forced change
- [ ] Platform Admin forgot → auto-reset to "system" → forced change

### 5.5 Mobile
- [ ] All pages responsive at 375px width
- [ ] Date fields don't overflow
- [ ] Tables have appropriate mobile columns
- [ ] Bottom navigation works
- [ ] Share PDF/XLSX uses Web Share API
