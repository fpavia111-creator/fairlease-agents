// Vacancy and loss to lease: the edge cases an asset manager would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkVacancy } from '../src/index.js';

const u = (unit, over = {}) => ({ unit, tenant: `Tenant ${unit}`, status: 'Current', market_rent: '1000', rent: '1000', lease_start: '2026-01-01', lease_end: '2026-12-31', ...over });
const vac = (unit, over = {}) => u(unit, { tenant: 'VACANT', status: 'Vacant-Unrented', rent: '', lease_start: '', lease_end: '', ...over });
const run = (rows, extra = {}) => checkVacancy({ rows, asOf: '2026-11-15', ...extra });
const one = (r, unit) => r.items.find((i) => i.unit === unit); const codes = (i) => i.findings.map((f) => f.code);

test('a model, a down unit and an employee unit are not vacancy: they are left out of occupancy and of the loss', () => {
  const r = run([u('101'), u('102'), vac('103', { move_out: '2026-11-01' }), vac('104', { status: 'Model' }), vac('105', { status: 'Down' }), u('106', { status: 'Employee', rent: '0' })]);
  assert.deepEqual(['104', '105', '106'].map((x) => one(r, x).status), ['non_revenue', 'non_revenue', 'non_revenue']);
  assert.equal(r.totals.units, 6); assert.equal(r.totals.rentable_units, 3); assert.equal(r.totals.non_revenue, 3);
  assert.equal(r.totals.physical_occupancy_pct, 66.67); assert.equal(r.totals.vacancy_loss_monthly, 1000); assert.equal(r.totals.gross_potential_rent, 3000);
  assert.deepEqual(codes(one(r, '106')), ['non_revenue_unit']);
});

test('a unit on notice that is already re-leased is not exposure; one that is not, is', () => {
  const r = run([u('101'), u('102', { status: 'Notice-Rented', move_out: '2026-11-30' }), u('103', { status: 'Notice-Unrented', move_out: '2026-11-30' }), vac('104', { move_out: '2026-11-01' })]);
  assert.equal(one(r, '102').status, 'notice_rented'); assert.deepEqual(codes(one(r, '102')), []); assert.deepEqual(codes(one(r, '103')), ['notice_unrented']);
  assert.equal(r.totals.exposure_units, 2); assert.equal(r.totals.leased_pct, 50); assert.equal(r.totals.physical_occupancy_pct, 75);
});

test('an occupied unit with zero rent is a question, not a 100% discount to note for renewal', () => {
  const r = run([u('101', { rent: '0' })]);
  assert.deepEqual(codes(one(r, '101')), ['rent_zero']); assert.equal(one(r, '101').review, true);
});

test('a tenant still "on notice" after the move-out date has passed is pointed out', () => {
  const r = run([u('101', { status: 'Notice', move_out: '2026-10-31' })]);
  assert.ok(codes(one(r, '101')).includes('move_out_passed')); assert.equal(one(r, '101').review, true);
});

test('vacancy loss to date is market rent by the day, and "long vacant" starts the day after your limit', () => {
  const r = run([vac('101', { market_rent: '1825', move_out: '2026-10-16' }), vac('102', { move_out: '2026-10-15' })]);
  assert.equal(one(r, '101').days_vacant, 30); assert.equal(one(r, '101').vacancy_loss_to_date, 1800); assert.deepEqual(codes(one(r, '101')), []);
  assert.deepEqual(codes(one(r, '102')), ['long_vacant']);
});

test('economic occupancy takes off loss to lease, vacancy and concessions, and a rent above market adds back', () => {
  const r = run([u('101', { rent: '900' }), u('102', { rent: '1050' }), vac('103', { move_out: '2026-11-01' }), u('104'), { unit: '104', charge_code: 'CONC', charge_amount: '-100' }]);
  assert.equal(r.totals.gross_potential_rent, 4000); assert.equal(r.totals.loss_to_lease, 50); assert.equal(r.totals.vacancy_loss_monthly, 1000); assert.equal(r.totals.concessions, 100);
  assert.equal(r.totals.economic_occupancy_pct, 71.25);
});

test('a rent exactly at your off-market limit is not flagged; past it, it is', () => {
  assert.deepEqual(codes(one(run([u('101', { rent: '900' })]), '101')), []);
  assert.deepEqual(codes(one(run([u('101', { rent: '899' })]), '101')), ['below_market']);
  assert.deepEqual(codes(one(run([u('101', { rent: '1101' })]), '101')), ['above_market']); assert.equal(one(run([u('101', { rent: '1101' })]), '101').review, true);
});

test('a vacant unit that is pre-leased is still empty today but counts as leased, and a missing move-out date is said', () => {
  const r = run([vac('101', { status: 'Vacant-Rented', tenant: 'Future Tenant', move_in: '2026-12-01' }), u('102')]);
  assert.equal(one(r, '101').status, 'vacant_rented'); assert.deepEqual(codes(one(r, '101')), ['vacant_since_unknown', 'vacant_rented']);
  assert.equal(r.totals.physical_occupancy_pct, 50); assert.equal(r.totals.leased_pct, 100); assert.equal(r.totals.exposure_units, 0);
});
