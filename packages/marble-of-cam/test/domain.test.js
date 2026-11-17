// CAM reconciliation: the edge cases a commercial property accountant would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile } from '../src/index.js';

const cam = (over = {}) => ({ property: 'HPP', year: 2025, rentable_sqft: 10000, pools: [{ name: 'Common area', accounts: ['6100'], controllable: true, variable: true }, { name: 'Real estate taxes', accounts: ['6700'] }], ...over });
const lease = (over = {}) => ({ lease_id: 'L-1', property: 'HPP', unit: 'Suite 100', tenant: 'Acme Bagels LLC', sqft: 1000, start: '2024-01-01', end: '2027-12-31', cam: { monthly_estimate: 500 }, ...over });
const gl = (account, amount, over = {}) => ({ account, date: '2025-06-15', amount: String(amount), ...over });
const GL = [gl('6100', 60000), gl('6700', 40000)];
const codes = (x) => x.map((f) => f.code);

test('GL lines dated outside the CAM year are left out and counted', () => {
  const r = reconcile({ leases: { leases: [lease()] }, cam: cam(), gl: [...GL, gl('6100', 9000, { date: '2024-12-31' }), gl('6700', 5000, { date: '2026-01-02' })] });
  assert.equal(r.pools_total, 100000); assert.equal(r.items[0].gross_share, 10000);
  assert.deepEqual(codes(r.property_findings), ['gl_outside_year']); assert.match(r.property_findings[0].detail, /2 GL line\(s\) dated outside 2025 \(14000\) were left out/);
});

test('leases and GL lines that belong to another property are not reconciled against this one', () => {
  const r = reconcile({ leases: { leases: [lease(), lease({ lease_id: 'L-9', property: 'BRA', unit: 'Suite 9' })] }, cam: cam(), gl: [...GL.map((g) => ({ ...g, property: 'HPP' })), gl('6100', 7000, { property: 'BRA' })] });
  assert.deepEqual(r.items.map((i) => i.lease_id), ['L-1']); assert.equal(r.pools_total, 100000);
  assert.ok(codes(r.property_findings).includes('other_property_rows'));
});

test('two tenants in the same suite one after the other do not push the shares over 100%', () => {
  const big = { sqft: 6000 };
  const r = reconcile({ leases: { leases: [lease({ ...big, end: '2025-06-30' }), lease({ ...big, lease_id: 'L-2', tenant: 'Next Tenant Inc', start: '2025-07-01' })] }, cam: cam(), gl: GL });
  assert.deepEqual(codes(r.property_findings), []); assert.equal(r.shares_total_pct, 60);
  const over = reconcile({ leases: { leases: [lease(big), lease({ ...big, lease_id: 'L-2', unit: 'Suite 200' })] }, cam: cam(), gl: GL });
  assert.deepEqual(codes(over.property_findings), ['shares_over_100']);
});

test('an expense stop above the tenant share plus a cap never produces a negative charge', () => {
  // Share 10000, of which 6000 controllable capped at 1030: 5030 left. A 40000 stop is 4000 for this tenant: 1030 due.
  const l = lease({ cam: { monthly_estimate: 0, base_year: 2024, base_amount: 40000, cap: { type: 'cumulative', pct: 3, base_year: 2024, base_amount: 1000 } } });
  const r = reconcile({ leases: { leases: [l] }, cam: cam(), gl: GL });
  assert.equal(r.items[0].cap_reduction, 4970); assert.equal(r.items[0].total_due, 1030);
  const all = reconcile({ leases: { leases: [lease({ cam: { ...l.cam, base_amount: 99000 } })] }, cam: cam(), gl: GL });
  assert.equal(all.items[0].total_due, 0); assert.equal(all.items[0].balance, 0);
});

test('an excluded pool is matched whatever its capitals; a name that is no pool sends the lease to review', () => {
  const r = reconcile({ leases: { leases: [lease({ cam: { excluded_pools: ['real estate TAXES '] } })] }, cam: cam(), gl: GL });
  assert.equal(r.items[0].gross_share, 6000); assert.deepEqual(codes(r.items[0].findings), ['pool_excluded', 'estimates_from_lease']);
  const bad = reconcile({ leases: { leases: [lease({ cam: { excluded_pools: ['Taxes'] } })] }, cam: cam(), gl: GL });
  assert.equal(bad.items[0].status, 'review'); assert.ok(codes(bad.items[0].findings).includes('unknown_excluded_pool'));
});

test('billed estimates are found when the lease id is typed differently or the charge code is a GL number', () => {
  const billed = [{ lease_id: 'l1', date: '2025-01-01', charge_code: 'CAM', charge: '500' }, { lease_id: 'L-1', date: '2025-02-01', charge_code: '4100-00', description: 'CAM estimate', charge: '500' }, { lease_id: 'L-1', date: '2025-02-03', charge_code: 'CAM', payment: '500' }];
  const r = reconcile({ leases: { leases: [lease()] }, cam: cam(), gl: GL, billedRows: billed });
  assert.equal(r.items[0].billed, 1000); assert.equal(r.items[0].balance, 9000);
});

test('a GL account listed in two pools is pointed out, since only the first pool gets it', () => {
  const c = cam({ pools: [{ name: 'Common area', accounts: ['6100', '6700'] }, { name: 'Real estate taxes', accounts: ['67*'] }] });
  const r = reconcile({ leases: { leases: [lease()] }, cam: c, gl: GL });
  assert.deepEqual(codes(r.property_findings), ['account_in_two_pools']); assert.match(r.property_findings[0].detail, /6700 is in Common area and Real estate taxes/);
});

test('a tenant who moved in on 1 July pays 184 of 365 days, and a building above the gross-up target is not grossed down', () => {
  const r = reconcile({ leases: { leases: [lease({ start: '2025-07-01' })] }, cam: cam({ occupancy_pct: 98, gross_up_to_pct: 95 }), gl: GL });
  assert.equal(r.items[0].occupied_days, 184); assert.equal(r.items[0].gross_share, 5041.1);
  assert.ok(!codes(r.items[0].findings).includes('gross_up_applied'));
});
