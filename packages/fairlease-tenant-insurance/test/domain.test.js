// Tenant insurance: the edge cases a lease administrator would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptRecords } from 'fairlease-core';
import { checkInsurance, requestText, manifest } from '../src/index.js';

const lease = (over = {}) => ({ lease_id: 'L-1', unit: 'Suite 100', tenant: 'Acme Bagels LLC', start: '2025-01-01', end: '2029-12-31', insurance: { gl_per_occurrence: 1000000, gl_aggregate: 2000000, additional_insured: true }, ...over });
const cert = (over = {}) => ({ lease_id: 'L-1', unit: 'Suite 100', tenant: 'Acme Bagels LLC', insurer: 'Example Mutual', policy: 'GL-1', liability: '1000000', aggregate: '2000000', additional_insured: 'Yes', expires: '2027-03-01', ...over });
const check = (certs, leases = [lease()], extra = {}) => checkInsurance({ leases: { leases }, certs, asOf: '2026-11-17', ...extra });
const codes = (i) => i.findings.map((f) => f.code);

test('a certificate with no expiry date does not hide a dated one that is in force', () => {
  const r = check([cert({ policy: 'OLD', expires: '' }), cert()]);
  assert.equal(r.items[0].policy, 'GL-1'); assert.equal(r.items[0].status, 'ok');
  assert.deepEqual(codes(check([cert({ expires: '' })]).items[0]), ['expiry_missing']);
});

test('limits written as $1M, 2MM or 1,000K are read as amounts, not as missing', () => {
  const r = check([cert({ liability: '$1M', aggregate: '2MM' })]);
  assert.deepEqual(codes(r.items[0]), []); assert.equal(r.items[0].liability, 1000000);
  assert.deepEqual(codes(check([cert({ liability: '500K', aggregate: '1 million' })]).items[0]), ['liability_below', 'aggregate_below']);
  const { rows } = adaptRecords({ records: [{ Unit: 'Suite 100', 'Each Occurrence': '$1M', 'General Aggregate': '$2M', 'Additional Insured': 'Yes', 'Expiration Date': '2027-03-01' }] }, manifest.sources.certificates);
  assert.deepEqual(codes(check(rows).items[0]), []);
});

test('a lease id is matched without regard to case or spaces', () => {
  const r = check([cert({ lease_id: ' l-1 ', unit: '' })]);
  assert.equal(r.items[0].status, 'ok'); assert.equal(r.unmatched_certificates.length, 0);
});

test('a certificate that names a different insured than the tenant is flagged', () => {
  const r = check([cert({ tenant: 'Bagel Holdings of Ohio Inc' })]);
  assert.deepEqual(codes(r.items[0]), ['insured_name_differs']); assert.equal(r.items[0].status, 'issue');
  assert.deepEqual(codes(check([cert({ tenant: 'ACME BAGELS' })]).items[0]), []);
});

test('the expiry day itself is still covered; the day after is expired', () => {
  assert.deepEqual(codes(check([cert({ expires: '2026-11-17' })]).items[0]), ['expiring']);
  assert.deepEqual(codes(check([cert({ expires: '2026-11-16' })]).items[0]), ['expired']);
  assert.deepEqual(codes(check([cert({ expires: '2026-12-18' })]).items[0]), []);
});

test('a residential lease that only asks for renters liability is checked against that limit and no aggregate', () => {
  const l = lease({ insurance: { renters_liability: 100000 } });
  assert.deepEqual(codes(check([cert({ liability: '100,000', aggregate: '', additional_insured: '' })], [l]).items[0]), []);
  assert.deepEqual(codes(check([cert({ liability: '50000', aggregate: '', additional_insured: '' })], [l]).items[0]), ['liability_below']);
});

test('a certificate for a lease that has ended, or for no lease, is listed as unmatched and changes nothing', () => {
  const r = check([cert(), cert({ lease_id: 'L-9', unit: 'Suite 900', tenant: 'Gone Co' }), cert({ lease_id: 'L-0', unit: 'Suite 50', tenant: 'Old Tenant' })], [lease(), lease({ lease_id: 'L-0', unit: 'Suite 50', tenant: 'Old Tenant', end: '2026-01-31' })]);
  assert.equal(r.items.length, 1);
  assert.deepEqual(r.unmatched_certificates.map((c) => c.reason), ['matches no lease', 'lease L-0 not in force on the date (2025-01-01 to 2026-01-31)']);
});

test('the request repeats the lease requirement and never states a cure period or a fee', () => {
  const it = check([cert({ expires: '2026-10-01', additional_insured: 'No' })]).items[0];
  const text = requestText(it, {});
  assert.match(text, /Expired 2026-10-01/); assert.match(text, /1,000,000 per occurrence, 2,000,000 aggregate, additional insured/);
  assert.doesNotMatch(text, /default|fee|within \d+ days|terminate/i); assert.equal((text.match(/\[TO CONFIRM/g) || []).length, 4);
});
