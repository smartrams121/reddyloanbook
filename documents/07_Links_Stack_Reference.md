# Sections 19–23: Billing, Links, Credentials, References, Tech Stack

---

## 19. Billing/Charges/Prices

| Service | Plan | Cost | Notes |
|---------|------|------|-------|
| OCI Compute | Always Free Tier (VM.Standard.A1.Flex) | $0/month | ARM-based, 4 OCPU, 24GB RAM eligible (using 1 OCPU, 6GB) |
| OCI Block Storage | 50GB boot volume | $0/month | Included in free tier |
| OCI Networking | Public IP + VCN | $0/month | Included in free tier |
| GitHub | Free tier (private repo) | $0/month | Unlimited private repos |
| DuckDNS | Free dynamic DNS | $0/month | Subdomain for server |
| Domain (future) | Custom domain | ~$10/year | Optional, currently using DuckDNS |
| SSL Certificate | Let's Encrypt | $0 | Auto-renewal via certbot (planned) |
| Claude Code | Enterprise API | Per-token | Development tool, billed to practice |
| **Total Monthly** | | **~$0** | All infrastructure on free tiers |

---

## 20. Links of Applications

| Application | URL/Link | Purpose |
|-------------|----------|---------|
| Production App | http://80.225.201.199 (via Nginx) | Live application |
| OCI Console | https://cloud.oracle.com | Server management |
| GitHub Repository | https://github.com/smartrams121/reddyloanbook | Source code |
| DuckDNS | https://www.duckdns.org | Dynamic DNS management |
| Prisma Studio | `npx prisma studio` (local only) | Visual database browser |

---

## 21. Endpoint/Host/Username and Passwords

### 21.1 Server Access

| Property | Value |
|----------|-------|
| Server IP | 80.225.201.199 |
| SSH User | opc |
| SSH Key | ssh_Keys/ssh-key-2026-10-01.key |
| SSH Command | `ssh -i ssh_Keys/ssh-key-2026-10-01.key opc@80.225.201.199` |
| OS | Oracle Linux 9 (ARM) |
| App Directory | /opt/dailyfinance |

### 21.2 Database (Production)

| Property | Value |
|----------|-------|
| Host | localhost:5432 (inside Docker network: dailyfinance_postgres:5432) |
| Database | financeapp_db |
| Username | financeapp |
| Password | ******** |
| Connection | `postgresql://financeapp:********@localhost:5432/financeapp_db` |

### 21.3 Application

| Property | Value |
|----------|-------|
| App Port | 3000 (internal), 80 (Nginx) |
| JWT Secret | ******** (in .env) |
| Session Expiry | 24 hours |

### 21.4 Test Accounts (Local Development)

| Username | Password | Role | Description |
|----------|----------|------|-------------|
| platform_admin | ******** | Platform Admin | System administrator |
| owner1 | ******** | Owner | Sai Daily Finance + Sri Lakshmi Finance |
| owner2 | ******** | Owner | Ganesh Finance |
| business_admin | ******** | Business Admin | Sai Daily Finance |
| agent1 | ******** | Agent | PM Palem, Madhurawada |
| agent2 | ******** | Agent | Gajuwaka |
| agent3 | ******** | Agent | PM Palem + Ameerpet (2 businesses) |
| agent4 | ******** | Agent | Ganesh Finance |

### 21.5 GitHub

| Property | Value |
|----------|-------|
| Account | smartrams121 |
| Repository | reddyloanbook |
| Access | HTTPS with credentials |

---

## 22. Reference Documents/Links

### 22.1 Framework & Libraries

| Technology | Documentation |
|-----------|---------------|
| Next.js 14 | https://nextjs.org/docs |
| Next.js App Router | https://nextjs.org/docs/app |
| React 18 | https://react.dev |
| TypeScript | https://www.typescriptlang.org/docs |
| Tailwind CSS | https://tailwindcss.com/docs |
| Prisma ORM | https://www.prisma.io/docs |
| Zod | https://zod.dev |

### 22.2 Auth & Security

| Technology | Documentation |
|-----------|---------------|
| bcryptjs | https://www.npmjs.com/package/bcryptjs |
| jsonwebtoken | https://www.npmjs.com/package/jsonwebtoken |
| otplib (TOTP) | https://github.com/yeojz/otplib |

### 22.3 File Generation

| Technology | Documentation |
|-----------|---------------|
| ExcelJS | https://github.com/exceljs/exceljs |
| pdfkit | https://pdfkit.org |
| @react-pdf/renderer | https://react-pdf.org |

### 22.4 Infrastructure

| Technology | Documentation |
|-----------|---------------|
| Docker | https://docs.docker.com |
| Docker Compose | https://docs.docker.com/compose |
| PostgreSQL 16 | https://www.postgresql.org/docs/16 |
| Nginx | https://nginx.org/en/docs |
| OCI Compute | https://docs.oracle.com/en-us/iaas/Content/Compute |
| DuckDNS | https://www.duckdns.org/install.jsp |

### 22.5 Testing

| Technology | Documentation |
|-----------|---------------|
| Vitest | https://vitest.dev |

---

## 23. Detailed Technology Stack

### 23.1 Production Dependencies (`dependencies` in package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| next | 14.2.35 | Full-stack React framework (App Router, SSR, API routes) |
| react | 18.x | UI component library |
| react-dom | 18.x | React DOM rendering |
| @prisma/client | 5.22.0 | Database ORM client (auto-generated from schema) |
| bcryptjs | ~2.4 | Password hashing (12 salt rounds) |
| jsonwebtoken | ~9.0 | JWT token generation and verification |
| zod | ~3.22 | Runtime schema validation for API inputs |
| exceljs | 4.4.0 | XLSX file generation for reports and exports |
| pdfkit | 0.20.2 | Server-side PDF generation |
| @react-pdf/renderer | 3.4.5 | React-based PDF rendering (alternative) |
| otplib | ~12.0 | TOTP 2FA token generation/verification |
| qrcode | ~1.5 | QR code generation for 2FA setup |

### 23.2 Development Dependencies (`devDependencies`)

| Package | Version | Purpose |
|---------|---------|---------|
| prisma | 5.22.0 | Prisma CLI (schema management, migrations, generate) |
| typescript | 5.x | TypeScript compiler |
| @types/react | 18.x | TypeScript types for React |
| @types/node | 20.x | TypeScript types for Node.js |
| @types/bcryptjs | ~2.4 | TypeScript types for bcryptjs |
| @types/jsonwebtoken | ~9.0 | TypeScript types for JWT |
| tailwindcss | 3.x | Utility-first CSS framework |
| postcss | 8.x | CSS processing (required by Tailwind) |
| autoprefixer | 10.x | CSS vendor prefixes |
| vitest | ~1.0 | Test runner |
| tsx | ~4.0 | TypeScript execution (for seed scripts) |
| eslint | 8.x | Code linting |
| eslint-config-next | 14.x | Next.js ESLint rules |

### 23.3 Infrastructure Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Server OS | Oracle Linux | 9 | ARM-compatible enterprise Linux |
| Container Runtime | Docker | Latest | Application containerization |
| Container Orchestration | Docker Compose | v2 | Multi-container management |
| Database (Dev) | SQLite | Embedded | Zero-config local development |
| Database (Prod) | PostgreSQL | 16 Alpine | Production relational database |
| Reverse Proxy | Nginx | Latest | HTTP proxy, static caching, future SSL |
| DNS | DuckDNS | - | Free dynamic DNS |
| Cloud | OCI | Always Free | Compute, storage, networking |
| Version Control | Git + GitHub | - | Source code management |
| AI Development | Claude Code | Opus 4.6 | AI-assisted development |

### 23.4 Development Tools

| Tool | Purpose |
|------|---------|
| VS Code | Primary IDE |
| Claude Code Extension | AI pair programming |
| Prisma Studio | Visual database browser |
| Chrome DevTools | Frontend debugging |
| Docker Desktop | Local container management |

---

**Document End**

**Version:** 2.0 | **Date:** 03/10/2026 | **Confidential — Daily Finance**
