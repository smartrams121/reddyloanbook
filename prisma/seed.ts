import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const PASSWORD_HASH = bcrypt.hashSync('system', 12)

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function main() {
  console.log('Seeding database...')

  // Clean existing data
  await prisma.auditLog.deleteMany()
  await prisma.cashHandover.deleteMany()
  await prisma.cashBookEntry.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.expenseCategory.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.loanScheduleEntry.deleteMany()
  await prisma.loan.deleteMany()
  await prisma.document.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.holiday.deleteMany()
  await prisma.userVillageAssignment.deleteMany()
  await prisma.userBusinessAssignment.deleteMany()
  await prisma.village.deleteMany()
  await prisma.session.deleteMany()
  await prisma.supportAccess.deleteMany()
  await prisma.business.deleteMany()
  await prisma.user.deleteMany()

  // ── USERS ──────────────────────────────────────────────────────────────
  const platformAdmin = await prisma.user.create({
    data: {
      username: 'platform_admin',
      passwordHash: PASSWORD_HASH,
      fullName: 'Platform Administrator',
      phone: '9999900000',
      role: 'PLATFORM_ADMIN',
      mustChangePassword: false,
    },
  })

  const owner1 = await prisma.user.create({
    data: {
      username: 'owner1',
      passwordHash: PASSWORD_HASH,
      fullName: 'Rajesh Kumar',
      phone: '9553940001',
      role: 'OWNER',
      mustChangePassword: false,
    },
  })

  const owner2 = await prisma.user.create({
    data: {
      username: 'owner2',
      passwordHash: PASSWORD_HASH,
      fullName: 'Suresh Reddy',
      phone: '9553940002',
      role: 'OWNER',
      mustChangePassword: false,
    },
  })

  // ── BUSINESSES ─────────────────────────────────────────────────────────
  const saiFinance = await prisma.business.create({
    data: {
      name: 'Sai Daily Finance',
      city: 'Visakhapatnam',
      address: 'PM Palem Main Road, Visakhapatnam',
      phone: '9553940010',
      receiptPrefix: 'SDF',
      ownerId: owner1.id,
      collectionType: 'DAILY',
      interestModel: 'ADDON',
      collectionDays: 'MON,TUE,WED,THU,FRI,SAT',
      gracePeriodDaily: 30,
      autoLogoutMinutes: 30,
    },
  })

  const hydFinance = await prisma.business.create({
    data: {
      name: 'Sri Lakshmi Finance',
      city: 'Hyderabad',
      address: 'Ameerpet, Hyderabad',
      phone: '9553940011',
      receiptPrefix: 'SLF',
      ownerId: owner1.id,
      collectionType: 'WEEKLY',
      defaultCollectionDay: 'SATURDAY',
      interestModel: 'ADDON',
      collectionDays: 'MON,TUE,WED,THU,FRI,SAT',
      gracePeriodWeekly: 4,
      autoLogoutMinutes: 30,
    },
  })

  const owner2Biz = await prisma.business.create({
    data: {
      name: 'Ganesh Finance',
      city: 'Vijayawada',
      address: 'MG Road, Vijayawada',
      phone: '9553940020',
      receiptPrefix: 'GNF',
      ownerId: owner2.id,
      collectionType: 'DAILY',
      interestModel: 'ADDON',
      collectionDays: 'MON,TUE,WED,THU,FRI,SAT',
      gracePeriodDaily: 30,
      autoLogoutMinutes: 30,
    },
  })

  // ── STAFF USERS ────────────────────────────────────────────────────────
  const adminSai = await prisma.user.create({
    data: {
      username: 'business_admin',
      passwordHash: PASSWORD_HASH,
      fullName: 'Venkat Rao',
      phone: '9553940100',
      role: 'BUSINESS_ADMIN',
      mustChangePassword: false,
    },
  })

  const agent1 = await prisma.user.create({
    data: {
      username: 'agent1',
      passwordHash: PASSWORD_HASH,
      fullName: 'Ravi Kumar',
      phone: '9553940101',
      role: 'AGENT',
      mustChangePassword: false,
    },
  })

  const agent2 = await prisma.user.create({
    data: {
      username: 'agent2',
      passwordHash: PASSWORD_HASH,
      fullName: 'Srinivas Reddy',
      phone: '9553940102',
      role: 'AGENT',
      mustChangePassword: false,
    },
  })

  const agent3 = await prisma.user.create({
    data: {
      username: 'agent3',
      passwordHash: PASSWORD_HASH,
      fullName: 'Krishna Murthy',
      phone: '9553940103',
      role: 'AGENT',
      mustChangePassword: false,
    },
  })

  const agentO2 = await prisma.user.create({
    data: {
      username: 'agent4',
      passwordHash: PASSWORD_HASH,
      fullName: 'Ramesh Babu',
      phone: '9553940200',
      role: 'AGENT',
      mustChangePassword: false,
    },
  })

  // ── BUSINESS ASSIGNMENTS ───────────────────────────────────────────────
  await prisma.userBusinessAssignment.createMany({
    data: [
      { userId: adminSai.id, businessId: saiFinance.id },
      { userId: agent1.id, businessId: saiFinance.id },
      { userId: agent2.id, businessId: saiFinance.id },
      { userId: agent3.id, businessId: saiFinance.id },
      { userId: agent3.id, businessId: hydFinance.id },
      { userId: agentO2.id, businessId: owner2Biz.id },
    ],
  })

  // ── VILLAGES ───────────────────────────────────────────────────────────
  const vizagVillages = await Promise.all(
    ['PM Palem', 'Madhurawada', 'Gajuwaka'].map((name) =>
      prisma.village.create({ data: { name, businessId: saiFinance.id } })
    )
  )

  const hydVillages = await Promise.all(
    ['Ameerpet', 'Kukatpally', 'Dilsukhnagar'].map((name) =>
      prisma.village.create({ data: { name, businessId: hydFinance.id } })
    )
  )

  const vijVillages = await Promise.all(
    ['Benz Circle', 'Governorpet', 'Labbipet'].map((name) =>
      prisma.village.create({ data: { name, businessId: owner2Biz.id } })
    )
  )

  // ── VILLAGE ASSIGNMENTS ────────────────────────────────────────────────
  await prisma.userVillageAssignment.createMany({
    data: [
      { userId: agent1.id, villageId: vizagVillages[0].id },
      { userId: agent1.id, villageId: vizagVillages[1].id },
      { userId: agent2.id, villageId: vizagVillages[2].id },
      { userId: agent3.id, villageId: vizagVillages[0].id },
      { userId: agent3.id, villageId: hydVillages[0].id },
      { userId: agentO2.id, villageId: vijVillages[0].id },
      { userId: agentO2.id, villageId: vijVillages[1].id },
    ],
  })

  // ── EXPENSE CATEGORIES ─────────────────────────────────────────────────
  for (const biz of [saiFinance, hydFinance, owner2Biz]) {
    await prisma.expenseCategory.createMany({
      data: ['Petrol', 'Salary', 'Rent', 'Office Supplies', 'Other'].map((name) => ({
        name,
        businessId: biz.id,
      })),
    })
  }

  // ── CUSTOMERS + LOANS + PAYMENTS (Sai Daily Finance) ───────────────────
  const vizagNames = [
    { name: 'Shankar Reddy', age: 34, phone: '9553947222', village: 0, address: 'Flat 401, Sai Sampath Enclave, Bakkannapalem, PM Palem, Visakhapatnam' },
    { name: 'Lakshmi Devi', age: 28, phone: '9553947223', village: 0 },
    { name: 'Rambabu Naidu', age: 45, phone: '9553947224', village: 0 },
    { name: 'Siva Prasad', age: 30, phone: '9553947225', village: 0 },
    { name: 'Durga Rao', age: 38, phone: '9553947226', village: 0 },
    { name: 'Padma Kumari', age: 32, phone: '9553947227', village: 1 },
    { name: 'Venu Gopal', age: 50, phone: '9553947228', village: 1 },
    { name: 'Sarada Devi', age: 42, phone: '9553947229', village: 1 },
    { name: 'Narasimha Rao', age: 55, phone: '9553947230', village: 1 },
    { name: 'Bhavani Shankar', age: 29, phone: '9553947231', village: 1 },
    { name: 'Gopi Krishna', age: 36, phone: '9553947232', village: 2 },
    { name: 'Manga Devi', age: 40, phone: '9553947233', village: 2 },
    { name: 'Raju Yadav', age: 33, phone: '9553947234', village: 2 },
    { name: 'Sunitha Reddy', age: 27, phone: '9553947235', village: 2 },
    { name: 'Apparao Naidu', age: 48, phone: '9553947236', village: 2 },
  ]

  let sdfCustomerSeq = 0
  let sdfLoanSeq = 0
  let sdfReceiptSeq = 0

  for (const cust of vizagNames) {
    sdfCustomerSeq++
    const customer = await prisma.customer.create({
      data: {
        customerId: `SDF-C${String(sdfCustomerSeq).padStart(4, '0')}`,
        fullName: cust.name,
        age: cust.age,
        phone: cust.phone,
        address: cust.address || `${vizagVillages[cust.village].name}, Visakhapatnam`,
        villageId: vizagVillages[cust.village].id,
        businessId: saiFinance.id,
        status: 'ACTIVE',
      },
    })

    // Create an active daily loan for each customer
    sdfLoanSeq++
    const loanAmount = (Math.floor(Math.random() * 4) + 1) * 500000 // 5k-20k in paise
    const interestPct = 20
    const interestAmount = Math.round(loanAmount * interestPct / 100)
    const totalRepayable = loanAmount + interestAmount
    const installmentAmount = 10000 // ₹100 per day
    const numberOfInstallments = Math.ceil(totalRepayable / installmentAmount)
    const lastInstallment = totalRepayable - (installmentAmount * (numberOfInstallments - 1))
    const startDaysAgo = Math.floor(Math.random() * 60) + 10
    const startDate = daysAgo(startDaysAgo)

    // Generate schedule
    const schedule: { installmentNumber: number; dueDate: string; amount: number }[] = []
    let currentDate = new Date(startDate)
    let instNum = 0
    while (instNum < numberOfInstallments) {
      if (currentDate.getDay() !== 0) { // Skip Sundays
        instNum++
        schedule.push({
          installmentNumber: instNum,
          dueDate: formatDate(currentDate),
          amount: instNum === numberOfInstallments ? lastInstallment : installmentAmount,
        })
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    const expectedEndDate = schedule[schedule.length - 1]?.dueDate || startDate

    const loan = await prisma.loan.create({
      data: {
        loanNumber: `SDF-L${String(sdfLoanSeq).padStart(5, '0')}`,
        customerId: customer.id,
        businessId: saiFinance.id,
        loanAmount,
        interestAmount,
        totalRepayable,
        amountGiven: loanAmount,
        collectionType: 'DAILY',
        installmentAmount,
        numberOfInstallments,
        lastInstallmentAmount: lastInstallment,
        startDate,
        expectedEndDate,
        agentId: cust.village === 2 ? agent2.id : agent1.id,
        status: 'ACTIVE',
      },
    })

    // Create schedule entries
    await prisma.loanScheduleEntry.createMany({
      data: schedule.map((s) => ({
        loanId: loan.id,
        installmentNumber: s.installmentNumber,
        dueDate: s.dueDate,
        amount: s.amount,
      })),
    })

    // Create payments for ~80% of past due dates
    const today = new Date().toISOString().slice(0, 10)
    const pastDueDates = schedule.filter((s) => s.dueDate <= today)
    const paymentCount = Math.floor(pastDueDates.length * 0.8)

    for (let i = 0; i < paymentCount; i++) {
      sdfReceiptSeq++
      await prisma.payment.create({
        data: {
          receiptNumber: `SDF-${String(sdfReceiptSeq).padStart(5, '0')}`,
          loanId: loan.id,
          businessId: saiFinance.id,
          amount: pastDueDates[i].amount,
          paymentDate: pastDueDates[i].dueDate,
          collectorId: cust.village === 2 ? agent2.id : agent1.id,
        },
      })
    }
  }

  // Update sequences
  await prisma.business.update({
    where: { id: saiFinance.id },
    data: { customerSeq: sdfCustomerSeq, loanSeq: sdfLoanSeq, receiptSeq: sdfReceiptSeq },
  })

  // ── CUSTOMERS for Hyderabad business (weekly) ──────────────────────────
  const hydNames = [
    { name: 'Shyam Sundar', phone: '9553957001', village: 0 },
    { name: 'Priya Reddy', phone: '9553957002', village: 0 },
    { name: 'Mohan Krishna', phone: '9553957003', village: 1 },
    { name: 'Anitha Devi', phone: '9553957004', village: 1 },
    { name: 'Kiran Kumar', phone: '9553957005', village: 2 },
  ]

  let slfCustomerSeq = 0
  let slfLoanSeq = 0
  let slfReceiptSeq = 0

  for (const cust of hydNames) {
    slfCustomerSeq++
    const customer = await prisma.customer.create({
      data: {
        customerId: `SLF-C${String(slfCustomerSeq).padStart(4, '0')}`,
        fullName: cust.name,
        phone: cust.phone,
        address: `${hydVillages[cust.village].name}, Hyderabad`,
        villageId: hydVillages[cust.village].id,
        businessId: hydFinance.id,
        status: 'ACTIVE',
      },
    })

    slfLoanSeq++
    const loanAmount = 2000000 // ₹20,000
    const interestAmount = 400000 // ₹4,000
    const totalRepayable = loanAmount + interestAmount
    const installmentAmount = 150000 // ₹1,500 weekly
    const numberOfInstallments = 16
    const lastInstallment = totalRepayable - (installmentAmount * 15)

    // Find next Saturday from 8 weeks ago
    const start = new Date()
    start.setDate(start.getDate() - 56)
    while (start.getDay() !== 6) start.setDate(start.getDate() + 1)
    const startDate = formatDate(start)

    const schedule: { installmentNumber: number; dueDate: string; amount: number }[] = []
    const scheduleDate = new Date(start)
    for (let i = 1; i <= numberOfInstallments; i++) {
      schedule.push({
        installmentNumber: i,
        dueDate: formatDate(scheduleDate),
        amount: i === numberOfInstallments ? lastInstallment : installmentAmount,
      })
      scheduleDate.setDate(scheduleDate.getDate() + 7)
    }

    const expectedEndDate = schedule[schedule.length - 1].dueDate

    const loan = await prisma.loan.create({
      data: {
        loanNumber: `SLF-L${String(slfLoanSeq).padStart(5, '0')}`,
        customerId: customer.id,
        businessId: hydFinance.id,
        loanAmount,
        interestAmount,
        totalRepayable,
        amountGiven: loanAmount,
        collectionType: 'WEEKLY',
        collectionDay: 'SATURDAY',
        installmentAmount,
        numberOfInstallments,
        lastInstallmentAmount: lastInstallment,
        startDate,
        expectedEndDate,
        agentId: agent3.id,
        status: 'ACTIVE',
      },
    })

    await prisma.loanScheduleEntry.createMany({
      data: schedule.map((s) => ({
        loanId: loan.id,
        installmentNumber: s.installmentNumber,
        dueDate: s.dueDate,
        amount: s.amount,
      })),
    })

    const today = new Date().toISOString().slice(0, 10)
    const pastDue = schedule.filter((s) => s.dueDate <= today)
    for (let i = 0; i < Math.floor(pastDue.length * 0.75); i++) {
      slfReceiptSeq++
      await prisma.payment.create({
        data: {
          receiptNumber: `SLF-${String(slfReceiptSeq).padStart(5, '0')}`,
          loanId: loan.id,
          businessId: hydFinance.id,
          amount: pastDue[i].amount,
          paymentDate: pastDue[i].dueDate,
          collectorId: agent3.id,
        },
      })
    }
  }

  await prisma.business.update({
    where: { id: hydFinance.id },
    data: { customerSeq: slfCustomerSeq, loanSeq: slfLoanSeq, receiptSeq: slfReceiptSeq },
  })

  // ── CUSTOMERS for Owner2 business ──────────────────────────────────────
  const vijNames = [
    { name: 'Venkatesh Prasad', phone: '9553967001', village: 0 },
    { name: 'Saroja Devi', phone: '9553967002', village: 0 },
    { name: 'Nagarjuna Rao', phone: '9553967003', village: 1 },
    { name: 'Kalyani Reddy', phone: '9553967004', village: 1 },
    { name: 'Satish Kumar', phone: '9553967005', village: 2 },
  ]

  let gnfCustomerSeq = 0
  let gnfLoanSeq = 0
  let gnfReceiptSeq = 0

  for (const cust of vijNames) {
    gnfCustomerSeq++
    const customer = await prisma.customer.create({
      data: {
        customerId: `GNF-C${String(gnfCustomerSeq).padStart(4, '0')}`,
        fullName: cust.name,
        phone: cust.phone,
        address: `${vijVillages[cust.village].name}, Vijayawada`,
        villageId: vijVillages[cust.village].id,
        businessId: owner2Biz.id,
        status: 'ACTIVE',
      },
    })

    gnfLoanSeq++
    const loanAmount = 1000000
    const interestAmount = 200000
    const totalRepayable = loanAmount + interestAmount
    const installmentAmount = 10000
    const numberOfInstallments = 120
    const lastInstallment = totalRepayable - (installmentAmount * 119)
    const startDate = daysAgo(40)

    const schedule: { installmentNumber: number; dueDate: string; amount: number }[] = []
    let curDate = new Date(startDate)
    let num = 0
    while (num < numberOfInstallments) {
      if (curDate.getDay() !== 0) {
        num++
        schedule.push({
          installmentNumber: num,
          dueDate: formatDate(curDate),
          amount: num === numberOfInstallments ? lastInstallment : installmentAmount,
        })
      }
      curDate.setDate(curDate.getDate() + 1)
    }

    const loan = await prisma.loan.create({
      data: {
        loanNumber: `GNF-L${String(gnfLoanSeq).padStart(5, '0')}`,
        customerId: customer.id,
        businessId: owner2Biz.id,
        loanAmount,
        interestAmount,
        totalRepayable,
        amountGiven: loanAmount,
        collectionType: 'DAILY',
        installmentAmount,
        numberOfInstallments,
        lastInstallmentAmount: lastInstallment,
        startDate,
        expectedEndDate: schedule[schedule.length - 1]?.dueDate || startDate,
        agentId: agentO2.id,
        status: 'ACTIVE',
      },
    })

    await prisma.loanScheduleEntry.createMany({
      data: schedule.map((s) => ({
        loanId: loan.id,
        installmentNumber: s.installmentNumber,
        dueDate: s.dueDate,
        amount: s.amount,
      })),
    })

    const today = new Date().toISOString().slice(0, 10)
    const pastDue = schedule.filter((s) => s.dueDate <= today)
    for (let i = 0; i < Math.floor(pastDue.length * 0.85); i++) {
      gnfReceiptSeq++
      await prisma.payment.create({
        data: {
          receiptNumber: `GNF-${String(gnfReceiptSeq).padStart(5, '0')}`,
          loanId: loan.id,
          businessId: owner2Biz.id,
          amount: pastDue[i].amount,
          paymentDate: pastDue[i].dueDate,
          collectorId: agentO2.id,
        },
      })
    }
  }

  await prisma.business.update({
    where: { id: owner2Biz.id },
    data: { customerSeq: gnfCustomerSeq, loanSeq: gnfLoanSeq, receiptSeq: gnfReceiptSeq },
  })

  // ── PLATFORM SETTINGS ─────────────────────────────────────────────────
  await prisma.platformSetting.upsert({
    where: { key: 'contact_us' },
    update: { value: JSON.stringify({ phone: '9553947222', emails: ['smartrams121@gmail.com', 'itibablu@gmail.com'] }) },
    create: { key: 'contact_us', value: JSON.stringify({ phone: '9553947222', emails: ['smartrams121@gmail.com', 'itibablu@gmail.com'] }) },
  })

  const faqData = [
    { question: 'How do I register as a new owner?', answer: 'Go to the Register page and fill in your full name, phone number (10-digit Indian mobile starting with 6-9), username (4-20 characters using letters, numbers, dots, or underscores), password, business name, city, and at least one location/village. Your request will be submitted for review by the Platform Admin.' },
    { question: 'What are the password requirements for self-registration?', answer: 'Your password must be at least 8 characters long, contain at least one uppercase letter, one number, and one special character.' },
    { question: 'How long does registration approval take?', answer: "The Platform Admin reviews and approves or rejects registration requests. You will see a status message when you try to log in — either 'pending approval' or 'not approved'. Contact the platform admin if your request is delayed." },
    { question: 'Can I use the same phone number for multiple registrations?', answer: "The system flags duplicate phone numbers for the admin's review, but it does not block registration. The Platform Admin makes the final decision on approval." },
    { question: 'What happens if my chosen username is already taken?', answer: "You'll be notified immediately while typing. Choose a different username — only letters, numbers, dots, and underscores are allowed (4-20 characters)." },
    { question: 'What happens after too many failed login attempts?', answer: 'After 5 consecutive failed login attempts, your account is temporarily locked for 15 minutes. Wait for the lockout period to expire and try again with the correct password.' },
    { question: 'How long does my login session last?', answer: 'Sessions last up to 24 hours by default (configurable by the admin). Additionally, you are automatically logged out after 30 minutes of inactivity. The inactivity timeout can be configured per business (5 to 480 minutes).' },
    { question: 'Why am I asked to change my password on first login?', answer: 'If your account was created by a Platform Admin or Business Owner (not self-registered), you must change the temporary password on first login for security. Self-registered users who chose their own password during registration are not required to do this.' },
    { question: 'What is Two-Factor Authentication (2FA)?', answer: 'Platform Admins and Owners are prompted to set up TOTP-based two-factor authentication (using apps like Google Authenticator) after their first password change. This adds an extra layer of security to your account. You will receive 8 recovery codes in case you lose access to your authenticator app.' },
    { question: 'What user roles exist and what can each role do?', answer: 'There are 4 roles: (1) Platform Admin — manages owners, registration requests, and platform-wide settings. (2) Owner — full control over their businesses, users, customers, loans, payments, reports, and expenses. (3) Business Admin — similar to Owner but cannot create/deactivate businesses or grant support access. (4) Agent — limited to creating customers, posting payments, bulk posting, and viewing their own collection report in assigned villages only.' },
    { question: 'Can an Agent see all customers and reports?', answer: 'No. Agents can only see customers and data in the specific villages they are assigned to. They can only view their own collection report, not reports from other agents or the full business.' },
    { question: 'How does the platform prevent unauthorized access?', answer: 'All pages require authentication via a secure httpOnly cookie that cannot be accessed by JavaScript. Unauthenticated API requests receive a 401 error, and unauthenticated page requests are redirected to the login page. Every API endpoint verifies the user\'s role and specific permissions before processing any action.' },
    { question: 'What is role-based access control (RBAC)?', answer: 'The system defines 36 distinct permission actions. Each user role is assigned a specific set of permissions. Before any action (creating a loan, posting a payment, viewing a report), the system checks that the logged-in user has the required permission. Unauthorized actions are blocked with a 403 Forbidden error.' },
    { question: 'What is Support Access?', answer: 'An Owner can grant time-limited access to the Platform Admin to view their business data for troubleshooting purposes. This access expires automatically after the set duration and can be revoked by the Owner at any time.' },
    { question: 'Are API rate limits in place?', answer: 'Yes. Registration is limited to 3 attempts per IP address per hour. Username availability checks are limited to 20 per IP per minute. Login is limited to 5 attempts per username before a 15-minute lockout. These limits protect against brute-force attacks and abuse.' },
    { question: 'How is the Aadhaar number stored and protected?', answer: 'Aadhaar numbers are never stored in plain text. The system stores a one-way SHA-256 hash of the full Aadhaar number (which cannot be reversed) and only keeps the last 4 digits in cleartext for display purposes (shown as XXXX XXXX 1234). This ensures that even if the database is compromised, full Aadhaar numbers cannot be recovered.' },
    { question: 'How are passwords secured?', answer: 'All passwords are hashed using bcrypt with 12 salt rounds — an industry-standard, irreversible hashing algorithm. The original password is never stored. Session tokens are signed JWTs stored in httpOnly cookies that cannot be accessed by client-side JavaScript, preventing XSS-based token theft.' },
    { question: 'Who can view customer personal information?', answer: "Only users with 'view_customer' permission can view customer details — this includes Owners, Business Admins, and Agents. Agents are further restricted to customers in their assigned villages only. Platform Admins cannot see customer data unless the Owner grants them time-limited Support Access." },
    { question: 'Can I delete customer data?', answer: "Yes. Owners and Business Admins with the 'delete_customer' permission can delete customer records. This is a permanent action." },
    { question: 'What fields are required to add a customer?', answer: 'Full name (minimum 2 characters), phone number (10-digit Indian mobile starting with 6, 7, 8, or 9), and location/village are required. Optional fields include age (18-100), alternate phone, address, Aadhaar number (12 digits), job type, guarantor name and phone, notes, and photo.' },
    { question: 'Can I have duplicate phone numbers for customers?', answer: 'Yes, the system does not enforce phone uniqueness at the customer level within a business. Multiple customers can share the same phone number.' },
    { question: 'How does customer rating work?', answer: "Customers are automatically rated on a 1-4 scale based on loan repayment history: Excellent (4) for on-time completion, Good (3) for minor delays within the good threshold, Average (2) for moderate delays, and Bad (1) for significant delays. Written-off loans always result in a Bad (1) rating. The customer's overall rating is the average of all their loan ratings." },
    { question: 'What collection types are supported?', answer: "Three types: (1) Daily — installments collected every working day (Sundays are skipped unless 'Collect on Sundays' is enabled; holidays are also skipped). (2) Weekly — installments collected on a specific day of the week. (3) Monthly — installments collected on the same date each month (handles month-end overflow, e.g., 31st in February rolls to the last day)." },
    { question: 'What is the difference between ADDON and UPFRONT interest?', answer: 'ADDON: The customer receives the full loan principal; interest is added on top. Total repayable = principal + interest. UPFRONT: Interest is deducted from the principal before disbursement; the customer receives less. Amount given = principal - interest. Total repayable remains principal + interest.' },
    { question: 'How is the installment schedule generated?', answer: 'The system automatically generates a payment schedule based on the collection type, start date, and number of installments. For Daily loans, Sundays (unless enabled) and holidays are skipped. For Weekly loans, installments fall on the specified day. For Monthly loans, they fall on the same date. The last installment is adjusted for any rounding difference.' },
    { question: 'What are the loan statuses?', answer: 'Active — loan is within its expected collection period. Overdue — past the expected end date (up to 1 year). Defaulter — more than 1 year past the expected end date. Completed — fully paid (total paid equals total repayable).' },
    { question: 'Can I renew a loan?', answer: 'Yes. When creating a new loan, you can link it to an existing active loan for renewal. The old loan is automatically marked as Completed, and the outstanding balance can be carried forward into the new loan calculation.' },
    { question: 'What validation applies to the last installment?', answer: 'The last installment must be a positive amount and cannot exceed 2x the regular installment amount. This validation prevents unreasonable balloon payments at the end of the loan.' },
    { question: 'Can I post a payment for a future date?', answer: 'No. Payment dates cannot be in the future. Payments must be for today or a past date.' },
    { question: 'How far back can I backdate a payment?', answer: "Payments can be backdated up to 1 month (30 days). The payment date also cannot be before the loan's start date." },
    { question: 'Can I overpay on a loan?', answer: 'No. The payment amount cannot exceed the outstanding balance on the loan. When the total paid equals the total repayable amount, the loan is automatically marked as Completed.' },
    { question: 'How does bulk payment posting work?', answer: 'Select a village and payment date, then enter payment amounts for multiple active loans at once. Maximum 200 entries per bulk request. Duplicate loan entries in the same batch are not allowed. All payments in a batch are processed atomically — either all succeed or none are saved.' },
    { question: 'Can Agents edit payments?', answer: 'Agents can only edit their own payments made on the same day. Owners and Business Admins can edit any payment, including payments made by others and on previous dates.' },
    { question: 'What report types are available?', answer: 'Six report types: Customers (list with status and details), Loans (with principal, interest, outstanding, and status filtering), Villages (location-wise summary with drill-down), Employees (staff activity and collection summary), Payments (transaction history with receipt details), and Collection Payslips (active loan collection slips). All reports require a date range.' },
    { question: 'What export formats are supported?', answer: 'Reports can be exported as Excel (XLSX) files with styled headers and formatting, or shared as PDF documents via WhatsApp.' },
    { question: 'Can Agents view all reports?', answer: 'No. Agents can only view their own collection report showing payments they have collected. Owners and Business Admins can view all report types for their businesses.' },
    { question: 'What settings can I configure for my business?', answer: 'Business name, city, receipt prefix (up to 5 uppercase letters), collection type, default collection day, interest model (ADDON/UPFRONT), Sunday collection toggle, grace periods for each collection type, customer rating thresholds, WhatsApp message template, and auto-logout timeout (5 to 480 minutes).' },
    { question: 'Can I add locations/villages after initial setup?', answer: 'Yes. Owners and Business Admins can add new villages at any time. Village names must be unique within the business and between 2-100 characters. Agents can only see villages they are assigned to.' },
    { question: 'What currency and units does the app use?', answer: 'All monetary amounts are stored internally in paise (1/100 of Indian Rupee) for precision. Amounts are displayed in Rupees (₹) in the user interface.' },
    { question: 'What timezone does the app use?', answer: 'All dates and times operate in Indian Standard Time (IST, UTC+5:30). Date format used throughout the system is YYYY-MM-DD internally and DD/MM/YYYY for display.' },
    { question: 'Can one owner see another owner\'s business data?', answer: "No. Strict data isolation is enforced at the database query level. Each Owner can only access their own businesses and the data within them. The system checks ownership on every API request — an Owner cannot query, view, or modify any business, customer, loan, or payment belonging to another Owner. This is enforced server-side and cannot be bypassed through the interface." },
    { question: 'Can the Platform Admin see business data?', answer: 'By default, no. The Platform Admin can only manage owners, registration requests, and platform settings. To view any business data, the Owner must explicitly grant time-limited Support Access. This access expires automatically and can be revoked at any time. Without an active, non-expired support access grant, the Platform Admin has zero visibility into any business data.' },
    { question: 'How is business data isolated between owners?', answer: "Every API request passes through a scope-checking layer that verifies the requesting user has legitimate access to the specific business. Owners are matched by ownership records, Business Admins and Agents by their assignment records, and Platform Admins by active support access grants. Any mismatch results in an immediate 'Access Denied' error. There is no global admin override — not even Platform Admins can bypass this without an explicit grant from the Owner." },
    { question: 'What data backup options are available?', answer: 'The application uses PostgreSQL as its production database, which supports standard backup mechanisms. Database backups can be taken using pg_dump for full or incremental backups. The Docker-based deployment allows for volume-level backups of the database data directory. For disaster recovery, regular automated backups should be configured at the server/infrastructure level by the system administrator.' },
    { question: 'How is data protected against leakage?', answer: "Multiple layers of protection are in place: (1) All API endpoints require authentication and authorization checks. (2) Sensitive data like Aadhaar numbers are hashed (SHA-256) with only last 4 digits stored in cleartext. (3) Passwords use bcrypt with 12 salt rounds. (4) Session tokens are httpOnly cookies inaccessible to JavaScript. (5) Role-based access control with 36 granular permissions prevents unauthorized actions. (6) Business data isolation ensures cross-owner data cannot leak. (7) Rate limiting prevents brute-force enumeration attacks. (8) Agents are restricted to only their assigned villages. (9) Platform Admins require explicit owner-granted time-limited access to view any business data." },
    { question: 'What happens if someone tries to access data they are not authorized to view?', answer: 'The system immediately returns a 403 Forbidden or Access Denied error. Unauthorized API requests are blocked before any data is retrieved. For unauthenticated requests, users are redirected to the login page or receive a 401 Unauthorized response. The scope-checking layer ensures that even valid logged-in users cannot access data outside their authorized scope.' },
    { question: 'Is personal and financial data encrypted?', answer: 'Sensitive personal data (Aadhaar numbers) is stored as irreversible SHA-256 hashes. Passwords use bcrypt hashing. Session tokens are cryptographically signed JWTs. The application is served over HTTPS (SSL/TLS) ensuring all data in transit is encrypted. For data at rest, encryption depends on the server/infrastructure configuration — PostgreSQL supports Transparent Data Encryption and disk-level encryption can be enabled at the OS level.' },
  ]

  await prisma.platformSetting.upsert({
    where: { key: 'faq' },
    update: { value: JSON.stringify(faqData) },
    create: { key: 'faq', value: JSON.stringify(faqData) },
  })

  console.log('Seed complete!')
  console.log('')
  console.log('Test accounts (password: system):')
  console.log('  platform_admin — Platform Admin')
  console.log('  owner1         — Owner (Sai Daily Finance + Sri Lakshmi Finance)')
  console.log('  owner2         — Owner (Ganesh Finance)')
  console.log('  business_admin — Business Admin (Sai Daily Finance)')
  console.log('  agent1         — Agent (PM Palem, Madhurawada)')
  console.log('  agent2         — Agent (Gajuwaka)')
  console.log('  agent3         — Agent (PM Palem + Ameerpet, 2 businesses)')
  console.log('  agent4         — Agent (Ganesh Finance)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
