import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkVendors } from '../src/index.js';

const req = { default: { gl: true, wc: false, license: false, tax_id: true }, trades: { Roofing: { license: true, wc: true } }, warn_days: 30 };
const v = (extra = {}) => ({ vendor: 'Acme Roof', trade: 'Roofing', tax_id: '98-7654321', gl_expires: '2027-01-01', wc_expires: '2027-01-01', license_expires: '2027-01-01', ...extra });

test('trade requirements add to the default; expiring within warn_days is due soon', () => {
  assert.equal(checkVendors({ rows: [v()], req, asOf: '2026-06-01' }).items[0].status, 'ok');
  assert.equal(checkVendors({ rows: [v({ license_expires: '2026-06-20' })], req, asOf: '2026-06-01' }).items[0].status, 'due_soon');
  assert.ok(checkVendors({ rows: [v({ trade: 'Cleaning', wc_expires: '' })], req, asOf: '2026-06-01' }).items[0].status === 'ok');
});

test('payments on or after the day after expiry count as paid while out of compliance', () => {
  const r = checkVendors({ rows: [v({ gl_expires: '2026-05-31' })], req, asOf: '2026-06-15', payments: [{ payee: 'ACME ROOF', date: '2026-05-31', amount: '100' }, { payee: 'Acme Roof', date: '2026-06-01', amount: '250' }] });
  assert.equal(r.items[0].paid_while_noncompliant, 250);
});

test('the tax ID is masked in results', () => {
  assert.equal(checkVendors({ rows: [v()], req, asOf: '2026-06-01' }).items[0].tax_id, '••••••4321');
});
