import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEscalations, upcoming, billedRent } from '../src/index.js';

const leases = { leases: [{ lease_id: 'A', unit: '1', tenant: 'Ann Co', start: '2025-01-15', end: '2026-12-31', rent: { monthly: 3100 }, escalation: { type: 'fixed_pct', pct: 10 } }] };
const row = (date, amt, extra = {}) => ({ lease_id: 'A', date, charge_code: 'RENT', charge: String(amt), ...extra });

test('first part month is prorated by days; a full month is the monthly rent', () => {
  const r = checkEscalations({ leases, rows: [row('2025-01-15', 1700), row('2025-02-01', 3100)], from: '2025-01', to: '2025-02-28' });
  assert.equal(r.items[0].lines[0].expected, 1700); assert.equal(r.items[0].status, 'ok');
});

test('the old rent after a step is a missed escalation; other amounts are under or over', () => {
  const r = checkEscalations({ leases, rows: [row('2026-02-01', 3100), row('2026-03-01', 3000), row('2026-04-01', 3500)], from: '2026-02', to: '2026-04-28' });
  assert.deepEqual(r.items[0].lines.map((x) => x.code), ['escalation_missed', 'underbilled', 'overbilled']);
});

test('only rent charges count; payments and fees are ignored', () => {
  const { billed } = billedRent([row('2025-03-01', 3100), row('2025-03-05', 50, { charge_code: 'Late Fee' }), { lease_id: 'A', date: '2025-03-02', charge_code: 'PMT', payment: '3100' }], leases);
  assert.equal(billed.get('A|2025-03'), 3100);
});

test('rows without a lease id match by unit and tenant', () => {
  const { billed, unmatched } = billedRent([{ unit: 'Unit 1', tenant: 'ANN CO.', date: '2025-05-01', charge_code: 'Rent', amount: '3100' }, { unit: '9', date: '2025-05-01', charge_code: 'Rent', amount: '1' }], leases);
  assert.equal(billed.get('A|2025-05'), 3100); assert.equal(unmatched.length, 1);
});

test('upcoming lists the anniversary step with old and new rent', () => {
  const u = upcoming({ leases, asOf: '2025-12-01', days: 60 });
  assert.deepEqual(u.map((x) => [x.date, x.from_monthly, x.to_monthly]), [['2026-01-15', 3100, 3410]]);
});
