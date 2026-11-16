import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkVacancy } from '../src/index.js';

const roll = [
  { unit: '1', tenant: 'Ann', status: 'Current', market_rent: '1000', rent: '900' },
  { unit: '2', tenant: '', status: 'Vacant-Unrented', market_rent: '1000', move_out: '2026-01-01' },
  { unit: '3', tenant: 'Bo', status: 'Notice-Unrented', market_rent: '1000', rent: '1000', move_out: '2026-03-31' },
  { unit: '4', tenant: 'Cy (applicant)', status: 'Vacant-Rented', market_rent: '1000', rent: '1000', move_out: '2026-01-20', move_in: '2026-02-15' },
];

test('occupied, leased and exposure follow the usual definitions', () => {
  const t = checkVacancy({ rows: roll, asOf: '2026-02-01' }).totals;
  assert.equal(t.physical_occupancy_pct, 50); assert.equal(t.leased_pct, 50); assert.equal(t.exposure_units, 2);
});

test('vacancy loss to date is market rent per day times days vacant', () => {
  const u = checkVacancy({ rows: roll, asOf: '2026-02-01' }).items.find((i) => i.unit === '2');
  assert.equal(u.days_vacant, 31); assert.equal(u.vacancy_loss_to_date, Math.round(1000 * 12 / 365 * 31 * 100) / 100);
});

test('economic occupancy takes off loss to lease, vacancy and concessions', () => {
  const t = checkVacancy({ rows: roll, asOf: '2026-02-01' }).totals;
  assert.equal(t.gross_potential_rent, 4000); assert.equal(t.economic_occupancy_pct, Math.round((4000 - 100 - 2000) / 4000 * 10000) / 100);
});
