// Vendor compliance: the edge cases an accounts payable lead would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkVendors, requestText } from '../src/index.js';

const req = (over = {}) => ({ warn_days: 30, default: { gl: true, tax_id: true }, trades: { Plumbing: { license: true }, Roofing: { wc: true } }, ...over });
const v = (over = {}) => ({ vendor: 'FlowRight Plumbing Inc', trade: 'Plumbing', tax_id: '12-3456781', gl_expires: '2027-03-31', wc_expires: '2027-03-31', license_expires: '2027-06-30', ...over });
const pay = (date, amount, payee = 'FlowRight Plumbing Inc', reference = '') => ({ payee, date, amount: String(amount), reference });
const run = (rows, payments = null, r = req()) => checkVendors({ rows, req: r, payments, asOf: '2026-11-15' });
const codes = (i) => i.findings.map((f) => f.code);

test('a vendor with two trades has to meet the requirements of both', () => {
  const r = run([v({ trade: 'Plumbing, Roofing', wc_expires: '', license_expires: '' })]);
  assert.deepEqual(codes(r.items[0]).sort(), ['license_missing', 'wc_missing']);
});

test('a payment on the last day of cover is fine; the day after is paid while out of compliance', () => {
  const r = run([v({ gl_expires: '2026-10-31' })], [pay('2026-10-31', 100), pay('2026-11-01', 250, undefined, 'ACH-1')]);
  const f = r.items[0].findings.find((x) => x.code === 'paid_while_noncompliant');
  assert.equal(f.amount, 250); assert.match(f.detail, /2026-11-01 250 \(ACH-1\)/); assert.doesNotMatch(f.detail, /2026-10-31/);
});

test('cover that ends today is expiring, not expired; the warning window has an exact edge', () => {
  assert.deepEqual(codes(run([v({ gl_expires: '2026-11-15' })]).items[0]), ['gl_expiring']);
  assert.deepEqual(codes(run([v({ gl_expires: '2026-12-15' })]).items[0]), ['gl_expiring']);
  assert.deepEqual(codes(run([v({ gl_expires: '2026-12-16' })]).items[0]), []);
  assert.deepEqual(codes(run([v({ gl_expires: '2026-11-14' })]).items[0]), ['gl_expired']);
});

test('a vendor listed twice is pointed out and its payments are counted once', () => {
  const r = run([v({ gl_expires: '2026-10-31' }), v({ vendor: 'Flowright Plumbing, Inc.', gl_expires: '2026-10-31' })], [pay('2026-11-05', 300)]);
  assert.match(r.summary, /Paid 300 to vendors while out of compliance/);
  assert.equal(r.items.filter((i) => codes(i).includes('duplicate_vendor')).length, 1);
});

test('a payee who was paid but is not in the vendor directory is listed', () => {
  const r = run([v()], [pay('2026-11-05', 300), pay('2026-11-06', 900, 'Cash Handyman (fictional)'), pay('2026-11-09', 100, 'Cash Handyman (fictional)')]);
  assert.deepEqual(r.unlisted_payees, [{ payee: 'Cash Handyman (fictional)', payments: 2, amount: 1000 }]);
  assert.match(r.summary, /1 payee\(s\) paid 1000 are not in the vendor directory/);
});

test('an exemption finds its vendor despite "Inc" and capitals, and covers only the named document', () => {
  const r = run([v({ gl_expires: '', license_expires: '' })], null, req({ exempt: { 'FLOWRIGHT PLUMBING': ['license'] } }));
  assert.deepEqual(codes(r.items[0]), ['gl_missing']);
});

test('a payment that was voided nets out and is not reported', () => {
  const r = run([v({ gl_expires: '2026-10-31' })], [pay('2026-11-05', 300), pay('2026-11-06', -300)]);
  assert.ok(!codes(r.items[0]).includes('paid_while_noncompliant')); assert.match(r.summary, /Paid 0 to vendors/);
});

test('the tax ID is masked in the result and never appears in the request to the vendor', () => {
  const r = run([v({ gl_expires: '2026-10-31' })]);
  assert.ok(!JSON.stringify(r).includes('12-3456781')); assert.match(r.items[0].tax_id, /6781$/);
  const text = requestText(r.items[0]); assert.ok(!text.includes('3456')); assert.match(text, /Liability insurance expired 2026-10-31 \(15 days ago\)/);
});
