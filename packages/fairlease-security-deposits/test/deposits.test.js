import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDeposits, unpaidAt } from '../src/index.js';

const cfg = (rules = {}, mo = {}) => ({ rules: { return_days: 21, ...rules }, move_outs: [{ unit: '7', tenant: 'Bo', move_out: '2026-10-01', move_in: '2025-10-01', deposit_held: 1000, forwarding_address: 'x', ...mo }] });
const ded = (item, amount, extra = {}) => ({ unit: '7', tenant: 'Bo', item, amount: String(amount), evidence: 'photo', ...extra });

test('refund is deposit plus interest less deductions; the deadline is move-out plus return_days', () => {
  const r = checkDeposits({ config: cfg({ interest_pct: 2 }), deductions: [ded('Cleaning', 100)], asOf: '2026-10-10' });
  const i = r.items[0];
  assert.equal(i.interest, 20); assert.equal(i.refund, 920); assert.equal(i.deadline, '2026-10-22'); assert.equal(i.status, 'ready');
});

test('age and useful life prorate a replacement', () => {
  const i = checkDeposits({ config: cfg(), deductions: [ded('Carpet', 1000, { age_years: '3', useful_life_years: '5' })], asOf: '2026-10-02' }).items[0];
  assert.equal(i.deducted, 400);
});

test('wear words and missing support make it review; your own wear words replace the defaults', () => {
  const i = checkDeposits({ config: cfg(), deductions: [ded('Nail holes', 50, { evidence: '' })], asOf: '2026-10-02' }).items[0];
  assert.deepEqual(i.findings.map((f) => f.code).sort(), ['no_evidence', 'possible_normal_wear']); assert.equal(i.status, 'review');
  const j = checkDeposits({ config: cfg({ wear_words: ['sun fade'] }), deductions: [ded('Nail holes', 50)], asOf: '2026-10-02' }).items[0];
  assert.equal(j.status, 'ready');
});

test('past the deadline with nothing sent is overdue; sent late is returned_late', () => {
  assert.equal(checkDeposits({ config: cfg(), deductions: [], asOf: '2026-11-01' }).items[0].status, 'overdue');
  const late = checkDeposits({ config: cfg({}, { returned_on: '2026-10-25', returned_amount: 1000 }), deductions: [], asOf: '2026-11-01' }).items[0];
  assert.ok(late.findings.some((f) => f.code === 'returned_late'));
});

test('unpaid balance ignores deposit rows and rows after move-out', () => {
  const rows = [{ unit: '7', date: '2026-09-01', charge_code: 'RENT', charge: '1000' }, { unit: '7', date: '2026-09-02', charge_code: 'PMT', payment: '900' }, { unit: '7', date: '2025-10-01', charge_code: 'SECDEP', charge: '1000' }, { unit: '7', date: '2026-10-05', charge_code: 'RENT', charge: '1000' }];
  assert.equal(unpaidAt(rows, { unit: '7', move_out: '2026-10-01' }), 100);
});
