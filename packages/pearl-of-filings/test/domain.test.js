// Year-end 1099 readiness: the edge cases a property accountant and their tax preparer would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFilings, w9RequestText } from '../src/index.js';

const ven = (over = {}) => ({ vendor: 'QuickFix Handyman', vendor_id: 'V-1', trade: 'General repairs', tax_id: '98-7654321', type_1099: 'Yes', w9_on_file: 'Yes', entity_type: 'Sole proprietor', address: '77 Elm Ave, Springfield', email: 'quickfix@example.com', ...over });
const pay = (amount, over = {}) => ({ payee: 'QuickFix Handyman', date: '2026-05-10', amount: String(amount), method: 'Check', account: '6510 Repairs', reference: '', ...over });
const run = (vendors, payments, threshold = 600) => checkFilings({ vendors, payments, taxYear: 2026, threshold });
const codes = (i) => i.findings.map((f) => f.code);

test('exactly at your threshold is reportable, a cent below is not, and a void takes its payment back out', () => {
  assert.equal(run([ven()], [pay(600)]).items[0].status, 'ready');
  assert.equal(run([ven()], [pay(599.99)]).items[0].status, 'below_threshold');
  const r = run([ven()], [pay(700), pay(-700, { date: '2026-05-12', reference: 'VOID' }), pay(300)]); assert.equal(r.items[0].total, 300); assert.equal(r.items[0].status, 'below_threshold');
});

test('card payments are left out of the total and said so', () => {
  const r = run([ven()], [pay(5000, { method: 'Credit Card' }), pay(500)]);
  assert.equal(r.items[0].total, 500); assert.equal(r.items[0].excluded, 5000); assert.equal(r.items[0].status, 'below_threshold'); assert.deepEqual(codes(r.items[0]), ['excluded_methods']);
  assert.equal(run([ven()], [pay(5000, { method: 'PayPal' })]).items[0].status, 'excluded_only');
});

test('the same payment in the file twice is pointed out before it inflates a 1099', () => {
  const r = run([ven()], [pay(400, { reference: '1001' }), pay(400, { reference: '1001' })]);
  assert.ok(codes(r.items[0]).includes('possible_duplicate_payments')); assert.equal(r.items[0].status, 'fix');
  assert.deepEqual(codes(run([ven()], [pay(400, { reference: '1001' }), pay(400, { reference: '1002' })]).items[0]), []);
});

test('for an owner the figure is flagged: a 1099 for rents usually reports rents collected, not what was distributed', () => {
  const r = run([ven({ vendor: 'Maple Court Holdings LLC', trade: 'Owner', entity_type: 'LLC' })], [pay(25000, { payee: 'Maple Court Holdings LLC', account: '3200 Owner distribution' })]);
  assert.equal(r.items[0].form, 'MISC'); assert.deepEqual(codes(r.items[0]), ['owner_rents_basis']); assert.equal(r.items[0].status, 'confirm');
});

test('a payee paid both rent and services gets both amounts shown, since they go in different boxes', () => {
  const r = run([ven()], [pay(900, { account: '6100 Rent - storage unit' }), pay(800)]);
  const f = r.items[0].findings.find((x) => x.code === 'rent_and_services'); assert.ok(f); assert.match(f.detail, /900 of rent and 800 of other payments/);
});

test('"Lease commissions" is a service, not rent', () => {
  const r = run([ven({ vendor: 'Harbor Leasing Brokers', trade: 'Leasing broker' })], [pay(4000, { payee: 'Harbor Leasing Brokers', account: '6800 Lease commissions' })]);
  assert.equal(r.items[0].form, 'NEC'); assert.equal(r.items[0].rent, 0);
});

test('two directory records with the same name and different tax IDs are not silently merged', () => {
  const r = run([ven(), ven({ vendor_id: 'V-2', tax_id: '11-2223334' })], [pay(900)]);
  assert.ok(codes(r.items[0]).includes('same_name_different_tin')); assert.equal(r.items[0].status, 'fix');
});

test('a payment with no payee is counted as skipped, and no result or W-9 request ever carries a full tax ID', () => {
  const r = run([ven({ w9_on_file: 'No' })], [pay(900), pay(50, { payee: '' })]);
  assert.equal(r.items.length, 1); assert.match(r.summary, /1 payment\(s\) had no payee and were skipped/);
  assert.ok(!JSON.stringify(r).includes('7654321')); assert.ok(!w9RequestText(r.items[0]).includes('7654'));
});
