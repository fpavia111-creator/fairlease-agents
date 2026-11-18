import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDiligence, readT12, questionsText } from '../src/diligence.js';

const roll = [{ unit: '1', tenant: 'A', status: 'Current', rent: 1000, market_rent: 1000, lease_end: '2027-01-31' }, { unit: '2', tenant: 'B', status: 'Current', rent: 1000, market_rent: 1000, lease_end: '2027-01-31' }, { unit: '3', tenant: '', status: 'Vacant', market_rent: 1000 }];
const wide = (vals, acct = '4000', name = 'Rental Income') => { const r = { account: acct, account_name: name }; vals.forEach((v, i) => { r[`${['Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026'][i]}`] = v; }); r.Total = 'x'; return r; };

test('reads wide and long T-12s, skipping totals', () => {
  assert.equal(Object.keys(readT12([wide(Array(12).fill('2,000.00'))])[0].months).length, 12);
  const long = readT12([{ account: '4000', period: 'Mar 2026', amount: 5 }, { account: '4000', period: '2026-03', amount: 5 }, { account: 'Total Income', period: '2026-03', amount: 99 }]);
  assert.equal(long.length, 1); assert.equal(long[0].months['2026-03'], 10);
});

test('gap between the roll and last month\'s rent', () => {
  const r = checkDiligence({ rentRoll: roll, t12Rows: [wide(Array(11).fill(2000).concat([1500]))], asOf: '2026-11-15' });
  const rec = r.items.find((i) => i.subject === 'reconciliation'); assert.equal(rec.findings[0].code, 'roll_above_collections'); assert.equal(rec.findings[0].amount, 500);
  assert.equal(r.rent_roll.physical_occupancy_pct, 66.67); assert.equal(r.rent_roll.economic_occupancy_pct, 50);
});

test('within tolerance, nothing to ask', () => {
  const r = checkDiligence({ rentRoll: roll, t12Rows: [wide(Array(12).fill(2000))], asOf: '2026-11-15' });
  assert.equal(r.items.find((i) => i.subject === 'reconciliation').status, 'note');
  assert.throws(() => { if (!r.items.some((i) => i.status === 'issue')) throw new Error('none'); });
});

test('rent account by name in nine languages, or named in the policy', () => {
  for (const n of ['Rental Income', 'Mieteinnahmen', 'Loyers', 'Ingresos por alquiler', 'Receita de aluguel', 'Canoni di locazione', '賃料収入', '租金收入', '임대수입']) {
    const r = checkDiligence({ rentRoll: roll, t12Rows: [wide(Array(12).fill(2000), '4000', n)], asOf: '2026-11-15' });
    assert.equal(r.t12.rent_income, 24000, n);
  }
  assert.equal(checkDiligence({ rentRoll: roll, t12Rows: [wide(Array(12).fill(2000), '4000', 'Late Fees')], asOf: '2026-11-15' }).t12.rent_income, 0);
  assert.equal(checkDiligence({ rentRoll: roll, t12Rows: [wide(Array(12).fill(2000), '4010', 'Gross receipts')], policy: { rent_accounts: ['4010'] }, asOf: '2026-11-15' }).t12.rent_income, 24000);
});

test('stale T-12, missing months, expired lease, no rent', () => {
  const r = checkDiligence({ rentRoll: [{ unit: '1', tenant: 'A', status: 'Current', rent: 0, lease_end: '2026-01-31' }], t12Rows: [{ account: '4000', account_name: 'Rent', period: '2026-05', amount: 1 }], asOf: '2026-11-15' });
  const codes = r.items.flatMap((i) => i.findings.map((f) => f.code));
  for (const c of ['t12_months_missing', 't12_stale', 'expired_lease_in_roll', 'occupied_without_rent']) assert.ok(codes.includes(c), c);
});

test('questions list only open items', () => {
  const r = checkDiligence({ rentRoll: roll, t12Rows: [wide(Array(11).fill(2000).concat([1500]))], asOf: '2026-11-15' });
  const t = questionsText(r); assert.match(t, /Rent roll against T-12/); assert.doesNotMatch(t, /annualized/);
});
