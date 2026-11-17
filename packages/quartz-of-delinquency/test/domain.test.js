// Delinquency: the edge cases a collections lead would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDelinquency, reminderText } from '../src/index.js';

const L = (date, over = {}) => ({ unit: '101', tenant: 'Aiko Tanaka', date, ...over });
const rent = (date, amount = 1400, over = {}) => L(date, { charge_code: 'RENT', description: 'Rent', charge: String(amount), ...over });
const paid = (date, amount, over = {}) => L(date, { charge_code: 'PMT', description: 'Payment', payment: String(amount), ...over });
const leases = { leases: [{ lease_id: 'MC-101', unit: '101', tenant: 'Aiko Tanaka', start: '2025-12-01', end: '2026-11-30', rent: { monthly: 1400 }, deposit: 1400 }] };
const run = (rows, policy = {}, extra = {}) => checkDelinquency({ ledgerRows: rows, policy, asOf: '2026-11-15', ...extra });
const codes = (i) => i.findings.map((f) => f.code);

test('a payment that bounced puts the rent back on the books from its own due date', () => {
  const r = run([rent('2026-10-01'), paid('2026-10-03', 1400), paid('2026-10-09', -1400, { description: 'NSF returned payment' })]);
  assert.equal(r.items[0].status, 'delinquent'); assert.equal(r.items[0].balance, 1400); assert.equal(r.items[0].oldest_days, 45); assert.equal(r.items[0].stage, 'manager_review');
});

test('a returned-payment line in the charges column reverses the payment, and the NSF fee is not judged as a late fee', () => {
  const r = run([rent('2026-11-01'), paid('2026-11-02', 1400), L('2026-11-06', { charge_code: 'NSF', description: 'Returned payment', charge: '1400' }), L('2026-11-06', { charge_code: 'NSF', description: 'NSF fee', charge: '35' })], { grace_days: 5, late_fee: { type: 'flat', amount: 50 } }, { leases });
  assert.equal(r.items[0].balance, 1435); assert.ok(!codes(r.items[0]).includes('late_fee_over_policy')); assert.equal(r.items[0].oldest_days, 14);
});

test('without a leases file, "Apt 101 / AIKO TANAKA" and "101 / Aiko Tanaka" are one tenant', () => {
  const r = run([rent('2026-11-01'), paid('2026-11-03', 1400, { unit: 'Apt 101', tenant: 'AIKO TANAKA' })]);
  assert.equal(r.items.length, 1); assert.equal(r.items[0].status, 'current');
});

test('a late fee is held to the lower of the percentage and the maximum in your policy', () => {
  const rows = [rent('2026-10-01'), L('2026-10-08', { charge_code: 'LATE', description: 'Late fee', charge: '90' }), paid('2026-10-20', 1490)];
  const r = run(rows, { grace_days: 5, late_fee: { type: 'pct', pct: 5, max: 100 } }, { leases });
  const f = r.items[0].findings.find((x) => x.code === 'late_fee_over_policy'); assert.ok(f); assert.equal(f.amount, 20); assert.equal(r.items[0].status, 'issue');
  assert.deepEqual(codes(run(rows, { grace_days: 5, late_fee: { type: 'pct', pct: 10, max: 100 } }, { leases }).items[0]), []);
});

test('a payment plan pauses reminders only for the tenant it names, and an ended plan is said to have ended', () => {
  const rows = [rent('2026-10-01')];
  const other = run(rows, { payment_plans: [{ unit: '101', tenant: 'Previous Tenant', until: '2026-12-31' }] }); assert.equal(other.items[0].stage, 'manager_review');
  const on = run(rows, { payment_plans: [{ unit: 'Apt 101', tenant: 'Aiko Tanaka', until: '2026-12-31', note: '200 a week' }] }); assert.equal(on.items[0].stage, 'on_plan');
  const ended = run(rows, { payment_plans: [{ unit: '101', until: '2026-11-01' }] }); assert.equal(ended.items[0].stage, 'manager_review'); assert.ok(codes(ended.items[0]).includes('payment_plan_ended'));
});

test('rent paid on the last day of grace must not carry a late fee; a day later it may', () => {
  const policy = { grace_days: 5, late_fee: { type: 'flat', amount: 50 } };
  const inGrace = run([rent('2026-11-01'), L('2026-11-07', { charge_code: 'LATE', description: 'Late fee', charge: '50' }), paid('2026-11-06', 1400)], policy);
  assert.deepEqual(codes(inGrace.items[0]), ['late_fee_in_grace']); assert.equal(inGrace.items[0].fee_adjustment, 50);
  const late = run([rent('2026-11-01'), L('2026-11-07', { charge_code: 'LATE', description: 'Late fee', charge: '50' }), paid('2026-11-07', 1450)], policy);
  assert.deepEqual(codes(late.items[0]), []);
  const none = run([rent('2026-11-01'), paid('2026-11-09', 1400)], policy); assert.deepEqual(codes(none.items[0]), ['late_fee_not_charged']);
});

test('payments clear the oldest charge first, so what stays open is the newest', () => {
  const r = run([rent('2026-09-01'), rent('2026-10-01'), rent('2026-11-01'), paid('2026-11-10', 2000)]);
  assert.deepEqual(r.items[0].open.map((o) => [o.date, o.open]), [['2026-10-01', 800], ['2026-11-01', 1400]]);
  assert.equal(r.items[0].b_31_60 ?? r.items[0]['b_31-60'], 800); assert.equal(r.items[0].oldest_days, 45);
});

test('the reminder is a courtesy note with the open charges; small balances get none', () => {
  const r = run([rent('2026-11-01', 1500)], { min_balance: 25 }, { leases });
  assert.ok(codes(r.items[0]).includes('balance_over_deposit'));
  const text = reminderText(r.items[0], { as_of: '2026-11-15' }); assert.match(text, /This is a courtesy reminder, not a legal notice\./); assert.match(text, /\| 2026-11-01 \| rent \| 1,500\.00 \|/);
  const small = run([rent('2026-11-01'), paid('2026-11-02', 1390)], { min_balance: 25 }); assert.equal(small.items[0].status, 'below_minimum'); assert.equal(small.items[0].stage, null);
});
