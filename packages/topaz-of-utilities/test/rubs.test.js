import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRubs, slotsFor } from '../src/index.js';

const occ = [{ unit: 'A', tenant: 'Ann', sqft: '1000', occupants: '2', move_in: '2025-01-01' }, { unit: 'B', tenant: 'Bo', sqft: '1000', occupants: '1', move_in: '2025-01-01', move_out: '2026-01-15' }, { unit: 'B', tenant: '', sqft: '1000' }];
const bill = (amount) => [{ utility: 'Water', period_start: '2026-01-01', period_end: '2026-01-31', amount: String(amount) }];

test('a part month weights a tenancy by days; the vacant remainder is the owner\'s', () => {
  const s = slotsFor(occ, '2026-01-01', '2026-01-31');
  const bo = s.find((x) => x.tenant === 'Bo'); const vac = s.find((x) => x.vacant);
  assert.equal(bo.days, 15); assert.equal(vac.days, 16); assert.ok(Math.abs(vac.sqft - 1000 * 16 / 31) < 1e-9);
});

test('the split adds up to the bill to the cent, common area off first', () => {
  const r = checkRubs({ bills: bill(1000.01), occupancy: occ, cfg: { utilities: { water: { method: 'sqft', common_area_pct: 10 } } } });
  const p = r.periods[0];
  assert.equal(p.common_area, 100); assert.equal(Math.round((p.residents_share + p.owner_share) * 100), 100001);
});

test('vacant_occupants decides how much of an occupant split the owner carries', () => {
  const cfg = (v) => ({ utilities: { water: { method: 'occupants' } }, vacant_occupants: v });
  const zero = checkRubs({ bills: bill(300), occupancy: occ, cfg: cfg(0) }).periods[0];
  const one = checkRubs({ bills: bill(300), occupancy: occ, cfg: cfg(1) }).periods[0];
  assert.ok(zero.owner_share < one.owner_share); assert.equal(zero.owner_share, 0);
});

test('each charge belongs to the latest bill before it, and a cap limits what may be billed', () => {
  const bills = [...bill(100), { utility: 'Water', period_start: '2026-02-01', period_end: '2026-02-28', amount: '100' }];
  const billed = [{ unit: 'A', tenant: 'Ann', date: '2026-02-10', charge_code: 'WTR', charge: '30' }, { unit: 'A', tenant: 'Ann', date: '2026-03-10', charge_code: 'WTR', charge: '30' }];
  const r = checkRubs({ bills, occupancy: occ.slice(0, 1), billedRows: billed, cfg: { utilities: { water: { method: 'units', cap_per_unit: 30 } } } });
  assert.deepEqual(r.periods.map((p) => p.lines[0].code), ['ok', 'ok']);
});
