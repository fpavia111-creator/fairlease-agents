import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRentRoll } from '../src/index.js';

const leases = { leases: [{ lease_id: 'A', unit: 'Unit 1', tenant: 'Ann Example', start: '2025-01-01', end: '2025-12-31', sqft: 700, rent: { monthly: 1000 }, deposit: 1000 }] };
const row = (extra = {}) => ({ unit: '1', tenant: 'Ann Example', rent: '1000', deposit: '1000', sqft: '700', ...extra });
const check = (rows, asOf = '2025-06-01', extra = {}) => checkRentRoll({ rows, leases, asOf, ...extra });

test('a matching unit is ok; unit spellings and tenant legal forms match', () => {
  assert.equal(check([row({ unit: 'Apt 01' })]).items[0].status, 'ok');
});

test('tolerance absorbs cents but not a missed increase', () => {
  assert.equal(check([row({ rent: '1000.6' })]).items[0].status, 'ok');
  assert.equal(check([row({ rent: '1000.6' })], '2025-06-01', { tolerance: 0.1 }).items[0].findings[0].code, 'rent_over_lease');
});

test('after the lease ends an occupied unit is a holdover; a vacant unit with a lease is flagged', () => {
  assert.equal(check([row()], '2026-02-01').items[0].findings[0].code, 'holdover');
  assert.equal(check([row({ tenant: '', rent: '', status: 'Vacant-Unrented' })]).items[0].findings[0].code, 'vacant_with_lease');
});

test('charge rows are summed per unit and continuation rows with a blank unit belong to the unit above', () => {
  const r = check([{ unit: '1', tenant: 'Ann Example', charge_code: 'RNT', charge_amount: '900' }, { unit: '', charge_code: 'RNTADJ', charge_amount: '100' }, { unit: '', charge_code: 'PET', charge_amount: '35' }]);
  assert.equal(r.units, 1); assert.equal(r.items[0].rent_roll_rent, 1000); assert.equal(r.items[0].status, 'ok');
});

test('learned charge codes (aliases) are used', () => {
  const r = check([{ unit: '1', tenant: 'Ann Example', charge_code: 'ZZBASE', charge_amount: '1000' }], '2025-06-01', { aliases: { ZZBASE: 'rent' } });
  assert.equal(r.items[0].rent_roll_rent, 1000);
});

test('a lease in force with no rent roll row is reported', () => {
  const r = check([{ unit: '2', tenant: '', status: 'Vacant' }]);
  assert.ok(r.items.some((i) => i.findings.some((f) => f.code === 'missing_from_rent_roll')));
});
