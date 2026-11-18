// Unit turns: the edge cases a property manager would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTurns } from '../src/index.js';

const line = (over = {}) => ({ property: 'Maple Court', unit: '202', move_out: '2026-10-01', ready: '2026-10-06', move_in: '2026-10-15', category: 'Paint', vendor: 'BrightWall', cost: '500', chargeable: 'No', rent: '1500', ...over });
const check = (rows, policy = {}) => checkTurns({ rows, policy, asOf: '2026-11-17' });
const codes = (i) => i.findings.map((f) => f.code);

test('the bedroom budget is found whatever way the unit is written', () => {
  const r = check([line({ unit: 'Apt 0202', cost: '1500' })], { budget: { 1: 1200 }, unit_bedrooms: { 202: 1 } });
  assert.equal(r.items[0].budget, 1200); assert.deepEqual(codes(r.items[0]), ['over_budget']);
  assert.match(r.items[0].findings[0].detail, /1200 budget for a 1-bedroom unit/);
});

test('the default budget is named as the default, not as an "undefined-bedroom" budget', () => {
  const r = check([line({ cost: '1500' })], { default_budget: 1000 });
  assert.match(r.items[0].findings[0].detail, /over your default budget of 1000/); assert.doesNotMatch(r.items[0].findings[0].detail, /undefined/);
});

test('the same unit number in two properties is two turns', () => {
  const r = check([line(), line({ property: 'Harbor Flats', cost: '300' })]);
  assert.equal(r.items.length, 2); assert.deepEqual(r.items.map((i) => i.cost).sort(), [300, 500]);
});

test('a cost line with no dates belongs to the turn above it for the same unit', () => {
  const r = check([line(), line({ move_out: '', ready: '', move_in: '', category: 'Cleaning', cost: '200' })]);
  assert.equal(r.items.length, 1); assert.equal(r.items[0].cost, 700); assert.deepEqual(codes(r.items[0]), []);
});

test('dates in the wrong order are reported, and never produce negative days or negative rent lost', () => {
  const r = check([line({ ready: '2026-09-28' }), line({ unit: '203', move_in: '2026-09-20' })]);
  for (const i of r.items) { assert.ok(codes(i).includes('dates_out_of_order')); assert.equal(i.status, 'issue'); assert.ok(i.rent_lost === null || i.rent_lost >= 0); }
  assert.equal(r.average_days_to_ready, 5);
});

test('the target is met on the last day and missed the day after', () => {
  assert.deepEqual(codes(check([line({ ready: '2026-10-08' })]).items[0]), []);
  assert.deepEqual(codes(check([line({ ready: '2026-10-09' })]).items[0]), ['over_target']);
});

test('"Tenant" and "Resident" mean chargeable, "Owner" does not, and anything else is unknown', () => {
  const r = check([line({ chargeable: 'Tenant' }), line({ category: 'Carpet', chargeable: 'Owner' }), line({ category: 'Keys', chargeable: 'see notes' })]);
  assert.deepEqual(r.items[0].lines.map((l) => l.chargeable), ['yes', 'no', 'unknown']);
  assert.equal(r.items[0].chargeable, 500); assert.ok(codes(r.items[0]).includes('chargeable_unknown'));
});

test('rent lost counts vacant days at the daily rent, up to the move-in or to as_of when nobody has moved in', () => {
  assert.equal(check([line()]).items[0].rent_lost, 690.41);
  const open = check([line({ move_in: '' })]).items[0];
  assert.equal(open.days_vacant, 47); assert.deepEqual(codes(open), ['ready_not_leased']);
});
