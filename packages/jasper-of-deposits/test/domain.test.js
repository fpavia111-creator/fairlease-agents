// Security deposits: the edge cases a property manager would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDeposits, unpaidAt, statementText } from '../src/index.js';

const mo = (over = {}) => ({ unit: '204', tenant: 'Wren Adler', move_out: '2026-09-30', move_in: '2024-10-01', deposit_held: 2000, forwarding_address: '14 Birch Lane, Springfield (fictional)', ...over });
const ded = (item, amount, over = {}) => ({ unit: '204', tenant: 'Wren Adler', item, category: 'damage', amount: String(amount), evidence: 'photo.jpg', ...over });
const check = (moveOuts, deductions = [], extra = {}, rules = {}) => checkDeposits({ config: { rules: { return_days: 30, ...rules }, move_outs: moveOuts }, deductions, asOf: '2026-10-10', ...extra });
const codes = (i) => i.findings.map((f) => f.code);

test('an eight-year-old carpet with a ten-year life can only be charged at one fifth; past its life nothing', () => {
  const r = check([mo()], [ded('Replace carpet', 1500, { age_years: '8', useful_life_years: '10' }), ded('Replace blinds', 200, { age_years: '9', useful_life_years: '7' })]);
  assert.deepEqual(r.items[0].lines.map((l) => l.allowed), [300, 0]); assert.equal(r.items[0].refund, 1700);
  assert.deepEqual(codes(r.items[0]), ['useful_life_proration']); assert.equal(r.items[0].status, 'ready');
});

test('a payment after move-out lowers the unpaid balance; charges after move-out are left to the deductions file', () => {
  const ledger = [{ unit: '204', tenant: 'Wren Adler', date: '2026-09-01', charge_code: 'RENT', charge: '1850' }, { unit: '204', tenant: 'Wren Adler', date: '2026-10-03', charge_code: 'PMT', payment: '1000' }, { unit: '204', tenant: 'Wren Adler', date: '2026-10-05', charge_code: 'DMG', description: 'Carpet', charge: '400' }];
  assert.equal(unpaidAt(ledger, mo(), {}, '2026-10-10'), 850);
  const r = check([mo()], [], { ledger }); assert.equal(r.items[0].unpaid, 850); assert.equal(r.items[0].refund, 1150);
});

test('a credit balance on the ledger is owed back with the deposit, not dropped', () => {
  const ledger = [{ unit: '204', tenant: 'Wren Adler', date: '2026-09-01', charge_code: 'RENT', charge: '1850' }, { unit: '204', tenant: 'Wren Adler', date: '2026-09-02', charge_code: 'PMT', payment: '2000' }];
  const r = check([mo()], [], { ledger });
  assert.deepEqual(codes(r.items[0]), ['credit_balance']); assert.equal(r.items[0].refund, 2150); assert.equal(r.items[0].status, 'ready');
  assert.match(statementText(r.items[0]), /Credit balance on your account: 150\.00/);
});

test('a single-amount ledger with payments as positive amounts coded PMT still nets to the right balance', () => {
  const ledger = [{ unit: '204', date: '2026-09-01', charge_code: 'RENT', amount: '1850' }, { unit: '204', date: '2026-09-03', charge_code: 'PMT', description: 'Payment', amount: '1850' }, { unit: '204', date: '2026-09-10', charge_code: 'UTIL', amount: '60' }];
  assert.equal(unpaidAt(ledger, mo()), 60);
});

test('two move-outs from the same unit in one year do not both get an unnamed deduction', () => {
  const r = check([mo({ tenant: 'Ann Example', move_out: '2026-03-31', returned_on: '2026-04-15', returned_amount: 2000 }), mo()], [ded('Move-out cleaning', 250, { tenant: '' })]);
  const by = Object.fromEntries(r.items.map((i) => [i.tenant, i.deducted]));
  assert.deepEqual(by, { 'Ann Example': 0, 'Wren Adler': 250 });
  assert.match(r.items.find((i) => i.tenant === 'Wren Adler').findings.map((f) => f.code).join(' '), /deduction_tenant_assumed/);
});

test('the same deduction entered twice is pointed out', () => {
  const r = check([mo()], [ded('Replace lost keys', 75), ded('Replace lost keys', 75)]);
  assert.ok(codes(r.items[0]).includes('duplicate_deduction')); assert.equal(r.items[0].status, 'review');
});

test('a move-in date after the move-out is a data error, and no negative interest is worked out', () => {
  const r = check([mo({ move_in: '2027-01-01' })], [], {}, { interest_pct: 2 });
  assert.ok(codes(r.items[0]).includes('dates_out_of_order')); assert.equal(r.items[0].interest, 0); assert.equal(r.items[0].refund, 2000);
});

test('the deadline counts from the move-out date: the last day is not late, the day after is', () => {
  const on = check([mo({ returned_on: '2026-10-30', returned_amount: 2000 })]); assert.deepEqual(codes(on.items[0]), []); assert.equal(on.items[0].status, 'done');
  const late = check([mo({ returned_on: '2026-10-31', returned_amount: 2000 })]); assert.deepEqual(codes(late.items[0]), ['returned_late']);
  const open = checkDeposits({ config: { rules: { return_days: 30 }, move_outs: [mo()] }, deductions: [], asOf: '2026-10-31' }); assert.equal(open.items[0].status, 'overdue');
});
