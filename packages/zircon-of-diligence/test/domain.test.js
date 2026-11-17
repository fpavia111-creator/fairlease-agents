// Rent roll against T-12: the edge cases an acquisitions analyst would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findHeaderRow } from 'keystone-core';
import { checkDiligence, prepT12 } from '../src/diligence.js';

const MONTHS = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
const line = (account, name, v, months = MONTHS) => ({ account, account_name: name, ...Object.fromEntries(months.map((m, i) => [m, Array.isArray(v) ? v[i] : v])) });
const unit = (n, over = {}) => ({ unit: String(n), tenant: `Tenant ${n}`, status: 'Current', rent: 1000, market_rent: 1000, lease_start: '2026-01-01', lease_end: '2027-06-30', ...over });
const roll = (n = 10) => Array.from({ length: n }, (_, i) => unit(101 + i));
const run = (t12Rows, rentRoll = roll(), policy = {}) => checkDiligence({ rentRoll, t12Rows, policy, asOf: '2026-12-31' });
const rec = (r) => r.items.find((i) => i.area === 'reconciliation').findings;
const codesOf = (r, subject) => (r.items.find((i) => i.subject === subject)?.findings || []).map((f) => f.code);

test('a T-12 with names only is read by its INCOME and EXPENSES headings, and subtotals are not counted twice', () => {
  const rows = [{ account: '', account_name: 'INCOME' }, line('', 'Rental Income', 10000), line('', 'Laundry', 100), line('', 'Total Income', 10100), line('', 'Effective Gross Income', 10100),
    { account: '', account_name: 'Operating Expenses' }, line('', 'Repairs', 2000), line('', 'Rent Expense - Office', 500), line('', 'Total Expenses', 2500), line('', 'Net Operating Income', 7600)];
  assert.deepEqual([...prepT12(rows).section.entries()], [['Rental Income', 'income'], ['Laundry', 'income'], ['Repairs', 'expense'], ['Rent Expense - Office', 'expense']]);
  const r = run(rows);
  assert.equal(r.t12.income, 121200); assert.equal(r.t12.expenses, 30000); assert.equal(r.t12.noi, 91200); assert.equal(r.t12.rent_income_last_month, 10000);
  assert.ok(codesOf(r, 'T-12').includes('accounts_by_name')); assert.ok(!rec(r).some((f) => f.code === 'roll_above_collections'));
});

test('gross potential rent is taken net of vacancy and concessions, whichever sign the export gives them', () => {
  const make = (sign) => [line('4000', 'Gross Potential Rent', 12000), line('4010', 'Vacancy Loss', sign * 1500), line('4020', 'Concessions', sign * 500), line('4100', 'Late Fees', 100), line('5000', 'Repairs', 2000)];
  for (const sign of [1, -1]) {
    const r = run(make(sign));
    assert.equal(r.t12.rent_income_last_month, 10000); assert.equal(r.t12.income, 121200);
    assert.deepEqual(rec(r).map((f) => f.code), ['annualized_vs_t12', 'rent_income_net_of']);
  }
});

test('no rent at all in the last month is the largest gap there is, not a silent pass', () => {
  const r = run([line('4000', 'Rental Income', [...Array(11).fill(10000), 0]), line('5000', 'Repairs', 2000)]);
  const f = rec(r).find((x) => x.code === 'roll_above_collections');
  assert.ok(f, 'the gap is reported'); assert.equal(f.amount, 10000); assert.ok(codesOf(r, '4000').includes('month_blank'));
});

test('fourteen month columns: the latest twelve are the T-12', () => {
  const months = ['2025-11', '2025-12', ...MONTHS];
  const r = run([line('4000', 'Rental Income', [5000, 5000, ...Array(12).fill(10000)], months), line('5000', 'Repairs', 2000, months)]);
  assert.equal(r.t12.months, 12); assert.equal(r.t12.from, '2026-01'); assert.equal(r.t12.rent_income, 120000);
  assert.ok(codesOf(r, 'T-12').includes('t12_extra_months')); assert.ok(!codesOf(r, 'T-12').includes('t12_months_missing'));
});

test('a unit on two current lines is asked about; a future resident, a second building and charge lines are not duplicates', () => {
  const t12 = [line('4000', 'Rental Income', 10000)];
  const dup = run(t12, [...roll(), unit(101, { tenant: 'Someone Else' })]);
  assert.match(rec(dup).find((f) => f.code === 'duplicate_units').detail, /101/); assert.equal(dup.rent_roll.scheduled_monthly, 10000);
  const fine = run(t12, [...roll(9).map((u) => ({ ...u, property: 'Elm Court' })), unit(101, { property: 'Oak Row' }), unit(102, { property: 'Elm Court', tenant: 'Next Person', status: 'Future' }),
    { property: 'Pine Flats', unit: '7', tenant: 'T Seven', status: 'Current', charge_code: 'rent', charge_amount: 900 }, { property: 'Pine Flats', unit: '7', charge_code: 'parking', charge_amount: 50 }]);
  assert.ok(!rec(fine).some((f) => f.code === 'duplicate_units'));
});

test('a lease that has not started and a tenant who has moved out are not quietly counted as paying rent', () => {
  const r = run([line('4000', 'Rental Income', 10000)], [...roll(8), unit(109, { lease_start: '2027-02-01' }), unit(110, { move_out: '2026-11-30' }), unit(111, { status: 'Notice', move_out: '2026-12-15' })]);
  assert.deepEqual(codesOf(r, '109'), ['lease_not_started']); assert.deepEqual(codesOf(r, '110'), ['moved_out_in_roll']); assert.deepEqual(codesOf(r, '111'), []);
});

test('an annual premium is not an outlier; one month far from the rest is', () => {
  const r = run([line('4000', 'Rental Income', 10000), line('5400', 'Insurance', [0, 0, 0, 18000, 0, 0, 0, 0, 0, 0, 0, 0]), line('5000', 'Repairs', [2000, 2000, 2000, 2000, 9000, 2000, 2000, 2000, 2000, 2000, 2000, 2000])]);
  assert.deepEqual(codesOf(r, '5400'), []); assert.deepEqual(codesOf(r, '5000'), ['month_outlier']);
});

test('the header row is found under a title block when only one heading is a known word and the rest are months', () => {
  const def = { fields: { account: { aliases: ['Account'] }, account_name: { aliases: ['Account Name'] } } };
  const matrix = [['Maple Court (fictional) - Twelve Month Statement', '', ''], ['', '', ''], ['Account Name', 'Jan 2026', 'Feb 2026'], ['Rental Income', '10,000', '10,000']];
  assert.equal(findHeaderRow(matrix, def), 2);
  const r = run([line('Rental Income', '', 10000), line('Repairs', '', 2000)], roll(), { rent_accounts: ['Rental Income'] });
  assert.equal(r.t12.rent_income, 120000); assert.equal(r.t12.expenses, 24000);
});
