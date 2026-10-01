const http = require('http');
const BASE = 'http://localhost:3002';
let cookies = '';
let results = [];
let passed = 0, failed = 0, skipped = 0;

function req(method, path, body, customCookies) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    };
    const ck = customCookies !== undefined ? customCookies : cookies;
    if (ck) opts.headers['Cookie'] = ck;
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const sc = res.headers['set-cookie'];
        if (sc) {
          const token = sc.find(c => c.startsWith('auth-token='));
          if (token) cookies = token.split(';')[0];
        }
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, json, raw: data, headers: res.headers });
      });
    });
    r.on('error', e => resolve({ status: 0, json: null, raw: e.message, headers: {} }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, json: null, raw: 'TIMEOUT', headers: {} }); });
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function record(tc, desc, pass, detail) {
  const st = pass ? 'PASS' : 'FAIL';
  if (pass) passed++; else failed++;
  results.push({ tc, desc, status: st, detail: detail || '' });
  console.log(`  ${st} | ${tc} | ${desc}${detail ? ' | ' + detail : ''}`);
}

function skip(tc, desc, reason) {
  skipped++;
  results.push({ tc, desc, status: 'SKIP', detail: reason });
  console.log(`  SKIP | ${tc} | ${desc} | ${reason}`);
}

async function switchTo(username) {
  return req('POST', '/api/auth/dev-switch', { username });
}

async function runTests() {
  console.log('=== Daily Finance — API Test Execution ===');
  console.log('Date: ' + new Date().toISOString());
  console.log('Server: ' + BASE);
  console.log('');

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const paUser = await prisma.user.findFirst({ where: { role: 'PLATFORM_ADMIN', isActive: true } });
  if (!paUser) { console.log('FATAL: No PLATFORM_ADMIN found'); process.exit(1); }
  console.log('PA: ' + paUser.username);

  // ============================================================
  // SETUP: Create Owner + Business + Village for business-scoped tests
  // ============================================================
  console.log('--- SETUP: Creating test owner + business ---');
  await switchTo(paUser.username);

  const ts = String(Date.now()).slice(-6);
  const ownerUn = 'own' + ts;
  let r = await req('POST', '/api/admin/owners', {
    fullName: 'Test Owner For Suite', phone: '9870000001',
    username: ownerUn, password: 'OwnerP1!'
  });
  const setupOwnerId = r.json?.id;
  console.log('  Created owner: ' + ownerUn + ' id=' + setupOwnerId);

  let businessId = null;
  let villageId = null;
  if (setupOwnerId) {
    await switchTo(ownerUn);
    r = await req('POST', '/api/businesses', {
      name: 'TestBiz_' + ts, city: 'TestCity',
      collectionType: 'DAILY', interestModel: 'ADDON',
      collectOnSundays: false, villages: ['Vill_A', 'Vill_B']
    });
    businessId = r.json?.id;
    console.log('  Created business: ' + r.json?.name + ' id=' + businessId);

    if (businessId) {
      r = await req('GET', '/api/b/' + businessId + '/villages');
      if (r.json?.length > 0) villageId = r.json[0].id;
      console.log('  Village ID: ' + villageId);
    }
  }
  console.log('');

  // ===== MODULE 1: AUTH-LOGIN =====
  console.log('--- Module 1: AUTH-LOGIN ---');

  r = await switchTo(paUser.username);
  record('AUTH-L-HP-01', 'Login with valid credentials', r.status === 200 && r.json?.success, `status=${r.status}`);

  r = await req('GET', '/api/auth/me');
  record('AUTH-L-HP-02', 'Auth/me returns correct user info', r.status === 200 && r.json?.role === 'PLATFORM_ADMIN', `role=${r.json?.role}`);

  r = await req('POST', '/api/auth/logout');
  record('AUTH-L-HP-03', 'Logout clears session', r.status === 200 && r.json?.success, `status=${r.status}`);

  r = await req('POST', '/api/auth/login', { username: paUser.username, password: 'wrongpw123' });
  record('AUTH-L-NEG-01', 'Login with wrong password', r.status === 401, `status=${r.status}`);

  r = await req('POST', '/api/auth/login', { username: 'nonexistent_xyz', password: 'any' });
  record('AUTH-L-NEG-02', 'Login non-existent username', r.status === 401, `status=${r.status}`);

  r = await req('POST', '/api/auth/login', {});
  record('AUTH-L-NEG-03', 'Login empty body', r.status === 400, `status=${r.status}`);

  r = await req('GET', '/api/auth/me', null, '');
  record('AUTH-L-NEG-05', 'Access /me without auth', r.status === 401, `status=${r.status}`);

  // ===== MODULE 2: AUTH-REGISTER =====
  console.log('--- Module 2: AUTH-REGISTER ---');

  r = await req('GET', '/api/auth/check-username?username=avail_test_99', null, '');
  record('AUTH-R-HP-01', 'Check available username', r.status === 200 && r.json?.available === true, `available=${r.json?.available}`);

  r = await req('GET', '/api/auth/check-username?username=' + paUser.username, null, '');
  record('AUTH-R-NEG-01', 'Check taken username', r.status === 200 && r.json?.available === false, `available=${r.json?.available}`);

  r = await req('GET', '/api/auth/check-username?username=ab', null, '');
  record('AUTH-R-CC-02', 'Username too short', r.status === 200 && r.json?.available === false, `available=${r.json?.available}`);

  const regUn = 'rg' + ts;
  r = await req('POST', '/api/auth/register', {
    fullName: 'Reg Test', phone: '9870000099', username: regUn,
    password: 'RegPass1!', confirmPassword: 'RegPass1!',
    businessName: 'RegBiz', city: 'RegCity',
    villages: ['V1'], collectionType: 'DAILY', declaration: true
  }, '');
  record('AUTH-R-HP-02', 'Register with all fields', r.status === 201 && r.json?.success, `status=${r.status} ${r.json?.error || ''}`);

  r = await req('POST', '/api/auth/register', {
    fullName: 'Dup', phone: '9870000098', username: regUn,
    password: 'RegPass1!', confirmPassword: 'RegPass1!', declaration: true
  }, '');
  record('AUTH-R-NEG-05', 'Register pending username', r.status === 409, `status=${r.status}`);

  r = await req('POST', '/api/auth/register', {
    fullName: 'Weak', phone: '9870000097', username: 'wk' + ts,
    password: 'abc', confirmPassword: 'abc', declaration: true
  }, '');
  record('AUTH-R-NEG-02', 'Register weak password', r.status === 400, `status=${r.status}`);

  r = await req('POST', '/api/auth/register', {
    fullName: 'Mis', phone: '9870000096', username: 'mm' + ts,
    password: 'RegPass1!', confirmPassword: 'DiffPass!1', declaration: true
  }, '');
  record('AUTH-R-NEG-03', 'Register mismatched passwords', r.status === 400, `status=${r.status}`);

  r = await req('POST', '/api/auth/register', {
    fullName: 'Ph', phone: '12345', username: 'bp' + ts,
    password: 'RegPass1!', confirmPassword: 'RegPass1!', declaration: true
  }, '');
  record('AUTH-R-NEG-04', 'Register invalid phone', r.status === 400, `status=${r.status}`);

  // ===== MODULE 3: AUTH-PASSWORD =====
  console.log('--- Module 3: AUTH-PASSWORD ---');

  r = await req('POST', '/api/auth/forgot-password', { phone: '9870000001' }, '');
  record('AUTH-P-HP-01', 'Forgot password creates request', r.status === 200, `status=${r.status}`);

  r = await req('POST', '/api/auth/forgot-password', { phone: '9999999999' }, '');
  record('AUTH-P-CC-01', 'Forgot password non-existent (no leak)', r.status === 200, `status=${r.status}`);

  r = await req('POST', '/api/auth/forgot-password', { phone: 'abc' }, '');
  record('AUTH-P-NEG-02', 'Forgot password invalid phone', r.status === 400, `status=${r.status}`);

  r = await req('POST', '/api/auth/change-password', { newPassword: 'X' }, '');
  record('AUTH-P-NEG-04', 'Change password without auth', r.status === 401, `status=${r.status}`);

  // ===== MODULE 4: ADMIN-OWNERS =====
  console.log('--- Module 4: ADMIN-OWNERS ---');
  await switchTo(paUser.username);

  r = await req('GET', '/api/admin/owners');
  record('ADM-O-HP-01', 'List owners', r.status === 200 && Array.isArray(r.json), `count=${r.json?.length}`);

  const o2Un = 'o2' + ts;
  r = await req('POST', '/api/admin/owners', {
    fullName: 'Owner2', phone: '9870000002', username: o2Un, password: 'O2Pass1!'
  });
  const o2Id = r.json?.id;
  record('ADM-O-HP-02', 'Create new owner', r.status === 201 && r.json?.username === o2Un, `id=${o2Id}`);

  if (o2Id) {
    r = await req('GET', '/api/admin/owners/' + o2Id);
    record('ADM-O-HP-03', 'Get owner details', r.status === 200 && r.json?.username === o2Un, `name=${r.json?.fullName}`);

    r = await req('PATCH', '/api/admin/owners/' + o2Id, { fullName: 'Renamed Owner2' });
    record('ADM-O-HP-04', 'Update owner', r.status === 200, `status=${r.status}`);
  }

  r = await req('POST', '/api/admin/owners', {
    fullName: 'Dup', phone: '9870000003', username: paUser.username, password: 'X1pass!'
  });
  record('ADM-O-NEG-01', 'Create duplicate username', r.status === 409 || r.status === 400, `status=${r.status}`);

  r = await req('GET', '/api/admin/owners/nonexistent-id-xyz');
  record('ADM-O-NEG-04', 'Get non-existent owner', r.status === 404, `status=${r.status}`);

  if (o2Id) {
    r = await req('DELETE', '/api/admin/owners/' + o2Id);
    record('ADM-O-CC-01', 'Delete owner (no business)', r.status === 200 && r.json?.success, `status=${r.status}`);

    r = await req('GET', '/api/auth/check-username?username=' + o2Un, null, '');
    record('ADM-O-CC-01b', 'Deleted owner username freed', r.json?.available === true, `available=${r.json?.available}`);
  }

  // ===== MODULE 5: ADMIN-REGISTRATION =====
  console.log('--- Module 5: ADMIN-REGISTRATION ---');
  await switchTo(paUser.username);

  r = await req('GET', '/api/admin/registration-requests?status=ALL');
  record('ADM-RR-HP-01', 'List registration requests', r.status === 200 && Array.isArray(r.json), `count=${r.json?.length}`);

  r = await req('GET', '/api/admin/registration-requests/pending-count');
  record('ADM-RR-CC-02', 'Pending count', r.status === 200 && typeof r.json?.count === 'number', `count=${r.json?.count}`);

  // Use the registration we just created (regUn)
  const pendingReqs = await prisma.registrationRequest.findMany({ where: { status: 'PENDING' }, take: 2 });
  if (pendingReqs.length >= 1) {
    r = await req('POST', '/api/admin/registration-requests/' + pendingReqs[0].id + '/approve');
    record('ADM-RR-HP-02', 'Approve registration', r.status === 200 && r.json?.success, `userId=${r.json?.userId}`);

    r = await req('POST', '/api/admin/registration-requests/' + pendingReqs[0].id + '/approve');
    record('ADM-RR-NEG-01', 'Approve non-PENDING', r.status === 400 || r.status === 404, `status=${r.status}`);
  } else {
    skip('ADM-RR-HP-02', 'Approve registration', 'No pending');
    skip('ADM-RR-NEG-01', 'Approve non-PENDING', 'No pending');
  }
  if (pendingReqs.length >= 2) {
    r = await req('POST', '/api/admin/registration-requests/' + pendingReqs[1].id + '/reject', { reason: 'Test rejection' });
    record('ADM-RR-HP-03', 'Reject registration', r.status === 200 && r.json?.success, `status=${r.status}`);
  } else {
    skip('ADM-RR-HP-03', 'Reject registration', 'Only 1 pending');
  }

  r = await req('POST', '/api/admin/registration-requests/nonexistent-id/reject', {});
  record('ADM-RR-NEG-02', 'Reject without reason', r.status === 400 || r.status === 404, `status=${r.status}`);

  // ===== MODULE 6: ADMIN-PASSWORD-RESET =====
  console.log('--- Module 6: ADMIN-PASSWORD-RESET ---');

  r = await req('GET', '/api/admin/password-resets?status=ALL');
  record('ADM-PR-HP-01', 'List password resets', r.status === 200 && Array.isArray(r.json), `count=${r.json?.length}`);

  r = await req('GET', '/api/admin/password-resets/pending-count');
  record('ADM-PR-HP-02', 'Pending count', r.status === 200 && typeof r.json?.count === 'number', `count=${r.json?.count}`);

  // ===== BUSINESS-SCOPED TESTS =====
  if (businessId && villageId) {
    await switchTo(ownerUn);

    // MODULE 7: BUSINESS SETTINGS
    console.log('--- Module 7: BUSINESS-SETTINGS ---');

    r = await req('GET', '/api/b/' + businessId + '/settings');
    record('BIZ-S-HP-01', 'Get business settings', r.status === 200 && r.json?.id === businessId, `name=${r.json?.name}`);

    r = await req('PATCH', '/api/b/' + businessId + '/settings', { autoLogoutMinutes: 45 });
    record('BIZ-S-HP-02', 'Update settings', r.status === 200, `status=${r.status}`);
    await req('PATCH', '/api/b/' + businessId + '/settings', { autoLogoutMinutes: 30 });

    r = await req('GET', '/api/b/nonexistent-biz-id/settings');
    record('BIZ-S-NEG-01', 'Access wrong business', r.status === 403, `status=${r.status}`);

    // MODULE 8: VILLAGES
    console.log('--- Module 8: VILLAGES ---');

    r = await req('GET', '/api/b/' + businessId + '/villages');
    record('VIL-HP-01', 'List villages', r.status === 200 && Array.isArray(r.json), `count=${r.json?.length}`);

    const vName = 'NewVill_' + ts;
    r = await req('POST', '/api/b/' + businessId + '/villages', { name: vName });
    const newVillId = r.json?.id;
    record('VIL-HP-02', 'Create village', r.status === 201 && r.json?.name === vName, `id=${newVillId}`);

    if (newVillId) {
      r = await req('POST', '/api/b/' + businessId + '/villages', { name: vName });
      record('VIL-NEG-01', 'Duplicate village name', r.status !== 201, `status=${r.status}`);

      r = await req('PATCH', '/api/b/' + businessId + '/villages/' + newVillId, { name: vName + '_x' });
      record('VIL-HP-03', 'Update village', r.status === 200, `status=${r.status}`);

      r = await req('DELETE', '/api/b/' + businessId + '/villages/' + newVillId);
      record('VIL-HP-04', 'Delete empty village', r.status === 200, `status=${r.status}`);
    }

    // MODULE 9: CUSTOMERS
    console.log('--- Module 9: CUSTOMERS ---');

    r = await req('GET', '/api/b/' + businessId + '/customers');
    record('CUST-HP-01', 'List customers', r.status === 200 && Array.isArray(r.json), `count=${r.json?.length}`);

    r = await req('POST', '/api/b/' + businessId + '/customers', {
      fullName: 'Cust_' + ts, phone: '9870' + ts, villageId, age: 30, address: 'Addr'
    });
    const custId = r.json?.id;
    record('CUST-HP-02', 'Create customer', r.status === 201 && r.json?.customerId, `cid=${r.json?.customerId}`);

    if (custId) {
      r = await req('GET', '/api/b/' + businessId + '/customers/' + custId);
      record('CUST-HP-03', 'Get customer detail', r.status === 200 && r.json?.fullName, `name=${r.json?.fullName}`);

      r = await req('PATCH', '/api/b/' + businessId + '/customers/' + custId, { address: 'Updated' });
      record('CUST-HP-04', 'Update customer', r.status === 200, `status=${r.status}`);
    }

    r = await req('POST', '/api/b/' + businessId + '/customers', { fullName: 'NoPhone', villageId });
    record('CUST-NEG-01', 'Create without phone', r.status === 400, `status=${r.status}`);

    r = await req('POST', '/api/b/' + businessId + '/customers', { fullName: 'BadPh', phone: '123', villageId });
    record('CUST-NEG-02', 'Create invalid phone', r.status === 400, `status=${r.status}`);

    r = await req('POST', '/api/b/' + businessId + '/customers', { fullName: 'Young', phone: '9870000033', villageId, age: 17 });
    record('CUST-CC-03', 'Age below 18', r.status === 400, `status=${r.status}`);

    // MODULE 10: LOANS
    console.log('--- Module 10: LOANS ---');

    r = await req('GET', '/api/b/' + businessId + '/loans');
    record('LOAN-HP-01', 'List loans', r.status === 200 && Array.isArray(r.json), `count=${r.json?.length}`);

    let loanId = null;
    if (custId) {
      r = await req('POST', '/api/b/' + businessId + '/loans', {
        customerId: custId, loanAmount: 1000000, interestAmount: 100000,
        collectionType: 'DAILY', installmentAmount: 11000,
        numberOfInstallments: 100, startDate: '2026-10-01'
      });
      loanId = r.json?.id;
      record('LOAN-HP-02', 'Create loan', r.status === 201 && r.json?.loanNumber, `ln=${r.json?.loanNumber}`);
    }

    if (loanId) {
      r = await req('GET', '/api/b/' + businessId + '/loans/' + loanId);
      record('LOAN-HP-03', 'Get loan + schedule', r.status === 200 && r.json?.schedule?.length > 0, `sched=${r.json?.schedule?.length}`);

      r = await req('PATCH', '/api/b/' + businessId + '/loans/' + loanId, { notes: 'Test' });
      record('LOAN-HP-04', 'Update loan notes', r.status === 200, `status=${r.status}`);
    }

    r = await req('POST', '/api/b/' + businessId + '/loans', {
      loanAmount: 100, interestAmount: 10, collectionType: 'DAILY',
      installmentAmount: 11, numberOfInstallments: 10, startDate: '2026-10-01'
    });
    record('LOAN-NEG-01', 'Create without customerId', r.status === 400, `status=${r.status}`);

    if (custId) {
      r = await req('POST', '/api/b/' + businessId + '/loans', {
        customerId: custId, loanAmount: -100, interestAmount: 10,
        collectionType: 'DAILY', installmentAmount: 11,
        numberOfInstallments: 10, startDate: '2026-10-01'
      });
      record('LOAN-NEG-02', 'Negative loan amount', r.status === 400, `status=${r.status}`);
    }

    // MODULE 11: PAYMENTS
    console.log('--- Module 11: PAYMENTS ---');

    if (loanId) {
      r = await req('POST', '/api/b/' + businessId + '/payments', {
        loanId, amount: 11000, paymentDate: '2026-10-01'
      });
      record('PAY-HP-01', 'Post payment', r.status === 201 && r.json?.receiptNumber, `rcpt=${r.json?.receiptNumber}`);

      r = await req('GET', '/api/b/' + businessId + '/payments?loanId=' + loanId);
      record('PAY-HP-02', 'List payments', r.status === 200 && Array.isArray(r.json), `count=${r.json?.length}`);

      r = await req('POST', '/api/b/' + businessId + '/payments', {
        loanId, amount: 0, paymentDate: '2026-10-01'
      });
      record('PAY-NEG-02', 'Zero amount', r.status === 400, `status=${r.status}`);

      r = await req('POST', '/api/b/' + businessId + '/payments/bulk', {
        paymentDate: '2026-10-01', payments: [{ loanId, amount: 11000 }]
      });
      record('PAY-HP-03', 'Bulk payment', r.status === 201, `count=${r.json?.count}`);

      r = await req('POST', '/api/b/' + businessId + '/payments', {
        loanId, amount: 999999999, paymentDate: '2026-10-01'
      });
      record('PAY-NEG-03', 'Payment exceeds outstanding', r.status === 400, `status=${r.status}`);
    } else {
      skip('PAY-HP-01', 'Post payment', 'No loan');
      skip('PAY-HP-02', 'List payments', 'No loan');
      skip('PAY-NEG-02', 'Zero amount', 'No loan');
      skip('PAY-HP-03', 'Bulk payment', 'No loan');
      skip('PAY-NEG-03', 'Exceeds outstanding', 'No loan');
    }

    r = await req('POST', '/api/b/' + businessId + '/payments', {
      loanId: 'fake-id-xyz', amount: 100, paymentDate: '2026-10-01'
    });
    record('PAY-NEG-01', 'Payment non-existent loan', r.status === 404, `status=${r.status}`);

    r = await req('GET', '/api/b/' + businessId + '/posting/village?villageId=' + villageId);
    record('PAY-HP-04', 'Village posting data', r.status === 200 && Array.isArray(r.json), `count=${r.json?.length}`);

    // MODULE 12: USERS/EMPLOYEES
    console.log('--- Module 12: USERS-EMPLOYEES ---');

    r = await req('GET', '/api/b/' + businessId + '/users');
    record('USR-HP-01', 'List employees', r.status === 200 && Array.isArray(r.json), `count=${r.json?.length}`);

    const agUn = 'ag' + ts;
    r = await req('POST', '/api/b/' + businessId + '/users', {
      fullName: 'TestAgent', phone: '9870000055', username: agUn,
      password: 'AgP1pass!', role: 'AGENT', businessIds: [businessId]
    });
    const agId = r.json?.id;
    record('USR-HP-02', 'Create agent', r.status === 201, `id=${agId}`);

    if (agId) {
      r = await req('PATCH', '/api/b/' + businessId + '/users/' + agId, { fullName: 'Renamed Agent' });
      record('USR-HP-03', 'Update employee', r.status === 200, `status=${r.status}`);
    }

    r = await req('POST', '/api/b/' + businessId + '/users', {
      fullName: 'DupAg', phone: '9870000066', username: ownerUn,
      password: 'X1pass!', role: 'AGENT', businessIds: [businessId]
    });
    record('USR-NEG-01', 'Duplicate username', r.status === 409 || r.status === 400, `status=${r.status}`);

    if (agId) {
      r = await req('DELETE', '/api/b/' + businessId + '/users/' + agId);
      record('USR-HP-04', 'Delete employee', r.status === 200, `status=${r.status}`);

      r = await req('GET', '/api/auth/check-username?username=' + agUn, null, '');
      record('USR-CC-01', 'Deleted employee username freed', r.json?.available === true, `available=${r.json?.available}`);
    }

    // MODULE 13: REPORTS
    console.log('--- Module 13: REPORTS ---');

    r = await req('GET', '/api/b/' + businessId + '/reports?entity=loans&from=2026-09-01&to=2026-10-02');
    record('RPT-HP-01', 'Loan report', r.status === 200 && r.json?.columns, `rows=${r.json?.rows?.length}`);

    r = await req('GET', '/api/b/' + businessId + '/reports?entity=customers&from=2026-09-01&to=2026-10-02');
    record('RPT-HP-02', 'Customer report', r.status === 200 && r.json?.columns, `rows=${r.json?.rows?.length}`);

    r = await req('GET', '/api/b/' + businessId + '/reports?entity=payments&from=2026-09-01&to=2026-10-02');
    record('RPT-HP-03', 'Payment report', r.status === 200 && r.json?.columns, `rows=${r.json?.rows?.length}`);

    r = await req('GET', '/api/b/' + businessId + '/reports?entity=loans&from=2030-01-01&to=2030-01-02');
    record('RPT-CC-01', 'Report no data in range', r.status === 200, `rows=${r.json?.rows?.length}`);

    // MODULE 14: PLATFORM SETTINGS
    console.log('--- Module 14: PLATFORM-SETTINGS ---');
    await switchTo(paUser.username);

    r = await req('GET', '/api/admin/platform-settings');
    record('PLAT-HP-01', 'Get platform settings', r.status === 200, `status=${r.status}`);

    // RBAC TESTS
    console.log('--- RBAC: Owner endpoints ---');
    await switchTo(ownerUn);

    r = await req('GET', '/api/owner/businesses');
    record('OWN-HP-01', 'Owner list businesses', r.status === 200 && Array.isArray(r.json), `count=${r.json?.length}`);

    r = await req('GET', '/api/owner/villages');
    record('OWN-HP-02', 'Owner list villages', r.status === 200 && Array.isArray(r.json), `count=${r.json?.length}`);

    r = await req('GET', '/api/auth/profile');
    record('OWN-HP-03', 'Owner profile', r.status === 200 && r.json?.businesses, `biz=${r.json?.businesses?.length}`);

    console.log('--- RBAC: Cross-role denial ---');
    r = await req('GET', '/api/admin/owners');
    record('RBAC-NEG-01', 'Owner cannot list owners', r.status === 403, `status=${r.status}`);

    r = await req('GET', '/api/admin/registration-requests');
    record('RBAC-NEG-02', 'Owner cannot list registrations', r.status === 403, `status=${r.status}`);

    // RBAC: Unauthenticated access to business-scoped
    r = await req('GET', '/api/b/' + businessId + '/customers', null, '');
    record('RBAC-NEG-03', 'Unauth cannot list customers', r.status === 401, `status=${r.status}`);

  } else {
    console.log('--- SKIPPING business-scoped tests (setup failed) ---');
    ['BIZ-S-HP-01','VIL-HP-01','CUST-HP-01','LOAN-HP-01','PAY-HP-01','USR-HP-01','RPT-HP-01'].forEach(tc =>
      skip(tc, 'Skipped', 'No business created')
    );
  }

  // ============================================================
  // CLEANUP
  // ============================================================
  console.log('');
  console.log('--- CLEANUP ---');
  try { await prisma.registrationRequest.deleteMany({ where: { username: regUn } }); } catch {}
  console.log('  Cleaned registration request');

  await prisma.$disconnect();

  // ============================================================
  // SUMMARY + REPORT
  // ============================================================
  console.log('');
  console.log('============================================');
  console.log('  TEST EXECUTION SUMMARY');
  console.log('============================================');
  console.log('  Total:   ' + results.length);
  console.log('  Passed:  ' + passed);
  console.log('  Failed:  ' + failed);
  console.log('  Skipped: ' + skipped);
  const rate = passed + failed > 0 ? ((passed / (passed + failed)) * 100).toFixed(1) : '0';
  console.log('  Pass Rate: ' + rate + '%');
  console.log('============================================');

  let rpt = '# Daily Finance — Test Execution Report\n\n';
  rpt += '**Date:** ' + new Date().toISOString() + '\n';
  rpt += '**Server:** ' + BASE + '\n';
  rpt += '**Classification:** Internal Use Only\n\n';
  rpt += '---\n\n## Summary\n\n';
  rpt += '| Metric | Value |\n|--------|-------|\n';
  rpt += '| Total Tests | ' + results.length + ' |\n';
  rpt += '| Passed | ' + passed + ' |\n';
  rpt += '| Failed | ' + failed + ' |\n';
  rpt += '| Skipped | ' + skipped + ' |\n';
  rpt += '| Pass Rate | ' + rate + '% |\n\n';
  rpt += '---\n\n## Detailed Results\n\n';
  rpt += '| # | TC ID | Description | Status | Detail |\n';
  rpt += '|---|-------|-------------|--------|--------|\n';
  results.forEach((r, i) => {
    rpt += '| ' + (i + 1) + ' | ' + r.tc + ' | ' + r.desc + ' | **' + r.status + '** | ' + r.detail + ' |\n';
  });

  // Bug summary
  const bugs = results.filter(r => r.status === 'FAIL');
  if (bugs.length > 0) {
    rpt += '\n---\n\n## Bugs Found\n\n';
    bugs.forEach((b, i) => {
      rpt += (i + 1) + '. **' + b.tc + '**: ' + b.desc + ' — ' + b.detail + '\n';
    });
  }

  rpt += '\n---\n\n**Internal Use Only**\n';

  require('fs').writeFileSync(require('path').join(__dirname, '03_Test_Execution_Report.md'), rpt);
  console.log('\nReport: output/03_Test_Execution_Report.md');
}

runTests().catch(e => { console.error('FATAL:', e); process.exit(1); });
