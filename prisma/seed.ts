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
  await prisma.recoveryCode.deleteMany()
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
      totpEnabled: false,
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
      totpEnabled: false,
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
      totpEnabled: false,
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
      collectOnSundays: false,
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
      collectOnSundays: false,
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
      collectOnSundays: false,
      gracePeriodDaily: 30,
      autoLogoutMinutes: 30,
    },
  })

  // ── STAFF USERS ────────────────────────────────────────────────────────
  const adminSai = await prisma.user.create({
    data: {
      username: 'admin_sai',
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
      username: 'agent_o2',
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

  console.log('Seed complete!')
  console.log('')
  console.log('Test accounts (password: system):')
  console.log('  platform_admin — Platform Admin')
  console.log('  owner1         — Owner (Sai Daily Finance + Sri Lakshmi Finance)')
  console.log('  owner2         — Owner (Ganesh Finance)')
  console.log('  admin_sai      — Business Admin (Sai Daily Finance)')
  console.log('  agent1         — Agent (PM Palem, Madhurawada)')
  console.log('  agent2         — Agent (Gajuwaka)')
  console.log('  agent3         — Agent (PM Palem + Ameerpet, 2 businesses)')
  console.log('  agent_o2       — Agent (Ganesh Finance)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
