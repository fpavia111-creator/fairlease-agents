// Owner statements: the edge cases an owner-relations accountant would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStatements } from '../src/index.js';

const st = (period, begin, over = {}) => ({ owner: 'Maple Court Holdings LLC', property: 'Maple Court', period, beginning_balance: String(begin), income: '10000', expenses: '4000', management_fee: '800', owner_draw: '3000', ending_balance: String(begin + 2200), ...over });
const run = (rows, policy = {}, ledgerRows = null) => checkStatements({ rows, ledgerRows, policy });
const codes = (r, period) => r.items.find((i) => i.period === period).findings.map((f) => f.code);
const led = (type, description, over = {}) => ({ owner: 'Maple Court Holdings LLC', property: 'Maple Court', date: '2026-10-10', type, description, ...over });

test('a skipped month is reported as a missing statement, not as a wrong beginning balance', () => {
  const r = run([st('2026-08', 5000), st('2026-10', 9400)]);
  assert.deepEqual(codes(r, '2026-10'), ['period_missing']); assert.match(r.items[0].findings[0].detail, /No statement for 2026-09/);
  assert.deepEqual(codes(run([st('2026-09', 5000), st('2026-10', 7300)]), '2026-10'), ['beginning_differs']);
});

test('the same statement twice in the file is a duplicate, not a balance that fails to roll', () => {
  const r = run([st('2026-10', 5000), st('2026-10', 5000)]);
  assert.deepEqual(r.items.map((i) => i.findings.map((f) => f.code)), [['duplicate_statement'], ['duplicate_statement']]);
});

test('distributions and contributions in the owner ledger are neither expenses nor income', () => {
  const ledger = [led('Receipt', 'Rent', { income: '10000' }), led('Bill', 'Plumbing', { expense: '4000' }), led('Management Fee', 'Management fee October', { expense: '800' }), led('Owner Draw', 'Owner distribution', { expense: '3000' }), led('Owner Contribution', 'Owner contribution', { income: '500' })];
  const r = run([st('2026-10', 5000, { owner_draw: '2500', ending_balance: '7700' })], {}, ledger);
  assert.deepEqual(codes(r, '2026-10'), []);
  const off = run([st('2026-10', 5000, { owner_draw: '2500', ending_balance: '7700' })], {}, [...ledger, led('Owner Draw', 'Second distribution', { expense: '1000' })]);
  assert.deepEqual(codes(off, '2026-10'), ['distribution_differs']);
});

test('expenses and fees exported as negative numbers still add up; a real error is still an error', () => {
  const r = run([st('2026-10', 5000, { expenses: '-4000', management_fee: '-800' })]);
  assert.deepEqual(codes(r, '2026-10'), []); assert.equal(r.items[0].expenses, 4000); assert.equal(r.items[0].fee, 800);
  assert.deepEqual(codes(run([st('2026-10', 5000, { expenses: '-4000', management_fee: '-800', ending_balance: '9999' })]), '2026-10'), ['math_error']);
});

test('the math is allowed your tolerance and not a cent more', () => {
  assert.deepEqual(codes(run([st('2026-10', 5000, { ending_balance: '7201' })], { tolerance: 1 }), '2026-10'), []);
  assert.deepEqual(codes(run([st('2026-10', 5000, { ending_balance: '7201.01' })], { tolerance: 1 }), '2026-10'), ['math_error']);
});

test('a negative ending asks for enough to restore the reserve, and the property reserve beats the default', () => {
  const r = run([st('2026-10', -6000, { owner_draw: '0', ending_balance: '-800' })], { default_reserve: 1000, reserves: { 'MAPLE COURT': 2500 } });
  assert.deepEqual(codes(r, '2026-10'), ['negative_balance']); assert.equal(r.items[0].findings[0].amount, 3300);
  const d = run([st('2026-10', 0)], { default_reserve: 3000 }); assert.deepEqual(codes(d, '2026-10'), ['distribution_below_reserve']); assert.equal(d.items[0].findings[0].amount, 800);
});

test('with fee_pct in the policy, a fee that is not that share of income is pointed out', () => {
  assert.deepEqual(codes(run([st('2026-10', 5000)], { fee_pct: 8 }), '2026-10'), []);
  const r = run([st('2026-10', 5000, { management_fee: '1000', ending_balance: '7000' })], { fee_pct: 8 });
  assert.deepEqual(codes(r, '2026-10'), ['fee_rate_differs']); assert.match(r.items[0].findings[0].detail, /1000 is 10% of income 10000; your rate is 8% \(800\)/);
});

test('when the fee is already inside expenses it is not taken off twice', () => {
  const r = run([st('2026-10', 5000, { expenses: '4800', ending_balance: '7200' })], { fee_in_expenses: true }, [led('Receipt', 'Rent', { income: '10000' }), led('Bill', 'Plumbing', { expense: '4000' }), led('Management Fee', 'Management fee', { expense: '800' })]);
  assert.deepEqual(codes(r, '2026-10'), []);
});
