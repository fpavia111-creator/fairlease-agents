import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkInsurance, requestText } from '../src/insurance.js';

const leases = { leases: [
  { lease_id: 'A', unit: 'S1', tenant: 'Alpha', start: '2025-01-01', end: '2030-12-31', insurance: { gl_per_occurrence: 1000000, gl_aggregate: 2000000, additional_insured: true } },
  { lease_id: 'B', unit: 'S2', tenant: 'Beta', start: '2025-01-01', end: '2030-12-31', insurance: { renters_liability: 100000 } },
  { lease_id: 'C', unit: 'S3', tenant: 'Gamma', start: '2025-01-01', end: '2030-12-31' },
  { lease_id: 'D', unit: 'S4', tenant: 'Delta', start: '2024-01-01', end: '2025-12-31', notes: 'Month-to-month since the lease ended.', insurance: { renters_liability: 100000 } },
  { lease_id: 'E', unit: 'S5', tenant: 'Epsilon', start: '2024-01-01', end: '2025-12-31', insurance: { renters_liability: 100000 } },
] };
const asOf = '2026-06-01';

test('a compliant certificate is ok', () => {
  const r = checkInsurance({ leases, certs: [{ lease_id: 'A', liability: 1000000, aggregate: 2000000, additional_insured: 'Yes', expires: '2027-01-01' }], asOf });
  assert.equal(r.items.find((i) => i.lease_id === 'A').status, 'ok');
});

test('expiring alone is due soon, not an issue', () => {
  const r = checkInsurance({ leases, certs: [{ lease_id: 'A', liability: 1000000, aggregate: 2000000, additional_insured: 'Yes', expires: '2026-06-20' }], asOf });
  const a = r.items.find((i) => i.lease_id === 'A'); assert.equal(a.status, 'due_soon'); assert.equal(a.findings[0].code, 'expiring');
});

test('limits, wording and expiry are checked against each lease', () => {
  const r = checkInsurance({ leases, certs: [{ unit: 'S1', tenant: 'Alpha', liability: 500000, additional_insured: 'Ja', expires: '2026-05-01' }, { unit: 'S2', liability: 100000, expires: '' }], asOf });
  const a = r.items.find((i) => i.lease_id === 'A'); assert.deepEqual(a.findings.map((f) => f.code), ['expired', 'liability_below', 'aggregate_below']);
  const b = r.items.find((i) => i.lease_id === 'B'); assert.deepEqual(b.findings.map((f) => f.code), ['expiry_missing']);
});

test('additional insured unknown is worded differently from a clear no', () => {
  const blank = checkInsurance({ leases, certs: [{ lease_id: 'A', liability: 1000000, aggregate: 2000000, expires: '2027-01-01' }], asOf }).items.find((i) => i.lease_id === 'A');
  const no = checkInsurance({ leases, certs: [{ lease_id: 'A', liability: 1000000, aggregate: 2000000, additional_insured: 'No', expires: '2027-01-01' }], asOf }).items.find((i) => i.lease_id === 'A');
  assert.match(blank.findings[0].detail, /does not show/); assert.match(no.findings[0].detail, /is not named/);
});

test('latest certificate wins when several are on file', () => {
  const r = checkInsurance({ leases, certs: [{ lease_id: 'B', liability: 100000, expires: '2025-01-01' }, { lease_id: 'B', liability: 100000, expires: '2027-01-01' }], asOf });
  assert.equal(r.items.find((i) => i.lease_id === 'B').status, 'ok');
});

test('month-to-month holdovers stay in force; ended leases do not', () => {
  const r = checkInsurance({ leases, certs: [{ unit: 'S5', expires: '2027-01-01', liability: 100000 }], asOf });
  assert.ok(r.items.some((i) => i.lease_id === 'D' && i.findings.some((f) => f.code === 'holdover')));
  assert.ok(!r.items.some((i) => i.lease_id === 'E'));
  assert.match(r.unmatched_certificates[0].reason, /lease E not in force/);
});

test('no requirement is noted, not flagged', () => {
  const c = checkInsurance({ leases, certs: [], asOf }).items.find((i) => i.lease_id === 'C');
  assert.equal(c.status, 'ok'); assert.equal(c.findings[0].code, 'no_requirement');
});

test('request lists only the findings and leaves gaps to confirm', () => {
  const it = checkInsurance({ leases, certs: [], asOf }).items.find((i) => i.lease_id === 'A');
  const t = requestText(it, {}); assert.match(t, /No certificate on file/); assert.match(t, /\[TO CONFIRM: date\]/); assert.match(t, /1,000,000 per occurrence/);
});
