// Rent escalations: the edge cases a property accountant would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEscalations, upcoming } from '../src/index.js';

const lease = (over = {}) => ({ lease_id: 'L-1', property: 'HPP', unit: 'Suite 100', tenant: 'Acme Bagels LLC', start: '2025-01-01', end: '2027-12-31', rent: { monthly: 4000 }, escalation: { type: 'fixed_pct', pct: 3, every_months: 12 }, ...over });
const book = (...ls) => ({ properties: [{ id: 'HPP', name: 'Harbor Point Plaza' }, { id: 'BRA', name: 'Birch Row Apartments' }], leases: ls });
const chg = (date, charge, over = {}) => ({ lease_id: 'L-1', unit: 'Suite 100', tenant: 'Acme Bagels LLC', date, charge_code: 'RNT', description: 'Base rent', charge: String(charge), ...over });
const check = (leases, rows, from, to, extra = {}) => checkEscalations({ leases, rows, from, to: `${to}-28`, ...extra });
const codes = (i) => i.findings.map((f) => f.code);

test('billing the old rent after the step is a missed escalation, with the shortfall added up', () => {
  const r = check(book(lease()), [chg('2025-12-01', 4000), chg('2026-01-01', 4000), chg('2026-02-01', 4000)], '2025-12', '2026-02');
  assert.deepEqual(codes(r.items[0]), ['escalation_missed']); assert.equal(r.items[0].findings[0].amount, -240); assert.equal(r.underbilled_total, 240);
});

test('a lease id typed differently in the ledger ("l 1", "L1") still finds its lease', () => {
  const r = check(book(lease()), [chg('2025-03-01', 4000, { lease_id: 'l1' }), chg('2025-04-01', 4000, { lease_id: 'L 1' })], '2025-03', '2025-04');
  assert.equal(r.unmatched.length, 0); assert.deepEqual(codes(r.items[0]), []);
});

test('rent billed after the lease ended is called that, not "billed during free rent"', () => {
  const r = check(book(lease({ end: '2025-06-30' })), [chg('2025-06-01', 4000), chg('2025-07-01', 4000)], '2025-06', '2025-07');
  assert.deepEqual(codes(r.items[0]), ['billed_outside_term']); assert.match(r.items[0].findings[0].detail, /outside the lease term \(2025-01-01 to 2025-06-30\): 2025-07/);
});

test('a first month that starts on the 15th is expected by days, and half free rent is half', () => {
  const r = check(book(lease({ start: '2025-03-15', free_rent: [{ from: '2025-04-01', to: '2025-04-30', pct: 50 }] })), [chg('2025-03-15', 2193.55), chg('2025-04-01', 2000)], '2025-03', '2025-04');
  assert.deepEqual(r.items[0].lines.map((l) => l.expected), [2193.55, 2000]); assert.deepEqual(codes(r.items[0]), []);
});

test('the same unit number in two properties is matched by property when the ledger has no lease id', () => {
  const a = lease(); const b = lease({ lease_id: 'L-2', property: 'BRA', tenant: '', rent: { monthly: 1500 }, escalation: { type: 'none' } });
  const rows = [chg('2025-03-01', 1500, { lease_id: '', tenant: '', property: 'Birch Row Apartments' }), chg('2025-03-01', 4000, { lease_id: '', tenant: '', property: 'Harbor Point Plaza' })];
  const r = check(book(a, b), rows, '2025-03', '2025-03');
  assert.deepEqual(r.items.map((i) => [i.lease_id, i.billed_total, i.status]), [['L-1', 4000, 'ok'], ['L-2', 1500, 'ok']]);
});

test('a rent line whose code is a GL account number is read by its description; a payment coded as rent is not billing', () => {
  const r = check(book(lease()), [chg('2025-03-01', 4000, { charge_code: '4000-00' }), chg('2025-03-05', '', { payment: '4000' })], '2025-03', '2025-03');
  assert.equal(r.items[0].billed_total, 4000); assert.deepEqual(codes(r.items[0]), []);
});

test('the same rent charged twice in a month is reported as billed twice', () => {
  const r = check(book(lease()), [chg('2025-03-01', 4000), chg('2025-03-01', 4000)], '2025-03', '2025-03');
  assert.deepEqual(codes(r.items[0]), ['billed_twice']); assert.equal(r.items[0].findings[0].amount, 4000);
});

test('a CPI step is held to its floor and cap, and a missing index month is a review, never a guess', () => {
  const cpi = lease({ escalation: { type: 'cpi', every_months: 12, cpi: { index: 'CPI', base_month: '2024-11', lag_months: 2, floor_pct: 2, cap_pct: 4 } } });
  const up = upcoming({ leases: book(cpi), asOf: '2025-12-01', days: 60, indexes: { CPI: { '2024-11': 100, '2025-11': 110 } } });
  assert.deepEqual(up.map((u) => [u.date, u.to_monthly, u.status]), [['2026-01-01', 4160, 'ok']]);
  const r = check(book(cpi), [chg('2026-01-01', 4000)], '2026-01', '2026-01', { indexes: { CPI: { '2024-11': 100 } } });
  assert.deepEqual(codes(r.items[0]), ['index_missing']); assert.equal(r.items[0].status, 'review'); assert.equal(r.underbilled_total, 0);
});
