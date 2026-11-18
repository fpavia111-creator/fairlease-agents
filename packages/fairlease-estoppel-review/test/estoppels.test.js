import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEstoppels, requestText } from '../src/estoppels.js';

const leases = { leases: [
  { lease_id: 'A', unit: '1', tenant: 'Alpha', start: '2024-01-01', end: '2029-12-31', sqft: 6000, deposit: 1000, rent: { monthly: 1000 }, options: [{ type: 'renewal' }] },
  { lease_id: 'B', unit: '2', tenant: 'Beta', start: '2024-01-01', end: '2029-12-31', sqft: 4000, deposit: 500, rent: { monthly: 500 } },
] };
const asOf = '2026-11-15';
const A = (r) => r.items.find((i) => i.lease_id === 'A');
const est = (o) => ({ lease_id: 'A', rent: 1000, lease_start: '2024-01-01', lease_end: '2029-12-31', deposit: 1000, sqft: 6000, defaults: 'None', options: 'One renewal', signed: '2026-11-10', ...o });

test('a matching estoppel is clean and counts toward coverage', () => {
  const r = checkEstoppels({ leases, estoppels: [est({})], policy: { required_pct: 50 }, asOf });
  assert.equal(r.items.find((i) => i.lease_id === 'A').status, 'clean');
  assert.equal(r.coverage.pct_returned, 60); assert.equal(r.coverage.meets_requirement, true);
});

test('major tenants missing are named as such', () => {
  const r = checkEstoppels({ leases, estoppels: [], policy: { major_sqft: 5000 }, asOf });
  assert.equal(r.items.find((i) => i.lease_id === 'A').findings[0].code, 'major_tenant_missing');
  assert.equal(r.items.find((i) => i.lease_id === 'B').findings[0].code, 'not_returned');
});

test('defaults are read as stated, "none" in any language is not a claim', () => {
  for (const v of ['None', 'keine', 'Aucun', 'ninguno', 'なし', '없음', 'N/A']) assert.equal(A(checkEstoppels({ leases, estoppels: [est({ defaults: v })], asOf })).status, 'clean', v);
  assert.equal(A(checkEstoppels({ leases, estoppels: [est({ defaults: 'Roof leaks unrepaired' })], asOf })).findings[0].code, 'default_claimed');
});

test('differences in rent, dates, deposit, area and options', () => {
  const it = A(checkEstoppels({ leases, estoppels: [est({ rent: 1100, lease_end: '2030-12-31', deposit: 0, sqft: 6100, options: 'None' })], asOf }));
  assert.deepEqual(it.findings.map((f) => f.code), ['rent_differs', 'expiration_differs', 'deposit_differs', 'area_differs', 'option_not_confirmed']);
});

test('age is measured to closing; latest estoppel wins', () => {
  const r = checkEstoppels({ leases, estoppels: [est({ signed: '2026-09-01' }), est({ signed: '2026-11-10' })], policy: { closing: '2026-12-15', max_age_days: 45 }, asOf });
  assert.equal(A(r).status, 'clean');
  const old = A(checkEstoppels({ leases, estoppels: [est({ signed: '2026-10-01' })], policy: { closing: '2026-12-15', max_age_days: 45 }, asOf }));
  assert.equal(old.findings[0].code, 'stale'); assert.equal(old.status, 'follow_up');
  assert.equal(A(checkEstoppels({ leases, estoppels: [est({ signed: '' })], asOf })).findings[0].code, 'unsigned');
});

test('rent roll differences are shown beside the estoppel', () => {
  const it = checkEstoppels({ leases, estoppels: [est({})], rentRoll: [{ unit: '1', rent: 950 }], asOf }).items.find((i) => i.lease_id === 'A');
  assert.equal(it.findings[0].code, 'rent_roll_differs');
});

test('follow-up wording fits the case', () => {
  const r = checkEstoppels({ leases, estoppels: [est({ rent: 1200 })], asOf });
  assert.match(requestText(r.items.find((i) => i.lease_id === 'A')), /differ from our lease records/);
  assert.match(requestText(r.items.find((i) => i.lease_id === 'B')), /complete, sign and return/);
});
