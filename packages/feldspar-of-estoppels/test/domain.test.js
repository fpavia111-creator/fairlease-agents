// Estoppels: the edge cases a buyer's or lender's counsel would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEstoppels } from '../src/index.js';

const lease = (over = {}) => ({ lease_id: 'L-1', unit: 'Suite 100', tenant: 'Acme Bagels LLC', start: '2024-01-01', end: '2028-12-31', sqft: 2000, rent: { monthly: 5000 }, deposit: 5000, ...over });
const est = (over = {}) => ({ lease_id: 'L-1', unit: 'Suite 100', tenant: 'Acme Bagels LLC', rent: '5000', lease_start: '2024-01-01', lease_end: '2028-12-31', deposit: '5000', sqft: '2000', defaults: 'None', amendments: 'None', options: 'None', signed: '2026-11-01', ...over });
const check = (estoppels, leases = [lease()], policy = {}) => checkEstoppels({ leases: { leases }, estoppels, policy, asOf: '2026-11-17' });
const codes = (i) => i.findings.map((f) => f.code);

test('"None known", "No defaults" and "Not aware of any" are not claims of default', () => {
  for (const d of ['None known', 'No defaults', 'None to Tenant\'s knowledge.', 'Tenant is not aware of any', 'N/A']) assert.deepEqual(codes(check([est({ defaults: d })]).items[0]), [], d);
  assert.deepEqual(codes(check([est({ defaults: 'Landlord has not repaired the roof leak reported in June.' })]).items[0]), ['default_claimed']);
  assert.deepEqual(codes(check([est({ defaults: 'No heat since October; landlord notified twice.' })]).items[0]), ['default_claimed']);
});

test('an estoppel signed by someone other than the tenant on the lease is a discrepancy (assignment or sublease?)', () => {
  const r = check([est({ tenant: 'Bagel Brothers Holdings Inc' })]);
  assert.deepEqual(codes(r.items[0]), ['tenant_differs']); assert.equal(r.items[0].status, 'discrepancy');
  assert.deepEqual(codes(check([est({ tenant: 'ACME BAGELS' })]).items[0]), []);
});

test('the lease id is matched whatever its case; the unit is matched whatever its spelling', () => {
  assert.equal(check([est({ lease_id: 'l-1' })]).items[0].status, 'clean');
  assert.equal(check([est({ lease_id: '', unit: 'Ste. 0100' })]).items[0].status, 'clean');
});

test('the tenant saying "none" when the lease file has amendments is to be confirmed', () => {
  const r = check([est()], [lease({ amendments: [{ date: '2025-03-01', summary: 'Expansion' }] })]);
  assert.deepEqual(codes(r.items[0]), ['amendment_not_confirmed']); assert.equal(r.items[0].status, 'follow_up');
});

test('a month-to-month holdover tenant is still asked for an estoppel', () => {
  const r = check([], [lease({ end: '2026-06-30', notes: 'Month-to-month holdover since July 2026' }), lease({ lease_id: 'L-2', unit: 'Suite 200', tenant: 'Gone Co', end: '2026-06-30' })]);
  assert.deepEqual(r.items.map((i) => [i.lease_id, codes(i)]), [['L-1', ['not_returned']]]);
});

test('an estoppel is too old one day past the limit, measured to closing, and one dated after today is questioned', () => {
  const p = { closing: '2026-12-15', max_age_days: 30 };
  assert.deepEqual(codes(check([est({ signed: '2026-11-15' })], [lease()], p).items[0]), []);
  assert.deepEqual(codes(check([est({ signed: '2026-11-14' })], [lease()], p).items[0]), ['stale']);
  assert.deepEqual(codes(check([est({ signed: '2026-12-01' })], [lease()], p).items[0]), ['signed_in_future']);
});

test('coverage is by leased area and compared with the required percentage', () => {
  const r = check([est()], [lease(), lease({ lease_id: 'L-2', unit: 'Suite 200', tenant: 'Big Box Inc', sqft: 6000 })], { required_pct: 75, major_sqft: 5000 });
  assert.equal(r.coverage.pct_returned, 25); assert.equal(r.coverage.meets_requirement, false);
  assert.deepEqual(codes(r.items.find((i) => i.lease_id === 'L-2')), ['major_tenant_missing']);
});

test('rent is compared with the lease rent on the as-of date, after a step', () => {
  const stepped = lease({ rent: { monthly: 5000, steps: [{ from: '2026-07-01', monthly: 5150 }] } });
  assert.deepEqual(codes(check([est()], [stepped]).items[0]), ['rent_differs']);
  assert.deepEqual(codes(check([est({ rent: '5,150.00' })], [stepped]).items[0]), []);
});
