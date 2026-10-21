--
-- PostgreSQL database dump
--

\restrict JjYtpaQVgpXPRQCxbRRdZKoTGdcOeEVAtvdoFmfkH2LflYuinnWDZctmlaR8Gsk

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public."Village" DROP CONSTRAINT IF EXISTS "Village_businessId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserVillageAssignment" DROP CONSTRAINT IF EXISTS "UserVillageAssignment_villageId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserVillageAssignment" DROP CONSTRAINT IF EXISTS "UserVillageAssignment_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserBusinessAssignment" DROP CONSTRAINT IF EXISTS "UserBusinessAssignment_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserBusinessAssignment" DROP CONSTRAINT IF EXISTS "UserBusinessAssignment_businessId_fkey";
ALTER TABLE IF EXISTS ONLY public."SupportAccess" DROP CONSTRAINT IF EXISTS "SupportAccess_ownerId_fkey";
ALTER TABLE IF EXISTS ONLY public."SupportAccess" DROP CONSTRAINT IF EXISTS "SupportAccess_adminId_fkey";
ALTER TABLE IF EXISTS ONLY public."Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_loanId_fkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_collectorId_fkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_businessId_fkey";
ALTER TABLE IF EXISTS ONLY public."PasswordResetRequest" DROP CONSTRAINT IF EXISTS "PasswordResetRequest_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Loan" DROP CONSTRAINT IF EXISTS "Loan_renewedFromLoanId_fkey";
ALTER TABLE IF EXISTS ONLY public."Loan" DROP CONSTRAINT IF EXISTS "Loan_customerId_fkey";
ALTER TABLE IF EXISTS ONLY public."Loan" DROP CONSTRAINT IF EXISTS "Loan_businessId_fkey";
ALTER TABLE IF EXISTS ONLY public."Loan" DROP CONSTRAINT IF EXISTS "Loan_agentId_fkey";
ALTER TABLE IF EXISTS ONLY public."LoanScheduleEntry" DROP CONSTRAINT IF EXISTS "LoanScheduleEntry_loanId_fkey";
ALTER TABLE IF EXISTS ONLY public."Holiday" DROP CONSTRAINT IF EXISTS "Holiday_businessId_fkey";
ALTER TABLE IF EXISTS ONLY public."Expense" DROP CONSTRAINT IF EXISTS "Expense_paidById_fkey";
ALTER TABLE IF EXISTS ONLY public."Expense" DROP CONSTRAINT IF EXISTS "Expense_categoryId_fkey";
ALTER TABLE IF EXISTS ONLY public."Expense" DROP CONSTRAINT IF EXISTS "Expense_businessId_fkey";
ALTER TABLE IF EXISTS ONLY public."ExpenseCategory" DROP CONSTRAINT IF EXISTS "ExpenseCategory_businessId_fkey";
ALTER TABLE IF EXISTS ONLY public."Document" DROP CONSTRAINT IF EXISTS "Document_loanId_fkey";
ALTER TABLE IF EXISTS ONLY public."Document" DROP CONSTRAINT IF EXISTS "Document_customerId_fkey";
ALTER TABLE IF EXISTS ONLY public."Document" DROP CONSTRAINT IF EXISTS "Document_businessId_fkey";
ALTER TABLE IF EXISTS ONLY public."Customer" DROP CONSTRAINT IF EXISTS "Customer_villageId_fkey";
ALTER TABLE IF EXISTS ONLY public."Customer" DROP CONSTRAINT IF EXISTS "Customer_businessId_fkey";
ALTER TABLE IF EXISTS ONLY public."CashHandover" DROP CONSTRAINT IF EXISTS "CashHandover_receivedById_fkey";
ALTER TABLE IF EXISTS ONLY public."CashHandover" DROP CONSTRAINT IF EXISTS "CashHandover_businessId_fkey";
ALTER TABLE IF EXISTS ONLY public."CashHandover" DROP CONSTRAINT IF EXISTS "CashHandover_agentId_fkey";
ALTER TABLE IF EXISTS ONLY public."CashBookEntry" DROP CONSTRAINT IF EXISTS "CashBookEntry_businessId_fkey";
ALTER TABLE IF EXISTS ONLY public."Business" DROP CONSTRAINT IF EXISTS "Business_ownerId_fkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_businessId_fkey";
DROP INDEX IF EXISTS public."Village_businessId_name_key";
DROP INDEX IF EXISTS public."User_username_key";
DROP INDEX IF EXISTS public."UserVillageAssignment_userId_villageId_key";
DROP INDEX IF EXISTS public."UserBusinessAssignment_userId_businessId_key";
DROP INDEX IF EXISTS public."SupportAccess_ownerId_idx";
DROP INDEX IF EXISTS public."SupportAccess_adminId_idx";
DROP INDEX IF EXISTS public."Session_userId_idx";
DROP INDEX IF EXISTS public."Session_token_key";
DROP INDEX IF EXISTS public."Session_token_idx";
DROP INDEX IF EXISTS public."RegistrationRequest_username_key";
DROP INDEX IF EXISTS public."RegistrationRequest_status_idx";
DROP INDEX IF EXISTS public."RegistrationRequest_phone_idx";
DROP INDEX IF EXISTS public."PlatformSetting_key_key";
DROP INDEX IF EXISTS public."Payment_loanId_paymentDate_idx";
DROP INDEX IF EXISTS public."Payment_loanId_isDeleted_idx";
DROP INDEX IF EXISTS public."Payment_collectorId_paymentDate_idx";
DROP INDEX IF EXISTS public."Payment_businessId_receiptNumber_key";
DROP INDEX IF EXISTS public."Payment_businessId_paymentDate_idx";
DROP INDEX IF EXISTS public."PasswordResetRequest_userId_status_idx";
DROP INDEX IF EXISTS public."PasswordResetRequest_status_createdAt_idx";
DROP INDEX IF EXISTS public."Loan_renewedFromLoanId_key";
DROP INDEX IF EXISTS public."Loan_customerId_idx";
DROP INDEX IF EXISTS public."Loan_businessId_status_idx";
DROP INDEX IF EXISTS public."Loan_businessId_startDate_idx";
DROP INDEX IF EXISTS public."Loan_businessId_loanNumber_key";
DROP INDEX IF EXISTS public."Loan_agentId_businessId_idx";
DROP INDEX IF EXISTS public."LoanScheduleEntry_loanId_installmentNumber_idx";
DROP INDEX IF EXISTS public."LoanScheduleEntry_loanId_dueDate_key";
DROP INDEX IF EXISTS public."Holiday_businessId_date_key";
DROP INDEX IF EXISTS public."Expense_businessId_date_idx";
DROP INDEX IF EXISTS public."ExpenseCategory_businessId_name_key";
DROP INDEX IF EXISTS public."Document_loanId_idx";
DROP INDEX IF EXISTS public."Document_customerId_idx";
DROP INDEX IF EXISTS public."Customer_businessId_villageId_idx";
DROP INDEX IF EXISTS public."Customer_businessId_status_idx";
DROP INDEX IF EXISTS public."Customer_businessId_phone_idx";
DROP INDEX IF EXISTS public."Customer_businessId_fullName_idx";
DROP INDEX IF EXISTS public."Customer_businessId_customerId_key";
DROP INDEX IF EXISTS public."Customer_businessId_createdAt_idx";
DROP INDEX IF EXISTS public."CashHandover_businessId_date_idx";
DROP INDEX IF EXISTS public."CashHandover_agentId_date_idx";
DROP INDEX IF EXISTS public."CashBookEntry_businessId_date_key";
DROP INDEX IF EXISTS public."Business_ownerId_name_key";
DROP INDEX IF EXISTS public."AuditLog_entityType_entityId_idx";
DROP INDEX IF EXISTS public."AuditLog_businessId_createdAt_idx";
ALTER TABLE IF EXISTS ONLY public."Village" DROP CONSTRAINT IF EXISTS "Village_pkey";
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE IF EXISTS ONLY public."UserVillageAssignment" DROP CONSTRAINT IF EXISTS "UserVillageAssignment_pkey";
ALTER TABLE IF EXISTS ONLY public."UserBusinessAssignment" DROP CONSTRAINT IF EXISTS "UserBusinessAssignment_pkey";
ALTER TABLE IF EXISTS ONLY public."SupportAccess" DROP CONSTRAINT IF EXISTS "SupportAccess_pkey";
ALTER TABLE IF EXISTS ONLY public."Session" DROP CONSTRAINT IF EXISTS "Session_pkey";
ALTER TABLE IF EXISTS ONLY public."RegistrationRequest" DROP CONSTRAINT IF EXISTS "RegistrationRequest_pkey";
ALTER TABLE IF EXISTS ONLY public."PlatformSetting" DROP CONSTRAINT IF EXISTS "PlatformSetting_pkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_pkey";
ALTER TABLE IF EXISTS ONLY public."PasswordResetRequest" DROP CONSTRAINT IF EXISTS "PasswordResetRequest_pkey";
ALTER TABLE IF EXISTS ONLY public."Loan" DROP CONSTRAINT IF EXISTS "Loan_pkey";
ALTER TABLE IF EXISTS ONLY public."LoanScheduleEntry" DROP CONSTRAINT IF EXISTS "LoanScheduleEntry_pkey";
ALTER TABLE IF EXISTS ONLY public."Holiday" DROP CONSTRAINT IF EXISTS "Holiday_pkey";
ALTER TABLE IF EXISTS ONLY public."Expense" DROP CONSTRAINT IF EXISTS "Expense_pkey";
ALTER TABLE IF EXISTS ONLY public."ExpenseCategory" DROP CONSTRAINT IF EXISTS "ExpenseCategory_pkey";
ALTER TABLE IF EXISTS ONLY public."Document" DROP CONSTRAINT IF EXISTS "Document_pkey";
ALTER TABLE IF EXISTS ONLY public."Customer" DROP CONSTRAINT IF EXISTS "Customer_pkey";
ALTER TABLE IF EXISTS ONLY public."CashHandover" DROP CONSTRAINT IF EXISTS "CashHandover_pkey";
ALTER TABLE IF EXISTS ONLY public."CashBookEntry" DROP CONSTRAINT IF EXISTS "CashBookEntry_pkey";
ALTER TABLE IF EXISTS ONLY public."Business" DROP CONSTRAINT IF EXISTS "Business_pkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_pkey";
DROP TABLE IF EXISTS public."Village";
DROP TABLE IF EXISTS public."UserVillageAssignment";
DROP TABLE IF EXISTS public."UserBusinessAssignment";
DROP TABLE IF EXISTS public."User";
DROP TABLE IF EXISTS public."SupportAccess";
DROP TABLE IF EXISTS public."Session";
DROP TABLE IF EXISTS public."RegistrationRequest";
DROP TABLE IF EXISTS public."PlatformSetting";
DROP TABLE IF EXISTS public."Payment";
DROP TABLE IF EXISTS public."PasswordResetRequest";
DROP TABLE IF EXISTS public."LoanScheduleEntry";
DROP TABLE IF EXISTS public."Loan";
DROP TABLE IF EXISTS public."Holiday";
DROP TABLE IF EXISTS public."ExpenseCategory";
DROP TABLE IF EXISTS public."Expense";
DROP TABLE IF EXISTS public."Document";
DROP TABLE IF EXISTS public."Customer";
DROP TABLE IF EXISTS public."CashHandover";
DROP TABLE IF EXISTS public."CashBookEntry";
DROP TABLE IF EXISTS public."Business";
DROP TABLE IF EXISTS public."AuditLog";
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    action text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    "oldValues" text,
    "newValues" text,
    reason text,
    "userId" text NOT NULL,
    "businessId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AuditLog" OWNER TO financeapp;

--
-- Name: Business; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."Business" (
    id text NOT NULL,
    name text NOT NULL,
    city text NOT NULL,
    address text,
    phone text,
    "logoPath" text,
    "receiptPrefix" text,
    "ownerId" text NOT NULL,
    "collectionType" text DEFAULT 'DAILY'::text NOT NULL,
    "defaultCollectionDay" text,
    "interestModel" text DEFAULT 'ADDON'::text NOT NULL,
    "collectOnSundays" boolean DEFAULT false NOT NULL,
    "gracePeriodDaily" integer DEFAULT 30 NOT NULL,
    "gracePeriodWeekly" integer DEFAULT 4 NOT NULL,
    "gracePeriodMonthly" integer DEFAULT 1 NOT NULL,
    "ratingGoodMaxPct" integer DEFAULT 50 NOT NULL,
    "ratingAverageMaxPct" integer DEFAULT 100 NOT NULL,
    "maxLoanByRating" text,
    "whatsappTemplate" text DEFAULT '{{businessName}}: Received ₹{{amount}} on {{date}}. Outstanding: ₹{{outstanding}}. Thank you!'::text NOT NULL,
    "autoLogoutMinutes" integer DEFAULT 30 NOT NULL,
    "receiptSeq" integer DEFAULT 0 NOT NULL,
    "loanSeq" integer DEFAULT 0 NOT NULL,
    "customerSeq" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Business" OWNER TO financeapp;

--
-- Name: CashBookEntry; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."CashBookEntry" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    date text NOT NULL,
    "openingCash" integer NOT NULL,
    "loansDisbursed" integer NOT NULL,
    "collectionsReceived" integer NOT NULL,
    "handoversReceived" integer NOT NULL,
    "expensesTotal" integer NOT NULL,
    "closingCash" integer NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."CashBookEntry" OWNER TO financeapp;

--
-- Name: CashHandover; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."CashHandover" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "agentId" text NOT NULL,
    "receivedById" text NOT NULL,
    date text NOT NULL,
    amount integer NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."CashHandover" OWNER TO financeapp;

--
-- Name: Customer; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."Customer" (
    id text NOT NULL,
    "customerId" text NOT NULL,
    "fullName" text NOT NULL,
    age integer,
    phone text NOT NULL,
    "altPhone" text,
    address text,
    "aadhaarHash" text,
    "aadhaarLast4" text,
    "photoPath" text,
    "jobType" text,
    "guarantorName" text,
    "guarantorPhone" text,
    notes text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "villageId" text NOT NULL,
    "businessId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Customer" OWNER TO financeapp;

--
-- Name: Document; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."Document" (
    id text NOT NULL,
    "customerId" text,
    "loanId" text,
    "businessId" text NOT NULL,
    type text NOT NULL,
    "filePath" text NOT NULL,
    "originalName" text NOT NULL,
    "mimeType" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Document" OWNER TO financeapp;

--
-- Name: Expense; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."Expense" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "categoryId" text NOT NULL,
    amount integer NOT NULL,
    date text NOT NULL,
    "paidById" text NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Expense" OWNER TO financeapp;

--
-- Name: ExpenseCategory; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."ExpenseCategory" (
    id text NOT NULL,
    name text NOT NULL,
    "businessId" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public."ExpenseCategory" OWNER TO financeapp;

--
-- Name: Holiday; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."Holiday" (
    id text NOT NULL,
    date text NOT NULL,
    name text NOT NULL,
    "businessId" text NOT NULL
);


ALTER TABLE public."Holiday" OWNER TO financeapp;

--
-- Name: Loan; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."Loan" (
    id text NOT NULL,
    "loanNumber" text NOT NULL,
    "customerId" text NOT NULL,
    "businessId" text NOT NULL,
    "loanAmount" integer NOT NULL,
    "interestAmount" integer NOT NULL,
    "totalRepayable" integer NOT NULL,
    "amountGiven" integer NOT NULL,
    "collectionType" text NOT NULL,
    "collectionDay" text,
    "installmentAmount" integer NOT NULL,
    "numberOfInstallments" integer NOT NULL,
    "lastInstallmentAmount" integer NOT NULL,
    "startDate" text NOT NULL,
    "expectedEndDate" text NOT NULL,
    "agentId" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "renewedFromLoanId" text,
    "pausedAt" text,
    "settlementAmount" integer,
    "settlementReason" text,
    "writeOffReason" text,
    "closedAt" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Loan" OWNER TO financeapp;

--
-- Name: LoanScheduleEntry; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."LoanScheduleEntry" (
    id text NOT NULL,
    "loanId" text NOT NULL,
    "installmentNumber" integer NOT NULL,
    "dueDate" text NOT NULL,
    amount integer NOT NULL
);


ALTER TABLE public."LoanScheduleEntry" OWNER TO financeapp;

--
-- Name: PasswordResetRequest; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."PasswordResetRequest" (
    id text NOT NULL,
    "userId" text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    note text,
    "resolvedBy" text,
    "resolvedAt" timestamp(3) without time zone,
    "ipAddress" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."PasswordResetRequest" OWNER TO financeapp;

--
-- Name: Payment; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "receiptNumber" text NOT NULL,
    "loanId" text NOT NULL,
    "businessId" text NOT NULL,
    amount integer NOT NULL,
    "paymentDate" text NOT NULL,
    "collectorId" text NOT NULL,
    note text,
    latitude double precision,
    longitude double precision,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Payment" OWNER TO financeapp;

--
-- Name: PlatformSetting; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."PlatformSetting" (
    id text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "updatedBy" text
);


ALTER TABLE public."PlatformSetting" OWNER TO financeapp;

--
-- Name: RegistrationRequest; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."RegistrationRequest" (
    id text NOT NULL,
    "fullName" text NOT NULL,
    phone text NOT NULL,
    email text,
    username text NOT NULL,
    "passwordHash" text NOT NULL,
    "businessName" text NOT NULL,
    city text NOT NULL,
    villages text NOT NULL,
    "collectionType" text DEFAULT 'DAILY'::text NOT NULL,
    "defaultCollectionDay" text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "rejectionReason" text,
    "reviewedBy" text,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."RegistrationRequest" OWNER TO financeapp;

--
-- Name: Session; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "userId" text NOT NULL,
    token text NOT NULL,
    "activeBusinessId" text,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "lastActivityAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Session" OWNER TO financeapp;

--
-- Name: SupportAccess; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."SupportAccess" (
    id text NOT NULL,
    "ownerId" text NOT NULL,
    "adminId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."SupportAccess" OWNER TO financeapp;

--
-- Name: User; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."User" (
    id text NOT NULL,
    username text NOT NULL,
    "passwordHash" text NOT NULL,
    "fullName" text NOT NULL,
    phone text,
    role text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "mustChangePassword" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    email text
);


ALTER TABLE public."User" OWNER TO financeapp;

--
-- Name: UserBusinessAssignment; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."UserBusinessAssignment" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "businessId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."UserBusinessAssignment" OWNER TO financeapp;

--
-- Name: UserVillageAssignment; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."UserVillageAssignment" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "villageId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."UserVillageAssignment" OWNER TO financeapp;

--
-- Name: Village; Type: TABLE; Schema: public; Owner: financeapp
--

CREATE TABLE public."Village" (
    id text NOT NULL,
    name text NOT NULL,
    "businessId" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Village" OWNER TO financeapp;

--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."AuditLog" (id, action, "entityType", "entityId", "oldValues", "newValues", reason, "userId", "businessId", "createdAt") FROM stdin;
\.


--
-- Data for Name: Business; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."Business" (id, name, city, address, phone, "logoPath", "receiptPrefix", "ownerId", "collectionType", "defaultCollectionDay", "interestModel", "collectOnSundays", "gracePeriodDaily", "gracePeriodWeekly", "gracePeriodMonthly", "ratingGoodMaxPct", "ratingAverageMaxPct", "maxLoanByRating", "whatsappTemplate", "autoLogoutMinutes", "receiptSeq", "loanSeq", "customerSeq", "isActive", "createdAt", "updatedAt") FROM stdin;
cmuqdn6ik000ebmed1brqfqur	Monday Gajuwaka evening 	Vishakapatnam	Gajuwaka vishakapatnam vudacolony	\N	\N	DF	cmuqdf8wq0009bmedb8ha18ex	DAILY	\N	ADDON	f	30	4	1	50	100	\N	{{businessName}}: Received ₹{{amount}} on {{date}}. Outstanding: ₹{{outstanding}}. Thank you!	30	1	1	1	t	2026-10-02 03:01:57.308	2026-10-02 03:15:35.089
cmupn1uor000214mh39aw2s8z	Kaushiki Finance Company	Hyderabad	Kondapur 	\N	\N	KFC	cmupmusg30006j4bapl84qx9i	DAILY	\N	ADDON	t	30	4	1	50	100	\N	{{businessName}}: Received ₹{{amount}} on {{date}}. Outstanding: ₹{{outstanding}}. Thank you!	30	2	1	1	t	2026-10-01 14:37:32.187	2026-10-02 08:05:23.709
cmuptsssr000214fvly5fdn3x	deobargh weekly	deobargh 	\N	\N	\N	\N	cmupsxccj003b14fasa6cv1en	WEEKLY	TUESDAY	UPFRONT	f	30	4	1	50	100	\N	{{businessName}}: Received ₹{{amount}} on {{date}}. Outstanding: ₹{{outstanding}}. Thank you!	30	0	0	0	t	2026-10-01 17:46:27.147	2026-10-01 17:46:27.147
cmupndz1c000v14mharvge5lw	Gajuwaka Daily Evening 	Vizag	\N	\N	\N	\N	cmupnbhma000q14mhhez8lbfs	DAILY	\N	ADDON	f	30	4	1	50	100	\N	{{businessName}}: Received ₹{{amount}} on {{date}}. Outstanding: ₹{{outstanding}}. Thank you!	30	2	1	1	t	2026-10-01 14:46:57.696	2026-10-02 02:48:51.987
\.


--
-- Data for Name: CashBookEntry; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."CashBookEntry" (id, "businessId", date, "openingCash", "loansDisbursed", "collectionsReceived", "handoversReceived", "expensesTotal", "closingCash", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: CashHandover; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."CashHandover" (id, "businessId", "agentId", "receivedById", date, amount, note, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Customer; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."Customer" (id, "customerId", "fullName", age, phone, "altPhone", address, "aadhaarHash", "aadhaarLast4", "photoPath", "jobType", "guarantorName", "guarantorPhone", notes, status, "villageId", "businessId", "createdAt", "updatedAt") FROM stdin;
cmupn9l78000a14mhjh15gwqe	KFC0001	Naveen	\N	9494901742	\N	\N	\N	\N	\N	Business	\N	\N	\N	ACTIVE	cmupn1up2000314mhbruke15v	cmupn1uor000214mh39aw2s8z	2026-10-01 14:43:33.14	2026-10-01 14:43:33.14
cmupp68sm000614fau5xxel8m	C0001	Tulasi	\N	9876543210	\N	\N	\N	\N	\N	\N	\N	\N	\N	ACTIVE	cmupndz1g000w14mhpd3dnlnc	cmupndz1c000v14mharvge5lw	2026-10-01 15:36:56.326	2026-10-01 15:36:56.326
cmuqdwi1i000nbmedtfcjdjde	DF0001	Swathi	38	7285918569	\N	Srinagar 	\N	\N	\N	Shop	\N	\N	\N	ACTIVE	cmuqdn6io000fbmedfkh14c8i	cmuqdn6ik000ebmed1brqfqur	2026-10-02 03:09:12.15	2026-10-02 03:09:12.15
\.


--
-- Data for Name: Document; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."Document" (id, "customerId", "loanId", "businessId", type, "filePath", "originalName", "mimeType", "createdAt") FROM stdin;
\.


--
-- Data for Name: Expense; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."Expense" (id, "businessId", "categoryId", amount, date, "paidById", note, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ExpenseCategory; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."ExpenseCategory" (id, name, "businessId", "isActive") FROM stdin;
\.


--
-- Data for Name: Holiday; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."Holiday" (id, date, name, "businessId") FROM stdin;
\.


--
-- Data for Name: Loan; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."Loan" (id, "loanNumber", "customerId", "businessId", "loanAmount", "interestAmount", "totalRepayable", "amountGiven", "collectionType", "collectionDay", "installmentAmount", "numberOfInstallments", "lastInstallmentAmount", "startDate", "expectedEndDate", "agentId", status, "renewedFromLoanId", "pausedAt", "settlementAmount", "settlementReason", "writeOffReason", "closedAt", notes, "createdAt", "updatedAt") FROM stdin;
cmupnay1p000d14mhwcsglfw3	KFC00001	cmupn9l78000a14mhjh15gwqe	cmupn1uor000214mh39aw2s8z	1000000	0	1000000	1000000	DAILY	\N	100000	10	100000	2026-10-01	2026-10-10	\N	ACTIVE	\N	\N	\N	\N	\N	\N	\N	2026-10-01 14:44:36.446	2026-10-01 14:44:36.446
cmuppa87i000914fatio3ls2b	L00001	cmupp68sm000614fau5xxel8m	cmupndz1c000v14mharvge5lw	2500000	250000	2750000	2500000	DAILY	\N	27500	100	27500	2026-10-01	2027-01-25	\N	ACTIVE	\N	\N	\N	\N	\N	\N	\N	2026-10-01 15:40:02.19	2026-10-01 15:40:02.19
cmuqdyhbm000qbmedmshliudi	DF00001	cmuqdwi1i000nbmedtfcjdjde	cmuqdn6ik000ebmed1brqfqur	1000000	200000	1200000	1000000	DAILY	\N	10000	120	10000	2026-10-02	2027-02-18	cmuqdt4s1000gbmed10v5wyw7	ACTIVE	\N	\N	\N	\N	\N	\N	\N	2026-10-02 03:10:44.529	2026-10-02 03:14:26.323
\.


--
-- Data for Name: LoanScheduleEntry; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."LoanScheduleEntry" (id, "loanId", "installmentNumber", "dueDate", amount) FROM stdin;
cmupnay1q000e14mh645q2bci	cmupnay1p000d14mhwcsglfw3	1	2026-10-01	100000
cmupnay1q000f14mhci4qx5is	cmupnay1p000d14mhwcsglfw3	2	2026-10-02	100000
cmupnay1q000g14mh47lqm1r4	cmupnay1p000d14mhwcsglfw3	3	2026-10-03	100000
cmupnay1q000h14mhloj5kjt5	cmupnay1p000d14mhwcsglfw3	4	2026-10-04	100000
cmupnay1q000i14mhj112ylim	cmupnay1p000d14mhwcsglfw3	5	2026-10-05	100000
cmupnay1q000j14mhh7nh2cnn	cmupnay1p000d14mhwcsglfw3	6	2026-10-06	100000
cmupnay1q000k14mht0eo10rg	cmupnay1p000d14mhwcsglfw3	7	2026-10-07	100000
cmupnay1q000l14mhln2zofbr	cmupnay1p000d14mhwcsglfw3	8	2026-10-08	100000
cmupnay1q000m14mh0wjvp1yr	cmupnay1p000d14mhwcsglfw3	9	2026-10-09	100000
cmupnay1q000n14mh4jm4f7bv	cmupnay1p000d14mhwcsglfw3	10	2026-10-10	100000
cmuppa87j000a14falau4pkk2	cmuppa87i000914fatio3ls2b	1	2026-10-01	27500
cmuppa87j000b14fao8hedj8l	cmuppa87i000914fatio3ls2b	2	2026-10-02	27500
cmuppa87j000c14fahua2v37a	cmuppa87i000914fatio3ls2b	3	2026-10-03	27500
cmuppa87j000d14favl9c7onz	cmuppa87i000914fatio3ls2b	4	2026-10-05	27500
cmuppa87j000e14fablyvni6n	cmuppa87i000914fatio3ls2b	5	2026-10-06	27500
cmuppa87j000f14favrw5mmv9	cmuppa87i000914fatio3ls2b	6	2026-10-07	27500
cmuppa87j000g14fa9ya012j2	cmuppa87i000914fatio3ls2b	7	2026-10-08	27500
cmuppa87j000h14faokreh3gm	cmuppa87i000914fatio3ls2b	8	2026-10-09	27500
cmuppa87j000i14fatwd5inzq	cmuppa87i000914fatio3ls2b	9	2026-10-10	27500
cmuppa87j000j14faopmduva8	cmuppa87i000914fatio3ls2b	10	2026-10-12	27500
cmuppa87j000k14faa2ugm0pe	cmuppa87i000914fatio3ls2b	11	2026-10-13	27500
cmuppa87j000l14fa9pvubk14	cmuppa87i000914fatio3ls2b	12	2026-10-14	27500
cmuppa87j000m14faaa8ee9gv	cmuppa87i000914fatio3ls2b	13	2026-10-15	27500
cmuppa87j000n14faiwsfm4nf	cmuppa87i000914fatio3ls2b	14	2026-10-16	27500
cmuppa87j000o14fal3fwlj3q	cmuppa87i000914fatio3ls2b	15	2026-10-17	27500
cmuppa87j000p14fa30mjuz0b	cmuppa87i000914fatio3ls2b	16	2026-10-19	27500
cmuppa87j000q14fawsvrvzfd	cmuppa87i000914fatio3ls2b	17	2026-10-20	27500
cmuppa87j000r14fa915fdpo2	cmuppa87i000914fatio3ls2b	18	2026-10-21	27500
cmuppa87j000s14fai02wjohs	cmuppa87i000914fatio3ls2b	19	2026-10-22	27500
cmuppa87j000t14fal4e61jnc	cmuppa87i000914fatio3ls2b	20	2026-10-23	27500
cmuppa87j000u14fagwqnsngw	cmuppa87i000914fatio3ls2b	21	2026-10-24	27500
cmuppa87j000v14fanhou422a	cmuppa87i000914fatio3ls2b	22	2026-10-26	27500
cmuppa87j000w14falk82obko	cmuppa87i000914fatio3ls2b	23	2026-10-27	27500
cmuppa87j000x14fab0v9zkdm	cmuppa87i000914fatio3ls2b	24	2026-10-28	27500
cmuppa87j000y14faz4tq7byr	cmuppa87i000914fatio3ls2b	25	2026-10-29	27500
cmuppa87j000z14fathydhnip	cmuppa87i000914fatio3ls2b	26	2026-10-30	27500
cmuppa87j001014fanc4h6mty	cmuppa87i000914fatio3ls2b	27	2026-10-31	27500
cmuppa87j001114fafb8epgle	cmuppa87i000914fatio3ls2b	28	2026-11-02	27500
cmuppa87j001214fatgzp7cdo	cmuppa87i000914fatio3ls2b	29	2026-11-03	27500
cmuppa87j001314fae7idb4qu	cmuppa87i000914fatio3ls2b	30	2026-11-04	27500
cmuppa87j001414fao5nb8gbe	cmuppa87i000914fatio3ls2b	31	2026-11-05	27500
cmuppa87j001514fa6lyih4m9	cmuppa87i000914fatio3ls2b	32	2026-11-06	27500
cmuppa87j001614fakuxsw9e0	cmuppa87i000914fatio3ls2b	33	2026-11-07	27500
cmuppa87j001714faccthr1be	cmuppa87i000914fatio3ls2b	34	2026-11-09	27500
cmuppa87k001814fapijne81e	cmuppa87i000914fatio3ls2b	35	2026-11-10	27500
cmuppa87k001914faw5jf240d	cmuppa87i000914fatio3ls2b	36	2026-11-11	27500
cmuppa87k001a14fatba35rsg	cmuppa87i000914fatio3ls2b	37	2026-11-12	27500
cmuppa87k001b14fagttiqlq0	cmuppa87i000914fatio3ls2b	38	2026-11-13	27500
cmuppa87k001c14fang0jqk0g	cmuppa87i000914fatio3ls2b	39	2026-11-14	27500
cmuppa87k001d14fab1j9t33j	cmuppa87i000914fatio3ls2b	40	2026-11-16	27500
cmuppa87k001e14faucq1k2jb	cmuppa87i000914fatio3ls2b	41	2026-11-17	27500
cmuppa87k001f14fa83zg9y9j	cmuppa87i000914fatio3ls2b	42	2026-11-18	27500
cmuppa87k001g14fa1kuu8y1y	cmuppa87i000914fatio3ls2b	43	2026-11-19	27500
cmuppa87k001h14fani7kpz56	cmuppa87i000914fatio3ls2b	44	2026-11-20	27500
cmuppa87k001i14fap65100xw	cmuppa87i000914fatio3ls2b	45	2026-11-21	27500
cmuppa87k001j14fa9tojov3s	cmuppa87i000914fatio3ls2b	46	2026-11-23	27500
cmuppa87k001k14fa6hlmrsuw	cmuppa87i000914fatio3ls2b	47	2026-11-24	27500
cmuppa87k001l14fak72axc2u	cmuppa87i000914fatio3ls2b	48	2026-11-25	27500
cmuppa87k001m14fau81m1wyq	cmuppa87i000914fatio3ls2b	49	2026-11-26	27500
cmuppa87k001n14faobxmbdeb	cmuppa87i000914fatio3ls2b	50	2026-11-27	27500
cmuppa87k001o14fac7xoz3z1	cmuppa87i000914fatio3ls2b	51	2026-11-28	27500
cmuppa87k001p14faz04r2swe	cmuppa87i000914fatio3ls2b	52	2026-11-30	27500
cmuppa87k001q14favemixklg	cmuppa87i000914fatio3ls2b	53	2026-12-01	27500
cmuppa87k001r14faar5tqtpc	cmuppa87i000914fatio3ls2b	54	2026-12-02	27500
cmuppa87k001s14faic2jkehd	cmuppa87i000914fatio3ls2b	55	2026-12-03	27500
cmuppa87k001t14fambemqv2o	cmuppa87i000914fatio3ls2b	56	2026-12-04	27500
cmuppa87k001u14fafzehk29m	cmuppa87i000914fatio3ls2b	57	2026-12-05	27500
cmuppa87k001v14fa5ytib6vm	cmuppa87i000914fatio3ls2b	58	2026-12-07	27500
cmuppa87k001w14fafdxnooz3	cmuppa87i000914fatio3ls2b	59	2026-12-08	27500
cmuppa87k001x14fayknjfryr	cmuppa87i000914fatio3ls2b	60	2026-12-09	27500
cmuppa87k001y14fa0otgzdol	cmuppa87i000914fatio3ls2b	61	2026-12-10	27500
cmuppa87k001z14fam8bjxdeb	cmuppa87i000914fatio3ls2b	62	2026-12-11	27500
cmuppa87k002014fam9wnz2je	cmuppa87i000914fatio3ls2b	63	2026-12-12	27500
cmuppa87k002114faetdnj59l	cmuppa87i000914fatio3ls2b	64	2026-12-14	27500
cmuppa87k002214faqaiwl7a6	cmuppa87i000914fatio3ls2b	65	2026-12-15	27500
cmuppa87k002314fan75b1xjw	cmuppa87i000914fatio3ls2b	66	2026-12-16	27500
cmuppa87k002414fa1szgcc1r	cmuppa87i000914fatio3ls2b	67	2026-12-17	27500
cmuppa87k002514fauygopuh4	cmuppa87i000914fatio3ls2b	68	2026-12-18	27500
cmuppa87k002614fawqfp0crv	cmuppa87i000914fatio3ls2b	69	2026-12-19	27500
cmuppa87k002714fa5n544lst	cmuppa87i000914fatio3ls2b	70	2026-12-21	27500
cmuppa87k002814farlo413cu	cmuppa87i000914fatio3ls2b	71	2026-12-22	27500
cmuppa87k002914fa3osc2mub	cmuppa87i000914fatio3ls2b	72	2026-12-23	27500
cmuppa87k002a14fabd1lq4ep	cmuppa87i000914fatio3ls2b	73	2026-12-24	27500
cmuppa87k002b14faa2opfhgw	cmuppa87i000914fatio3ls2b	74	2026-12-25	27500
cmuppa87k002c14fae7fbqkug	cmuppa87i000914fatio3ls2b	75	2026-12-26	27500
cmuppa87k002d14fald6zjw8i	cmuppa87i000914fatio3ls2b	76	2026-12-28	27500
cmuppa87k002e14fap467dhd6	cmuppa87i000914fatio3ls2b	77	2026-12-29	27500
cmuppa87k002f14fabkium31a	cmuppa87i000914fatio3ls2b	78	2026-12-30	27500
cmuppa87k002g14fa4tsqswdh	cmuppa87i000914fatio3ls2b	79	2026-12-31	27500
cmuppa87k002h14fa0vfr50pm	cmuppa87i000914fatio3ls2b	80	2027-01-01	27500
cmuppa87k002i14falw2sohiz	cmuppa87i000914fatio3ls2b	81	2027-01-02	27500
cmuppa87k002j14fa9rvxa36c	cmuppa87i000914fatio3ls2b	82	2027-01-04	27500
cmuppa87k002k14fas5aoyqv4	cmuppa87i000914fatio3ls2b	83	2027-01-05	27500
cmuppa87k002l14fatphy4024	cmuppa87i000914fatio3ls2b	84	2027-01-06	27500
cmuppa87k002m14fa54fezu8q	cmuppa87i000914fatio3ls2b	85	2027-01-07	27500
cmuppa87k002n14fa6h9cg7q6	cmuppa87i000914fatio3ls2b	86	2027-01-08	27500
cmuppa87k002o14fa353bcgeq	cmuppa87i000914fatio3ls2b	87	2027-01-09	27500
cmuppa87k002p14fauzvg4rpn	cmuppa87i000914fatio3ls2b	88	2027-01-11	27500
cmuppa87k002q14fa8yrpluur	cmuppa87i000914fatio3ls2b	89	2027-01-12	27500
cmuppa87k002r14fayrwps9oy	cmuppa87i000914fatio3ls2b	90	2027-01-13	27500
cmuppa87k002s14fap4io9e24	cmuppa87i000914fatio3ls2b	91	2027-01-14	27500
cmuppa87k002t14fa063ct9s6	cmuppa87i000914fatio3ls2b	92	2027-01-15	27500
cmuppa87k002u14fat73ykq2z	cmuppa87i000914fatio3ls2b	93	2027-01-16	27500
cmuppa87k002v14fatfqkf772	cmuppa87i000914fatio3ls2b	94	2027-01-18	27500
cmuppa87k002w14faos6zh40t	cmuppa87i000914fatio3ls2b	95	2027-01-19	27500
cmuppa87k002x14faiuqcafvl	cmuppa87i000914fatio3ls2b	96	2027-01-20	27500
cmuppa87k002y14faa67e2vui	cmuppa87i000914fatio3ls2b	97	2027-01-21	27500
cmuppa87k002z14fa5mz8h1aq	cmuppa87i000914fatio3ls2b	98	2027-01-22	27500
cmuppa87k003014faz96358ph	cmuppa87i000914fatio3ls2b	99	2027-01-23	27500
cmuppa87k003114fae114van7	cmuppa87i000914fatio3ls2b	100	2027-01-25	27500
cmuqe38gl0044bmedc1aa0jsn	cmuqdyhbm000qbmedmshliudi	1	2026-10-02	10000
cmuqe38gl0045bmedb6kjzmv4	cmuqdyhbm000qbmedmshliudi	2	2026-10-03	10000
cmuqe38gl0046bmedx0u3wu7x	cmuqdyhbm000qbmedmshliudi	3	2026-10-05	10000
cmuqe38gl0047bmedrp43n7qm	cmuqdyhbm000qbmedmshliudi	4	2026-10-06	10000
cmuqe38gl0048bmedyb5lc21c	cmuqdyhbm000qbmedmshliudi	5	2026-10-07	10000
cmuqe38gl0049bmedg6j68dpm	cmuqdyhbm000qbmedmshliudi	6	2026-10-08	10000
cmuqe38gl004abmed9y4u5q10	cmuqdyhbm000qbmedmshliudi	7	2026-10-09	10000
cmuqe38gl004bbmedzlw5v3og	cmuqdyhbm000qbmedmshliudi	8	2026-10-10	10000
cmuqe38gl004cbmed34gtoz3b	cmuqdyhbm000qbmedmshliudi	9	2026-10-12	10000
cmuqe38gl004dbmedvb3jrhb0	cmuqdyhbm000qbmedmshliudi	10	2026-10-13	10000
cmuqe38gl004ebmed3432ek9k	cmuqdyhbm000qbmedmshliudi	11	2026-10-14	10000
cmuqe38gl004fbmed76z51f2g	cmuqdyhbm000qbmedmshliudi	12	2026-10-15	10000
cmuqe38gl004gbmed7y75m51q	cmuqdyhbm000qbmedmshliudi	13	2026-10-16	10000
cmuqe38gl004hbmedb9qyrjph	cmuqdyhbm000qbmedmshliudi	14	2026-10-17	10000
cmuqe38gl004ibmedtt064fqv	cmuqdyhbm000qbmedmshliudi	15	2026-10-19	10000
cmuqe38gl004jbmed679pv074	cmuqdyhbm000qbmedmshliudi	16	2026-10-20	10000
cmuqe38gl004kbmed22sn3mba	cmuqdyhbm000qbmedmshliudi	17	2026-10-21	10000
cmuqe38gl004lbmed00nouhrh	cmuqdyhbm000qbmedmshliudi	18	2026-10-22	10000
cmuqe38gl004mbmed8m2s38i7	cmuqdyhbm000qbmedmshliudi	19	2026-10-23	10000
cmuqe38gl004nbmedxsc7jv12	cmuqdyhbm000qbmedmshliudi	20	2026-10-24	10000
cmuqe38gl004obmedbdgqjcan	cmuqdyhbm000qbmedmshliudi	21	2026-10-26	10000
cmuqe38gl004pbmed65k024dh	cmuqdyhbm000qbmedmshliudi	22	2026-10-27	10000
cmuqe38gl004qbmedb4umh0el	cmuqdyhbm000qbmedmshliudi	23	2026-10-28	10000
cmuqe38gl004rbmedqv7jg03f	cmuqdyhbm000qbmedmshliudi	24	2026-10-29	10000
cmuqe38gl004sbmed8g8wmuub	cmuqdyhbm000qbmedmshliudi	25	2026-10-30	10000
cmuqe38gl004tbmedtnl8n3ez	cmuqdyhbm000qbmedmshliudi	26	2026-10-31	10000
cmuqe38gl004ubmedr3ipybnm	cmuqdyhbm000qbmedmshliudi	27	2026-11-02	10000
cmuqe38gl004vbmedl8xhans2	cmuqdyhbm000qbmedmshliudi	28	2026-11-03	10000
cmuqe38gl004wbmed093h2y2a	cmuqdyhbm000qbmedmshliudi	29	2026-11-04	10000
cmuqe38gl004xbmedla54hm02	cmuqdyhbm000qbmedmshliudi	30	2026-11-05	10000
cmuqe38gl004ybmed4fil3bvd	cmuqdyhbm000qbmedmshliudi	31	2026-11-06	10000
cmuqe38gl004zbmedlhou6a6q	cmuqdyhbm000qbmedmshliudi	32	2026-11-07	10000
cmuqe38gl0050bmedotefu5nl	cmuqdyhbm000qbmedmshliudi	33	2026-11-09	10000
cmuqe38gl0051bmedbq78t42c	cmuqdyhbm000qbmedmshliudi	34	2026-11-10	10000
cmuqe38gl0052bmedbn0toeq4	cmuqdyhbm000qbmedmshliudi	35	2026-11-11	10000
cmuqe38gl0053bmed23d07kun	cmuqdyhbm000qbmedmshliudi	36	2026-11-12	10000
cmuqe38gl0054bmedk9euyuya	cmuqdyhbm000qbmedmshliudi	37	2026-11-13	10000
cmuqe38gl0055bmed5xbnij6e	cmuqdyhbm000qbmedmshliudi	38	2026-11-14	10000
cmuqe38gl0056bmed27ht8n62	cmuqdyhbm000qbmedmshliudi	39	2026-11-16	10000
cmuqe38gl0057bmedmk2iokjw	cmuqdyhbm000qbmedmshliudi	40	2026-11-17	10000
cmuqe38gl0058bmedqvplaiz8	cmuqdyhbm000qbmedmshliudi	41	2026-11-18	10000
cmuqe38gl0059bmedhbabpfv9	cmuqdyhbm000qbmedmshliudi	42	2026-11-19	10000
cmuqe38gl005abmed592egm2m	cmuqdyhbm000qbmedmshliudi	43	2026-11-20	10000
cmuqe38gl005bbmed4k1wgtsb	cmuqdyhbm000qbmedmshliudi	44	2026-11-21	10000
cmuqe38gl005cbmedvjeqna57	cmuqdyhbm000qbmedmshliudi	45	2026-11-23	10000
cmuqe38gl005dbmedlq4ww3jp	cmuqdyhbm000qbmedmshliudi	46	2026-11-24	10000
cmuqe38gl005ebmedndm9huh5	cmuqdyhbm000qbmedmshliudi	47	2026-11-25	10000
cmuqe38gl005fbmedsqlmx9bm	cmuqdyhbm000qbmedmshliudi	48	2026-11-26	10000
cmuqe38gl005gbmed9drxodfh	cmuqdyhbm000qbmedmshliudi	49	2026-11-27	10000
cmuqe38gl005hbmed9uri36v8	cmuqdyhbm000qbmedmshliudi	50	2026-11-28	10000
cmuqe38gl005ibmedbfpnqs3u	cmuqdyhbm000qbmedmshliudi	51	2026-11-30	10000
cmuqe38gl005jbmed88ynhoy3	cmuqdyhbm000qbmedmshliudi	52	2026-12-01	10000
cmuqe38gl005kbmedjq04sm0e	cmuqdyhbm000qbmedmshliudi	53	2026-12-02	10000
cmuqe38gl005lbmedas00f51u	cmuqdyhbm000qbmedmshliudi	54	2026-12-03	10000
cmuqe38gl005mbmedbvojee73	cmuqdyhbm000qbmedmshliudi	55	2026-12-04	10000
cmuqe38gl005nbmedtucbe9jp	cmuqdyhbm000qbmedmshliudi	56	2026-12-05	10000
cmuqe38gl005obmedd34adjzv	cmuqdyhbm000qbmedmshliudi	57	2026-12-07	10000
cmuqe38gl005pbmed11zyrf5c	cmuqdyhbm000qbmedmshliudi	58	2026-12-08	10000
cmuqe38gl005qbmed9z8kw6j6	cmuqdyhbm000qbmedmshliudi	59	2026-12-09	10000
cmuqe38gl005rbmedu51rdi4h	cmuqdyhbm000qbmedmshliudi	60	2026-12-10	10000
cmuqe38gl005sbmedzusjply2	cmuqdyhbm000qbmedmshliudi	61	2026-12-11	10000
cmuqe38gl005tbmedq0kzqwwv	cmuqdyhbm000qbmedmshliudi	62	2026-12-12	10000
cmuqe38gl005ubmed14delbse	cmuqdyhbm000qbmedmshliudi	63	2026-12-14	10000
cmuqe38gl005vbmeddqwt357c	cmuqdyhbm000qbmedmshliudi	64	2026-12-15	10000
cmuqe38gl005wbmed0gi45ipk	cmuqdyhbm000qbmedmshliudi	65	2026-12-16	10000
cmuqe38gm005xbmed6uvixlc7	cmuqdyhbm000qbmedmshliudi	66	2026-12-17	10000
cmuqe38gm005ybmedkx7u286t	cmuqdyhbm000qbmedmshliudi	67	2026-12-18	10000
cmuqe38gm005zbmedn0kyfn3b	cmuqdyhbm000qbmedmshliudi	68	2026-12-19	10000
cmuqe38gm0060bmedfctm84yr	cmuqdyhbm000qbmedmshliudi	69	2026-12-21	10000
cmuqe38gm0061bmedoo66ea9k	cmuqdyhbm000qbmedmshliudi	70	2026-12-22	10000
cmuqe38gm0062bmedqnrnflgz	cmuqdyhbm000qbmedmshliudi	71	2026-12-23	10000
cmuqe38gm0063bmedzq7aqbt3	cmuqdyhbm000qbmedmshliudi	72	2026-12-24	10000
cmuqe38gm0064bmedm548gs4p	cmuqdyhbm000qbmedmshliudi	73	2026-12-25	10000
cmuqe38gm0065bmed9z67go7b	cmuqdyhbm000qbmedmshliudi	74	2026-12-26	10000
cmuqe38gm0066bmedw0x57lf1	cmuqdyhbm000qbmedmshliudi	75	2026-12-28	10000
cmuqe38gm0067bmedwi0h8ooc	cmuqdyhbm000qbmedmshliudi	76	2026-12-29	10000
cmuqe38gm0068bmed8ey7bc6y	cmuqdyhbm000qbmedmshliudi	77	2026-12-30	10000
cmuqe38gm0069bmed56fxpkyb	cmuqdyhbm000qbmedmshliudi	78	2026-12-31	10000
cmuqe38gm006abmed87z5kfhx	cmuqdyhbm000qbmedmshliudi	79	2027-01-01	10000
cmuqe38gm006bbmedwi1m5ro4	cmuqdyhbm000qbmedmshliudi	80	2027-01-02	10000
cmuqe38gm006cbmed92qv751j	cmuqdyhbm000qbmedmshliudi	81	2027-01-04	10000
cmuqe38gm006dbmed8ckv1fkj	cmuqdyhbm000qbmedmshliudi	82	2027-01-05	10000
cmuqe38gm006ebmedsc7eepr0	cmuqdyhbm000qbmedmshliudi	83	2027-01-06	10000
cmuqe38gm006fbmedo7sy7ttz	cmuqdyhbm000qbmedmshliudi	84	2027-01-07	10000
cmuqe38gm006gbmed7gilzuyb	cmuqdyhbm000qbmedmshliudi	85	2027-01-08	10000
cmuqe38gm006hbmedznw0hf48	cmuqdyhbm000qbmedmshliudi	86	2027-01-09	10000
cmuqe38gm006ibmedgkt0yq52	cmuqdyhbm000qbmedmshliudi	87	2027-01-11	10000
cmuqe38gm006jbmed510s2pkt	cmuqdyhbm000qbmedmshliudi	88	2027-01-12	10000
cmuqe38gm006kbmed1fj8z1u3	cmuqdyhbm000qbmedmshliudi	89	2027-01-13	10000
cmuqe38gm006lbmedw71vfar6	cmuqdyhbm000qbmedmshliudi	90	2027-01-14	10000
cmuqe38gm006mbmedr5x8km3l	cmuqdyhbm000qbmedmshliudi	91	2027-01-15	10000
cmuqe38gm006nbmedxqkxgv62	cmuqdyhbm000qbmedmshliudi	92	2027-01-16	10000
cmuqe38gm006obmed2n7n8wg9	cmuqdyhbm000qbmedmshliudi	93	2027-01-18	10000
cmuqe38gm006pbmedi9rrdoc7	cmuqdyhbm000qbmedmshliudi	94	2027-01-19	10000
cmuqe38gm006qbmedvhpgg20y	cmuqdyhbm000qbmedmshliudi	95	2027-01-20	10000
cmuqe38gm006rbmedzul54nz3	cmuqdyhbm000qbmedmshliudi	96	2027-01-21	10000
cmuqe38gm006sbmedkke0gysi	cmuqdyhbm000qbmedmshliudi	97	2027-01-22	10000
cmuqe38gm006tbmedcs63fm13	cmuqdyhbm000qbmedmshliudi	98	2027-01-23	10000
cmuqe38gm006ubmedv3h4zpdp	cmuqdyhbm000qbmedmshliudi	99	2027-01-25	10000
cmuqe38gm006vbmed80zx26u3	cmuqdyhbm000qbmedmshliudi	100	2027-01-26	10000
cmuqe38gm006wbmedmy9r9dbw	cmuqdyhbm000qbmedmshliudi	101	2027-01-27	10000
cmuqe38gm006xbmedibujytbl	cmuqdyhbm000qbmedmshliudi	102	2027-01-28	10000
cmuqe38gm006ybmedca7yrk28	cmuqdyhbm000qbmedmshliudi	103	2027-01-29	10000
cmuqe38gm006zbmedhih93dbg	cmuqdyhbm000qbmedmshliudi	104	2027-01-30	10000
cmuqe38gm0070bmedo2sshp46	cmuqdyhbm000qbmedmshliudi	105	2027-02-01	10000
cmuqe38gm0071bmedf1chqyyu	cmuqdyhbm000qbmedmshliudi	106	2027-02-02	10000
cmuqe38gm0072bmedfrdbg62r	cmuqdyhbm000qbmedmshliudi	107	2027-02-03	10000
cmuqe38gm0073bmedqsn6o8a1	cmuqdyhbm000qbmedmshliudi	108	2027-02-04	10000
cmuqe38gm0074bmed5q49h4bb	cmuqdyhbm000qbmedmshliudi	109	2027-02-05	10000
cmuqe38gm0075bmedv2i6osfm	cmuqdyhbm000qbmedmshliudi	110	2027-02-06	10000
cmuqe38gm0076bmedyxpvlr0p	cmuqdyhbm000qbmedmshliudi	111	2027-02-08	10000
cmuqe38gm0077bmed47huuxhf	cmuqdyhbm000qbmedmshliudi	112	2027-02-09	10000
cmuqe38gm0078bmed98qvvm9e	cmuqdyhbm000qbmedmshliudi	113	2027-02-10	10000
cmuqe38gm0079bmed68hgzk3k	cmuqdyhbm000qbmedmshliudi	114	2027-02-11	10000
cmuqe38gm007abmed02kmuf8i	cmuqdyhbm000qbmedmshliudi	115	2027-02-12	10000
cmuqe38gm007bbmedecla4qqc	cmuqdyhbm000qbmedmshliudi	116	2027-02-13	10000
cmuqe38gm007cbmedlovsavaz	cmuqdyhbm000qbmedmshliudi	117	2027-02-15	10000
cmuqe38gm007dbmedemyg017u	cmuqdyhbm000qbmedmshliudi	118	2027-02-16	10000
cmuqe38gm007ebmedk2lpizs0	cmuqdyhbm000qbmedmshliudi	119	2027-02-17	10000
cmuqe38gm007fbmedi9g36hkc	cmuqdyhbm000qbmedmshliudi	120	2027-02-18	10000
\.


--
-- Data for Name: PasswordResetRequest; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."PasswordResetRequest" (id, "userId", status, note, "resolvedBy", "resolvedAt", "ipAddress", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."Payment" (id, "receiptNumber", "loanId", "businessId", amount, "paymentDate", "collectorId", note, latitude, longitude, "isDeleted", "createdAt", "updatedAt") FROM stdin;
cmupnp75c000z14mh7g33xsb7	KFC-00001	cmupnay1p000d14mhwcsglfw3	cmupn1uor000214mh39aw2s8z	20000	2026-10-01	cmupmusg30006j4bapl84qx9i	\N	\N	\N	f	2026-10-01 14:55:41.424	2026-10-01 14:55:41.424
cmuqe4plx007ibmed7jbzdkr5	DF-00001	cmuqdyhbm000qbmedmshliudi	cmuqdn6ik000ebmed1brqfqur	10000	2026-10-02	cmuqdt4s1000gbmed10v5wyw7	\N	\N	\N	f	2026-10-02 03:15:35.205	2026-10-02 03:15:35.205
cmuppbbqk003414fasz36kdnx	REC-00001	cmuppa87i000914fatio3ls2b	cmupndz1c000v14mharvge5lw	725000	2026-10-01	cmupuaval000714fvmqiu5pz4	\N	\N	\N	f	2026-10-01 15:40:53.42	2026-10-02 07:11:47.599
cmuqd6ckc0004bmedzc9fanv1	REC-00002	cmuppa87i000914fatio3ls2b	cmupndz1c000v14mharvge5lw	150000	2026-10-02	cmupuaval000714fvmqiu5pz4	\N	\N	\N	f	2026-10-02 02:48:51.996	2026-10-02 07:12:00.291
cmuqoheoa0009h51ku0qkmjgn	KFC-00002	cmupnay1p000d14mhwcsglfw3	cmupn1uor000214mh39aw2s8z	20000	2026-10-02	cmupmusg30006j4bapl84qx9i	\N	\N	\N	f	2026-10-02 08:05:23.722	2026-10-02 08:08:40.399
\.


--
-- Data for Name: PlatformSetting; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."PlatformSetting" (id, key, value, "updatedAt", "updatedBy") FROM stdin;
29aa085d-7811-4ba3-ba0b-dfa78a7e3106	contact_us	{"phone":"9553947222","emails":["smartrams121@gmail.com","itibablu@gmail.com"]}	2026-10-01 19:11:25.209	\N
80cab242-02b4-40e6-b01f-2d2caae42ef4	faq	[{"question":"How do I register as a new owner?","answer":"Go to the Register page and fill in your full name, phone number (10-digit Indian mobile starting with 6-9), username (4-20 characters using letters, numbers, dots, or underscores), password, business name, city, and at least one location/village. Your request will be submitted for review by the Platform Admin."},{"question":"What are the password requirements for self-registration?","answer":"Your password must be at least 8 characters long, contain at least one uppercase letter, one number, and one special character."},{"question":"How long does registration approval take?","answer":"The Platform Admin reviews and approves or rejects registration requests. You will see a status message when you try to log in — either 'pending approval' or 'not approved'. Contact the platform admin if your request is delayed."},{"question":"Can I use the same phone number for multiple registrations?","answer":"The system flags duplicate phone numbers for the admin's review, but it does not block registration. The Platform Admin makes the final decision on approval."},{"question":"What happens if my chosen username is already taken?","answer":"You'll be notified immediately while typing. Choose a different username — only letters, numbers, dots, and underscores are allowed (4-20 characters)."},{"question":"What happens after too many failed login attempts?","answer":"After 5 consecutive failed login attempts, your account is temporarily locked for 15 minutes. Wait for the lockout period to expire and try again with the correct password."},{"question":"How long does my login session last?","answer":"Sessions last up to 24 hours by default (configurable by the admin). Additionally, you are automatically logged out after 30 minutes of inactivity. The inactivity timeout can be configured per business (5 to 480 minutes)."},{"question":"Why am I asked to change my password on first login?","answer":"If your account was created by a Platform Admin or Business Owner (not self-registered), you must change the temporary password on first login for security. Self-registered users who chose their own password during registration are not required to do this."},{"question":"What is Two-Factor Authentication (2FA)?","answer":"Platform Admins and Owners are prompted to set up TOTP-based two-factor authentication (using apps like Google Authenticator) after their first password change. This adds an extra layer of security to your account. You will receive 8 recovery codes in case you lose access to your authenticator app."},{"question":"What user roles exist and what can each role do?","answer":"There are 4 roles: (1) Platform Admin — manages owners, registration requests, and platform-wide settings. (2) Owner — full control over their businesses, users, customers, loans, payments, reports, and expenses. (3) Business Admin — similar to Owner but cannot create/deactivate businesses or grant support access. (4) Agent — limited to creating customers, posting payments, bulk posting, and viewing their own collection report in assigned villages only."},{"question":"Can an Agent see all customers and reports?","answer":"No. Agents can only see customers and data in the specific villages they are assigned to. They can only view their own collection report, not reports from other agents or the full business."},{"question":"How does the platform prevent unauthorized access?","answer":"All pages require authentication via a secure httpOnly cookie that cannot be accessed by JavaScript. Unauthenticated API requests receive a 401 error, and unauthenticated page requests are redirected to the login page. Every API endpoint verifies the user's role and specific permissions before processing any action."},{"question":"What is role-based access control (RBAC)?","answer":"The system defines 36 distinct permission actions. Each user role is assigned a specific set of permissions. Before any action (creating a loan, posting a payment, viewing a report), the system checks that the logged-in user has the required permission. Unauthorized actions are blocked with a 403 Forbidden error."},{"question":"What is Support Access?","answer":"An Owner can grant time-limited access to the Platform Admin to view their business data for troubleshooting purposes. This access expires automatically after the set duration and can be revoked by the Owner at any time."},{"question":"Are API rate limits in place?","answer":"Yes. Registration is limited to 3 attempts per IP address per hour. Username availability checks are limited to 20 per IP per minute. Login is limited to 5 attempts per username before a 15-minute lockout. These limits protect against brute-force attacks and abuse."},{"question":"How is the Aadhaar number stored and protected?","answer":"Aadhaar numbers are never stored in plain text. The system stores a one-way SHA-256 hash of the full Aadhaar number (which cannot be reversed) and only keeps the last 4 digits in cleartext for display purposes (shown as XXXX XXXX 1234). This ensures that even if the database is compromised, full Aadhaar numbers cannot be recovered."},{"question":"How are passwords secured?","answer":"All passwords are hashed using bcrypt with 12 salt rounds — an industry-standard, irreversible hashing algorithm. The original password is never stored. Session tokens are signed JWTs stored in httpOnly cookies that cannot be accessed by client-side JavaScript, preventing XSS-based token theft."},{"question":"Who can view customer personal information?","answer":"Only users with 'view_customer' permission can view customer details — this includes Owners, Business Admins, and Agents. Agents are further restricted to customers in their assigned villages only. Platform Admins cannot see customer data unless the Owner grants them time-limited Support Access."},{"question":"Can I delete customer data?","answer":"Yes. Owners and Business Admins with the 'delete_customer' permission can delete customer records. This is a permanent action."},{"question":"What fields are required to add a customer?","answer":"Full name (minimum 2 characters), phone number (10-digit Indian mobile starting with 6, 7, 8, or 9), and location/village are required. Optional fields include age (18-100), alternate phone, address, Aadhaar number (12 digits), job type, guarantor name and phone, notes, and photo."},{"question":"Can I have duplicate phone numbers for customers?","answer":"Yes, the system does not enforce phone uniqueness at the customer level within a business. Multiple customers can share the same phone number."},{"question":"How does customer rating work?","answer":"Customers are automatically rated on a 1-4 scale based on loan repayment history: Excellent (4) for on-time completion, Good (3) for minor delays within the good threshold, Average (2) for moderate delays, and Bad (1) for significant delays. Written-off loans always result in a Bad (1) rating. The customer's overall rating is the average of all their loan ratings."},{"question":"What collection types are supported?","answer":"Three types: (1) Daily — installments collected every working day (Sundays are skipped unless 'Collect on Sundays' is enabled; holidays are also skipped). (2) Weekly — installments collected on a specific day of the week. (3) Monthly — installments collected on the same date each month (handles month-end overflow, e.g., 31st in February rolls to the last day)."},{"question":"What is the difference between ADDON and UPFRONT interest?","answer":"ADDON: The customer receives the full loan principal; interest is added on top. Total repayable = principal + interest. UPFRONT: Interest is deducted from the principal before disbursement; the customer receives less. Amount given = principal - interest. Total repayable remains principal + interest."},{"question":"How is the installment schedule generated?","answer":"The system automatically generates a payment schedule based on the collection type, start date, and number of installments. For Daily loans, Sundays (unless enabled) and holidays are skipped. For Weekly loans, installments fall on the specified day. For Monthly loans, they fall on the same date. The last installment is adjusted for any rounding difference."},{"question":"What are the loan statuses?","answer":"Active — loan is within its expected collection period. Overdue — past the expected end date (up to 1 year). Defaulter — more than 1 year past the expected end date. Completed — fully paid (total paid equals total repayable)."},{"question":"Can I renew a loan?","answer":"Yes. When creating a new loan, you can link it to an existing active loan for renewal. The old loan is automatically marked as Completed, and the outstanding balance can be carried forward into the new loan calculation."},{"question":"What validation applies to the last installment?","answer":"The last installment must be a positive amount and cannot exceed 2x the regular installment amount. This validation prevents unreasonable balloon payments at the end of the loan."},{"question":"Can I post a payment for a future date?","answer":"No. Payment dates cannot be in the future. Payments must be for today or a past date."},{"question":"How far back can I backdate a payment?","answer":"Payments can be backdated up to 1 month (30 days). The payment date also cannot be before the loan's start date."},{"question":"Can I overpay on a loan?","answer":"No. The payment amount cannot exceed the outstanding balance on the loan. When the total paid equals the total repayable amount, the loan is automatically marked as Completed."},{"question":"How does bulk payment posting work?","answer":"Select a village and payment date, then enter payment amounts for multiple active loans at once. Maximum 200 entries per bulk request. Duplicate loan entries in the same batch are not allowed. All payments in a batch are processed atomically — either all succeed or none are saved."},{"question":"Can Agents edit payments?","answer":"Agents can only edit their own payments made on the same day. Owners and Business Admins can edit any payment, including payments made by others and on previous dates."},{"question":"What report types are available?","answer":"Six report types: Customers (list with status and details), Loans (with principal, interest, outstanding, and status filtering), Villages (location-wise summary with drill-down), Employees (staff activity and collection summary), Payments (transaction history with receipt details), and Collection Payslips (active loan collection slips). All reports require a date range."},{"question":"What export formats are supported?","answer":"Reports can be exported as Excel (XLSX) files with styled headers and formatting, or shared as PDF documents via WhatsApp."},{"question":"Can Agents view all reports?","answer":"No. Agents can only view their own collection report showing payments they have collected. Owners and Business Admins can view all report types for their businesses."},{"question":"What settings can I configure for my business?","answer":"Business name, city, receipt prefix (up to 5 uppercase letters), collection type, default collection day, interest model (ADDON/UPFRONT), Sunday collection toggle, grace periods for each collection type, customer rating thresholds, WhatsApp message template, and auto-logout timeout (5 to 480 minutes)."},{"question":"Can I add locations/villages after initial setup?","answer":"Yes. Owners and Business Admins can add new villages at any time. Village names must be unique within the business and between 2-100 characters. Agents can only see villages they are assigned to."},{"question":"What currency and units does the app use?","answer":"All monetary amounts are stored internally in paise (1/100 of Indian Rupee) for precision. Amounts are displayed in Rupees (₹) in the user interface."},{"question":"What timezone does the app use?","answer":"All dates and times operate in Indian Standard Time (IST, UTC+5:30). Date format used throughout the system is YYYY-MM-DD internally and DD/MM/YYYY for display."},{"question":"Can one owner see another owner's business data?","answer":"No. Strict data isolation is enforced at the database query level. Each Owner can only access their own businesses and the data within them. The system checks ownership on every API request — an Owner cannot query, view, or modify any business, customer, loan, or payment belonging to another Owner. This is enforced server-side and cannot be bypassed through the interface."},{"question":"Can the Platform Admin see business data?","answer":"By default, no. The Platform Admin can only manage owners, registration requests, and platform settings. To view any business data, the Owner must explicitly grant time-limited Support Access. This access expires automatically and can be revoked at any time. Without an active, non-expired support access grant, the Platform Admin has zero visibility into any business data."},{"question":"How is business data isolated between owners?","answer":"Every API request passes through a scope-checking layer that verifies the requesting user has legitimate access to the specific business. Owners are matched by ownership records, Business Admins and Agents by their assignment records, and Platform Admins by active support access grants. Any mismatch results in an immediate 'Access Denied' error. There is no global admin override — not even Platform Admins can bypass this without an explicit grant from the Owner."},{"question":"What data backup options are available?","answer":"The application uses PostgreSQL as its production database, which supports standard backup mechanisms. Database backups can be taken using pg_dump for full or incremental backups. The Docker-based deployment allows for volume-level backups of the database data directory. For disaster recovery, regular automated backups should be configured at the server/infrastructure level by the system administrator."},{"question":"How is data protected against leakage?","answer":"Multiple layers of protection are in place: (1) All API endpoints require authentication and authorization checks. (2) Sensitive data like Aadhaar numbers are hashed (SHA-256) with only last 4 digits stored in cleartext. (3) Passwords use bcrypt with 12 salt rounds. (4) Session tokens are httpOnly cookies inaccessible to JavaScript. (5) Role-based access control with 36 granular permissions prevents unauthorized actions. (6) Business data isolation ensures cross-owner data cannot leak. (7) Rate limiting prevents brute-force enumeration attacks. (8) Agents are restricted to only their assigned villages. (9) Platform Admins require explicit owner-granted time-limited access to view any business data."},{"question":"What happens if someone tries to access data they are not authorized to view?","answer":"The system immediately returns a 403 Forbidden or Access Denied error. Unauthorized API requests are blocked before any data is retrieved. For unauthenticated requests, users are redirected to the login page or receive a 401 Unauthorized response. The scope-checking layer ensures that even valid logged-in users cannot access data outside their authorized scope."},{"question":"Is personal and financial data encrypted?","answer":"Sensitive personal data (Aadhaar numbers) is stored as irreversible SHA-256 hashes. Passwords use bcrypt hashing. Session tokens are cryptographically signed JWTs. The application is served over HTTPS (SSL/TLS) ensuring all data in transit is encrypted. For data at rest, encryption depends on the server/infrastructure configuration — PostgreSQL supports Transparent Data Encryption and disk-level encryption can be enabled at the OS level."},{"question":"How do I install this app on my Android phone?","answer":"Using Google Chrome:\\n1. Open Chrome browser and go to the Daily Finance website\\n2. Tap the three-dot menu (⋮) at the top-right corner\\n3. Tap \\"Add to Home screen\\" or \\"Install app\\"\\n4. Tap \\"Install\\" in the confirmation popup\\n5. The app icon will appear on your home screen — tap it to open\\n\\nUsing Samsung Internet Browser:\\n1. Open the Daily Finance website in Samsung Internet\\n2. Tap the menu (☰) at the bottom-right\\n3. Tap \\"Add page to\\" → \\"Home screen\\"\\n4. Tap \\"Add\\" to confirm\\n\\nThe app will open in full screen like a regular app — no browser address bar!"},{"question":"How do I install this app on my iPhone / iPad?","answer":"You must use Safari — Chrome and other browsers on iOS do not support this feature.\\n\\n1. Open Safari browser\\n2. Go to the Daily Finance website\\n3. Tap the Share button (⬆) at the bottom of the screen\\n4. Scroll down and tap \\"View More\\" if needed\\n5. Tap \\"Add to Home Screen\\"\\n6. Tap \\"Add\\" in the top-right corner\\n7. The app icon will appear on your home screen — tap it to open\\n\\nImportant: This only works in Safari. Chrome, Firefox, and other browsers on iOS do not support \\"Add to Home Screen\\" as an app."},{"question":"What are the benefits of installing Daily Finance as an app?","answer":"Installing Daily Finance as an app gives you:\\n\\n• Quick access — Open directly from your home screen, no need to type the website address\\n• Full screen — The app opens without the browser address bar, giving more screen space\\n• Faster loading — Common pages are cached for faster access on repeat visits\\n• Offline notice — If your internet is down, you'll see a friendly message instead of a browser error\\n• App-like feel — It appears in your recent apps list and can be switched like any other app\\n\\nNo app store download needed. No storage space used. It's a shortcut to the website that looks and feels like a native app."}]	2026-10-01 19:13:30.49	\N
\.


--
-- Data for Name: RegistrationRequest; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."RegistrationRequest" (id, "fullName", phone, email, username, "passwordHash", "businessName", city, villages, "collectionType", "defaultCollectionDay", status, "rejectionReason", "reviewedBy", "reviewedAt", "createdAt", "updatedAt") FROM stdin;
cmupmu32l0004j4ba06riuq81	Naveen Rama Krishna	6301864123	naveenmanduri5@gmail.com	naveenmanduri	$2a$12$cUaDE6NWbtIZPg3219osNunjHAZK.N7wHnp.NKavNlfygwXU/vKsC			[]	DAILY	\N	APPROVED	\N	cmupl0zx9000012723gsrabfo	2026-10-01 14:32:02.699	2026-10-01 14:31:29.788	2026-10-01 14:32:02.7
cmupmxnzw0009j4bai3rwhjrb	Akurathi Ganesh	8074724801	\N	jaganreddyfan	$2a$12$IXwZfQTnB5SjXiLRFKVakeJCsg68zrr1Qst9QNSKaV9bv.zo.GHM.			[]	DAILY	\N	APPROVED	\N	cmupl0zx9000012723gsrabfo	2026-10-01 14:37:50.881	2026-10-01 14:34:16.888	2026-10-01 14:37:50.882
cmupnb390000o14mhm0ynmlqe	Rammohan Reddy	9553947222	\N	9553947222	$2a$12$Cs.YeyQ8qZo1ZIq9jE/Pk.Td7ck5MBOwMnr2CMYsQf8gzGHBtTsLi			[]	DAILY	\N	APPROVED	\N	cmupl0zx9000012723gsrabfo	2026-10-01 14:45:01.812	2026-10-01 14:44:43.188	2026-10-01 14:45:01.813
cmupsx2gx003914fa7qboh44f	tadi Narse Reddy	7377344107	sdvnarse@gmail.com	narsereddy	$2a$12$K2GamEUqM0z50dOqYr1wbufAQhqX0r3Sh0Lk3vYmLutCoKTB76AFi			[]	DAILY	\N	APPROVED	\N	cmupl0zx9000012723gsrabfo	2026-10-01 17:21:59.507	2026-10-01 17:21:46.69	2026-10-01 17:21:59.509
cmuqdeoyz0007bmedrk6v9y5g	M Lakshmi 	9553355995	\N	9553355995	$2a$12$nsRv/Y/BuyvY8Kx/RpdT2ePgmbY01WRtxMR4VI/1ACGx8Sx4i5RKq			[]	DAILY	\N	APPROVED	\N	cmupl0zx9000012723gsrabfo	2026-10-02 02:55:47.163	2026-10-02 02:55:21.323	2026-10-02 02:55:47.164
cmuqj2m030006xp131ryjhofg	Tulasi Goluguri 	9550781222	tulasigoluguri1994@gmail.com	9550781222	$2a$12$Fwj2aMIPlAMV92YdZ83F5uLsriP4xyG0ZAi8gUuAkvugvZZa9wpIu			[]	DAILY	\N	APPROVED	\N	cmupl0zx9000012723gsrabfo	2026-10-02 05:34:08.823	2026-10-02 05:33:55.299	2026-10-02 05:34:08.824
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."Session" (id, "userId", token, "activeBusinessId", "expiresAt", "lastActivityAt", "createdAt") FROM stdin;
cmuqrbl7n0001h7bjz1idfyyr	cmupnbhma000q14mhhez8lbfs	79e566a6-d351-4fbb-9045-6a395bef879a	\N	2026-10-03 09:24:51.105	2026-10-02 09:54:33.735	2026-10-02 09:24:51.107
cmuqoek1v0003h51kv20lc8ev	cmupmusg30006j4bapl84qx9i	e0edf2df-cea9-4d9c-999d-a7e66fb89173	\N	2026-10-03 08:03:10.714	2026-10-02 08:11:47.581	2026-10-02 08:03:10.721
cmupsvxyy003814fa8j3okuxx	cmupl0zx9000012723gsrabfo	7e83705c-2db8-46fe-806e-bc9c784fa53f	\N	2026-10-02 17:20:54.182	2026-10-01 17:47:58.055	2026-10-01 17:20:54.198
cmuqc870y0001bmedkyhbzbtw	cmupnbhma000q14mhhez8lbfs	bda0b9d5-eab4-46bb-ae9e-c982615a021d	\N	2026-10-03 02:22:18.513	2026-10-02 03:17:04.919	2026-10-02 02:22:18.515
cmuqdg2qa000bbmedihsqzgii	cmuqdf8wq0009bmedb8ha18ex	fc063bd6-76a4-450e-838e-2cd128bea887	\N	2026-10-03 02:56:25.81	2026-10-02 03:17:40.992	2026-10-02 02:56:25.811
cmupszbyh003d14fai4c7sq7s	cmupsxccj003b14fasa6cv1en	7a50d5f5-a73e-4153-bd3a-210549268dec	\N	2026-10-02 17:23:32.203	2026-10-01 17:46:53.774	2026-10-01 17:23:32.297
cmuqj377r000axp13af4yj8re	cmuqj2wfp0008xp13up3iskra	02599033-ae15-4e02-b013-18aee9e4be8b	\N	2026-10-03 05:34:22.791	2026-10-02 05:34:22.792	2026-10-02 05:34:22.792
\.


--
-- Data for Name: SupportAccess; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."SupportAccess" (id, "ownerId", "adminId", "expiresAt", "revokedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."User" (id, username, "passwordHash", "fullName", phone, role, "isActive", "mustChangePassword", "createdAt", "updatedAt", email) FROM stdin;
cmupl0zx9000012723gsrabfo	platform_admin	$2a$12$SfgrUtjhDgTel96.C1dgveDWa2h/PDrSmXdGTJUaOZ.B7ZMjVVbQq	Platform Administrator	9999900000	PLATFORM_ADMIN	t	f	2026-10-01 13:40:53.086	2026-10-01 13:40:53.086	\N
cmupmusg30006j4bapl84qx9i	naveenmanduri	$2a$12$BqfMaUYYmtatyUKwShVlJ.iVsHKCAeGJOP27BuTLuBd9gJdEM2n4O	Naveen Rama Krishna	6301864123	OWNER	t	f	2026-10-01 14:32:02.692	2026-10-01 14:32:59.807	naveenmanduri5@gmail.com
cmupn291y000514mhmbk6y6gi	jaganreddyfan	$2a$12$jtA2wGWsbmVwZqAK92OZHOSRmIx5JOU.N9ClUfkFU3Irk696iE0lG	Akurathi Ganesh	8074724801	OWNER	t	f	2026-10-01 14:37:50.807	2026-10-01 14:38:30.236	\N
cmupnbhma000q14mhhez8lbfs	9553947222	$2a$12$9p3cXtg.qZ4zA.nyY.apvezwnjoRDIC2NTGWi2VG76Avqn16xPTdW	Rammohan Reddy	9553947222	OWNER	t	f	2026-10-01 14:45:01.811	2026-10-01 14:45:51.396	\N
cmupsxccj003b14fasa6cv1en	narsereddy	$2a$12$DtgnZ7gHhCcKuf9TPZeULu67AYVWCVl6E47O51NS96kbxEZjubUOi	tadi Narse Reddy	7377344107	OWNER	t	f	2026-10-01 17:21:59.491	2026-10-01 17:24:07	sdvnarse@gmail.com
cmupuaval000714fvmqiu5pz4	9556312233	$2a$12$bEczFmFGONsmkuNKfWv6leivOeC3QOzNV9jbC4k3X5oRBTew0EHLe	Mahesh	9556312233	AGENT	t	f	2026-10-01 18:00:30.189	2026-10-01 18:04:53.006	\N
cmuqdf8wq0009bmedb8ha18ex	9553355995	$2a$12$DIu1FHfyejB7/Defcq2SEe9If5s.VEaXE5oZPwqzfeQA87HhpsIgS	M Lakshmi 	9553355995	OWNER	t	f	2026-10-02 02:55:47.163	2026-10-02 02:57:07.213	\N
cmuqdt4s1000gbmed10v5wyw7	vijay_agent	$2a$12$ei8dYK1Acx2G0AOoj4lsz.v5MmNVqHhp3zYld8NzEtBGtZWSMDhZK	Vijay	6281738818	AGENT	t	t	2026-10-02 03:06:34.993	2026-10-02 03:06:34.993	\N
cmuqj2wfp0008xp13up3iskra	9550781222	$2a$12$Fwj2aMIPlAMV92YdZ83F5uLsriP4xyG0ZAi8gUuAkvugvZZa9wpIu	Tulasi Goluguri 	9550781222	OWNER	t	t	2026-10-02 05:34:08.822	2026-10-02 05:34:08.822	tulasigoluguri1994@gmail.com
cmuqogia10004h51kj848ck2d	krishnaagent	$2a$12$p//4ynf.oo.ozYxdXV0IzOSs2NmQMxdnx95uDcWP8eE1ArrGTZg6K	Krishna	9563209965	AGENT	t	t	2026-10-02 08:04:41.722	2026-10-02 08:04:41.722	\N
\.


--
-- Data for Name: UserBusinessAssignment; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."UserBusinessAssignment" (id, "userId", "businessId", "createdAt") FROM stdin;
cmupuavam000914fvwygcfz6z	cmupuaval000714fvmqiu5pz4	cmupndz1c000v14mharvge5lw	2026-10-01 18:00:30.189
cmuqdt4s1000ibmeds20guzl1	cmuqdt4s1000gbmed10v5wyw7	cmuqdn6ik000ebmed1brqfqur	2026-10-02 03:06:34.993
cmuqogibe0006h51kdsq3r0sz	cmuqogia10004h51kj848ck2d	cmupn1uor000214mh39aw2s8z	2026-10-02 08:04:41.722
\.


--
-- Data for Name: UserVillageAssignment; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."UserVillageAssignment" (id, "userId", "villageId", "createdAt") FROM stdin;
cmupuavam000b14fv2s71xec5	cmupuaval000714fvmqiu5pz4	cmupndz1g000w14mhpd3dnlnc	2026-10-01 18:00:30.189
cmuqdt4s1000kbmed6h18673v	cmuqdt4s1000gbmed10v5wyw7	cmuqdn6io000fbmedfkh14c8i	2026-10-02 03:06:34.993
\.


--
-- Data for Name: Village; Type: TABLE DATA; Schema: public; Owner: financeapp
--

COPY public."Village" (id, name, "businessId", "isActive", "createdAt", "updatedAt") FROM stdin;
cmupn1up2000314mhbruke15v	Hyderabd	cmupn1uor000214mh39aw2s8z	t	2026-10-01 14:37:32.198	2026-10-01 14:37:32.198
cmupndz1g000w14mhpd3dnlnc	Gajuwaka	cmupndz1c000v14mharvge5lw	t	2026-10-01 14:46:57.7	2026-10-01 14:46:57.7
cmuptsssz000314fveu1eo6yk	deobargh	cmuptsssr000214fvly5fdn3x	t	2026-10-01 17:46:27.156	2026-10-01 17:46:27.156
cmuptsssz000414fvq1cdnavc	purangarh	cmuptsssr000214fvly5fdn3x	t	2026-10-01 17:46:27.156	2026-10-01 17:46:27.156
cmuqdn6io000fbmedfkh14c8i	Parwada, kurmanapalem, Gajuwaka	cmuqdn6ik000ebmed1brqfqur	t	2026-10-02 03:01:57.313	2026-10-02 03:01:57.313
cmuqly10o00051489cvgjkdpp	PM Palem	cmupndz1c000v14mharvge5lw	t	2026-10-02 06:54:20.328	2026-10-02 06:54:20.328
\.


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: Business Business_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Business"
    ADD CONSTRAINT "Business_pkey" PRIMARY KEY (id);


--
-- Name: CashBookEntry CashBookEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."CashBookEntry"
    ADD CONSTRAINT "CashBookEntry_pkey" PRIMARY KEY (id);


--
-- Name: CashHandover CashHandover_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."CashHandover"
    ADD CONSTRAINT "CashHandover_pkey" PRIMARY KEY (id);


--
-- Name: Customer Customer_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_pkey" PRIMARY KEY (id);


--
-- Name: Document Document_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_pkey" PRIMARY KEY (id);


--
-- Name: ExpenseCategory ExpenseCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."ExpenseCategory"
    ADD CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY (id);


--
-- Name: Expense Expense_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_pkey" PRIMARY KEY (id);


--
-- Name: Holiday Holiday_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Holiday"
    ADD CONSTRAINT "Holiday_pkey" PRIMARY KEY (id);


--
-- Name: LoanScheduleEntry LoanScheduleEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."LoanScheduleEntry"
    ADD CONSTRAINT "LoanScheduleEntry_pkey" PRIMARY KEY (id);


--
-- Name: Loan Loan_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_pkey" PRIMARY KEY (id);


--
-- Name: PasswordResetRequest PasswordResetRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."PasswordResetRequest"
    ADD CONSTRAINT "PasswordResetRequest_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: PlatformSetting PlatformSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."PlatformSetting"
    ADD CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY (id);


--
-- Name: RegistrationRequest RegistrationRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."RegistrationRequest"
    ADD CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: SupportAccess SupportAccess_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."SupportAccess"
    ADD CONSTRAINT "SupportAccess_pkey" PRIMARY KEY (id);


--
-- Name: UserBusinessAssignment UserBusinessAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."UserBusinessAssignment"
    ADD CONSTRAINT "UserBusinessAssignment_pkey" PRIMARY KEY (id);


--
-- Name: UserVillageAssignment UserVillageAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."UserVillageAssignment"
    ADD CONSTRAINT "UserVillageAssignment_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Village Village_pkey; Type: CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Village"
    ADD CONSTRAINT "Village_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog_businessId_createdAt_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "AuditLog_businessId_createdAt_idx" ON public."AuditLog" USING btree ("businessId", "createdAt");


--
-- Name: AuditLog_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "AuditLog_entityType_entityId_idx" ON public."AuditLog" USING btree ("entityType", "entityId");


--
-- Name: Business_ownerId_name_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "Business_ownerId_name_key" ON public."Business" USING btree ("ownerId", name);


--
-- Name: CashBookEntry_businessId_date_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "CashBookEntry_businessId_date_key" ON public."CashBookEntry" USING btree ("businessId", date);


--
-- Name: CashHandover_agentId_date_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "CashHandover_agentId_date_idx" ON public."CashHandover" USING btree ("agentId", date);


--
-- Name: CashHandover_businessId_date_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "CashHandover_businessId_date_idx" ON public."CashHandover" USING btree ("businessId", date);


--
-- Name: Customer_businessId_createdAt_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Customer_businessId_createdAt_idx" ON public."Customer" USING btree ("businessId", "createdAt");


--
-- Name: Customer_businessId_customerId_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "Customer_businessId_customerId_key" ON public."Customer" USING btree ("businessId", "customerId");


--
-- Name: Customer_businessId_fullName_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Customer_businessId_fullName_idx" ON public."Customer" USING btree ("businessId", "fullName");


--
-- Name: Customer_businessId_phone_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Customer_businessId_phone_idx" ON public."Customer" USING btree ("businessId", phone);


--
-- Name: Customer_businessId_status_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Customer_businessId_status_idx" ON public."Customer" USING btree ("businessId", status);


--
-- Name: Customer_businessId_villageId_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Customer_businessId_villageId_idx" ON public."Customer" USING btree ("businessId", "villageId");


--
-- Name: Document_customerId_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Document_customerId_idx" ON public."Document" USING btree ("customerId");


--
-- Name: Document_loanId_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Document_loanId_idx" ON public."Document" USING btree ("loanId");


--
-- Name: ExpenseCategory_businessId_name_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "ExpenseCategory_businessId_name_key" ON public."ExpenseCategory" USING btree ("businessId", name);


--
-- Name: Expense_businessId_date_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Expense_businessId_date_idx" ON public."Expense" USING btree ("businessId", date);


--
-- Name: Holiday_businessId_date_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "Holiday_businessId_date_key" ON public."Holiday" USING btree ("businessId", date);


--
-- Name: LoanScheduleEntry_loanId_dueDate_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "LoanScheduleEntry_loanId_dueDate_key" ON public."LoanScheduleEntry" USING btree ("loanId", "dueDate");


--
-- Name: LoanScheduleEntry_loanId_installmentNumber_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "LoanScheduleEntry_loanId_installmentNumber_idx" ON public."LoanScheduleEntry" USING btree ("loanId", "installmentNumber");


--
-- Name: Loan_agentId_businessId_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Loan_agentId_businessId_idx" ON public."Loan" USING btree ("agentId", "businessId");


--
-- Name: Loan_businessId_loanNumber_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "Loan_businessId_loanNumber_key" ON public."Loan" USING btree ("businessId", "loanNumber");


--
-- Name: Loan_businessId_startDate_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Loan_businessId_startDate_idx" ON public."Loan" USING btree ("businessId", "startDate");


--
-- Name: Loan_businessId_status_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Loan_businessId_status_idx" ON public."Loan" USING btree ("businessId", status);


--
-- Name: Loan_customerId_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Loan_customerId_idx" ON public."Loan" USING btree ("customerId");


--
-- Name: Loan_renewedFromLoanId_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "Loan_renewedFromLoanId_key" ON public."Loan" USING btree ("renewedFromLoanId");


--
-- Name: PasswordResetRequest_status_createdAt_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "PasswordResetRequest_status_createdAt_idx" ON public."PasswordResetRequest" USING btree (status, "createdAt");


--
-- Name: PasswordResetRequest_userId_status_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "PasswordResetRequest_userId_status_idx" ON public."PasswordResetRequest" USING btree ("userId", status);


--
-- Name: Payment_businessId_paymentDate_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Payment_businessId_paymentDate_idx" ON public."Payment" USING btree ("businessId", "paymentDate");


--
-- Name: Payment_businessId_receiptNumber_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "Payment_businessId_receiptNumber_key" ON public."Payment" USING btree ("businessId", "receiptNumber");


--
-- Name: Payment_collectorId_paymentDate_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Payment_collectorId_paymentDate_idx" ON public."Payment" USING btree ("collectorId", "paymentDate");


--
-- Name: Payment_loanId_isDeleted_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Payment_loanId_isDeleted_idx" ON public."Payment" USING btree ("loanId", "isDeleted");


--
-- Name: Payment_loanId_paymentDate_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Payment_loanId_paymentDate_idx" ON public."Payment" USING btree ("loanId", "paymentDate");


--
-- Name: PlatformSetting_key_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "PlatformSetting_key_key" ON public."PlatformSetting" USING btree (key);


--
-- Name: RegistrationRequest_phone_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "RegistrationRequest_phone_idx" ON public."RegistrationRequest" USING btree (phone);


--
-- Name: RegistrationRequest_status_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "RegistrationRequest_status_idx" ON public."RegistrationRequest" USING btree (status);


--
-- Name: RegistrationRequest_username_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "RegistrationRequest_username_key" ON public."RegistrationRequest" USING btree (username);


--
-- Name: Session_token_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Session_token_idx" ON public."Session" USING btree (token);


--
-- Name: Session_token_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "Session_token_key" ON public."Session" USING btree (token);


--
-- Name: Session_userId_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "Session_userId_idx" ON public."Session" USING btree ("userId");


--
-- Name: SupportAccess_adminId_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "SupportAccess_adminId_idx" ON public."SupportAccess" USING btree ("adminId");


--
-- Name: SupportAccess_ownerId_idx; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE INDEX "SupportAccess_ownerId_idx" ON public."SupportAccess" USING btree ("ownerId");


--
-- Name: UserBusinessAssignment_userId_businessId_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "UserBusinessAssignment_userId_businessId_key" ON public."UserBusinessAssignment" USING btree ("userId", "businessId");


--
-- Name: UserVillageAssignment_userId_villageId_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "UserVillageAssignment_userId_villageId_key" ON public."UserVillageAssignment" USING btree ("userId", "villageId");


--
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- Name: Village_businessId_name_key; Type: INDEX; Schema: public; Owner: financeapp
--

CREATE UNIQUE INDEX "Village_businessId_name_key" ON public."Village" USING btree ("businessId", name);


--
-- Name: AuditLog AuditLog_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Business Business_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Business"
    ADD CONSTRAINT "Business_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CashBookEntry CashBookEntry_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."CashBookEntry"
    ADD CONSTRAINT "CashBookEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CashHandover CashHandover_agentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."CashHandover"
    ADD CONSTRAINT "CashHandover_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CashHandover CashHandover_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."CashHandover"
    ADD CONSTRAINT "CashHandover_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CashHandover CashHandover_receivedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."CashHandover"
    ADD CONSTRAINT "CashHandover_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Customer Customer_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Customer Customer_villageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES public."Village"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Document Document_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Document Document_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Document Document_loanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES public."Loan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ExpenseCategory ExpenseCategory_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."ExpenseCategory"
    ADD CONSTRAINT "ExpenseCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Expense Expense_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Expense Expense_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."ExpenseCategory"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Expense Expense_paidById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Holiday Holiday_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Holiday"
    ADD CONSTRAINT "Holiday_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LoanScheduleEntry LoanScheduleEntry_loanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."LoanScheduleEntry"
    ADD CONSTRAINT "LoanScheduleEntry_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES public."Loan"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Loan Loan_agentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Loan Loan_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Loan Loan_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Loan Loan_renewedFromLoanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Loan"
    ADD CONSTRAINT "Loan_renewedFromLoanId_fkey" FOREIGN KEY ("renewedFromLoanId") REFERENCES public."Loan"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PasswordResetRequest PasswordResetRequest_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."PasswordResetRequest"
    ADD CONSTRAINT "PasswordResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Payment Payment_collectorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Payment Payment_loanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES public."Loan"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupportAccess SupportAccess_adminId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."SupportAccess"
    ADD CONSTRAINT "SupportAccess_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SupportAccess SupportAccess_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."SupportAccess"
    ADD CONSTRAINT "SupportAccess_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UserBusinessAssignment UserBusinessAssignment_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."UserBusinessAssignment"
    ADD CONSTRAINT "UserBusinessAssignment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserBusinessAssignment UserBusinessAssignment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."UserBusinessAssignment"
    ADD CONSTRAINT "UserBusinessAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserVillageAssignment UserVillageAssignment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."UserVillageAssignment"
    ADD CONSTRAINT "UserVillageAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserVillageAssignment UserVillageAssignment_villageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."UserVillageAssignment"
    ADD CONSTRAINT "UserVillageAssignment_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES public."Village"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Village Village_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: financeapp
--

ALTER TABLE ONLY public."Village"
    ADD CONSTRAINT "Village_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public."Business"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict JjYtpaQVgpXPRQCxbRRdZKoTGdcOeEVAtvdoFmfkH2LflYuinnWDZctmlaR8Gsk

