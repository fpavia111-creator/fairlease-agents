// Rent roll against leases: the edge cases an asset manager or a buyer would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRentRoll } from '../src/index.js';

const lease = (over = {}) => ({ lease_id: 'A', unit: '101', tenant: 'Ann Example', start: '2025-01-01', end: '2026-12-31', sqft: 700, rent: { monthly: 1000 }, deposit: 1000, ...over });
const row = (over = {}) => ({ unit: '101', tenant: 'Ann Example', rent: '1000', deposit: '1000', sqft: '700', ...over });
const check = (rows, leases, asOf = '2026-06-15', extra = {}) => checkRentRoll({ rows, leases: { leases }, asOf, ...extra });
const codes = (i) => i.findings.map((f) => f.code);

test('the same unit number in two properties is checked against its own property\'s lease', () => {
  const leases = [lease({ property: 'Maple Court' }), lease({ lease_id: 'B', property: 'Birch Row', tenant: 'Bo Sample', rent: { monthly: 1500 }, deposit: 1500 })];
  const r = check([row({ property: 'Birch Row', tenant: '', rent: '1500', deposit: '1500' }), row({ property: 'Maple Court', tenant: '' })], leases);
  assert.deepEqual(r.items.map((i) => [i.property, i.lease_id, i.status]), [['Birch Row', 'B', 'ok'], ['Maple Court', 'A', 'ok']]);
});

test('a property name spelled a little differently still matches when there is only one property', () => {
  const r = check([row({ property: 'Maple Court Apartments' })], [lease({ property: 'Maple Court' })]);
  assert.equal(r.items[0].status, 'ok');
});

test('total and subtotal rows are not units', () => {
  const r = check([row(), { unit: 'Total', rent: '1000', deposit: '1000' }, { unit: 'Grand Total', rent: '1000' }, { unit: 'Subtotal Maple Court', rent: '1000' }], [lease()]);
  assert.equal(r.units, 1); assert.equal(r.rent_roll_monthly, 1000);
});

test('roommates listed together match a lease in one of their names', () => {
  assert.deepEqual(codes(check([row({ tenant: 'Ann Example, Bob Sample' })], [lease()]).items[0]), []);
  assert.deepEqual(codes(check([row({ tenant: 'Bob Sample & Ann Example' })], [lease()]).items[0]), []);
  assert.deepEqual(codes(check([row({ tenant: 'Carl Other' })], [lease()]).items[0]), ['tenant_mismatch']);
});

test('an occupied unit whose only lease starts later is said to be early, not to have no lease', () => {
  const r = check([row()], [lease({ start: '2026-08-01', end: '2027-07-31' })]);
  assert.deepEqual(codes(r.items[0]), ['lease_not_started']); assert.match(r.items[0].findings[0].detail, /starts 2026-08-01/);
});

test('free rent in the lease means no rent is expected that month, and the full rent the month after', () => {
  const l = lease({ free_rent: [{ from: '2026-06-01', to: '2026-06-30' }] });
  assert.deepEqual(codes(check([row({ rent: '0' })], [l]).items[0]), []);
  assert.deepEqual(codes(check([row({ rent: '0' })], [l], '2026-07-15').items[0]), ['rent_under_lease']);
});

test('a fixed escalation on the anniversary is expected from that day, not before', () => {
  const l = lease({ start: '2025-07-01', end: '2028-06-30', escalation: { type: 'fixed_pct', pct: 3, every_months: 12 } });
  const before = check([row()], [l], '2026-06-30').items[0]; const after = check([row()], [l], '2026-07-01').items[0];
  assert.equal(before.lease_rent, 1000); assert.equal(after.lease_rent, 1030); assert.deepEqual(codes(after), ['rent_under_lease']); assert.equal(after.difference, -30);
});

test('a letter of credit means no cash deposit is expected; cash held anyway is a mismatch', () => {
  const l = lease({ deposit_type: 'letter_of_credit', deposit: 5000 });
  assert.deepEqual(codes(check([row({ deposit: '0' })], [l]).items[0]), ['deposit_not_cash']);
  assert.deepEqual(codes(check([row({ deposit: '5000' })], [l]).items[0]), ['deposit_not_cash', 'deposit_mismatch']);
});
