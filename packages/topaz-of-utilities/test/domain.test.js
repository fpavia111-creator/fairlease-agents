// RUBS billbacks: the edge cases a utility billing analyst would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRubs, slotsFor } from '../src/index.js';

const occ = [{ unit: '101', tenant: 'Ann Lee', sqft: '1000', occupants: '2', move_in: '2025-01-01' }, { unit: '102', tenant: 'Bo Diaz', sqft: '1000', occupants: '1', move_in: '2025-01-01' }];
const bill = (amount, over = {}) => ({ utility: 'Water', period_start: '2026-01-01', period_end: '2026-01-31', amount: String(amount), ...over });
const water = (over = {}) => ({ utilities: { water: { method: 'units', ...over } } });
const chg = (unit, tenant, charge, over = {}) => ({ unit, tenant, date: '2026-02-10', charge_code: 'WTR', description: 'Water (RUBS)', charge: String(charge), ...over });
const run = (o = {}) => checkRubs({ bills: [bill(200)], occupancy: occ, cfg: water(), ...o });

test('a unit written "Unit 101" on one row and "101" on another is one unit, not two', () => {
  const rows = [{ unit: 'Unit 101', tenant: 'Ann Lee', sqft: '1000', move_in: '2025-01-01', move_out: '2026-01-10' }, { unit: '101', tenant: 'Cy Park', sqft: '1000', move_in: '2026-01-11' }, occ[1]];
  const s = slotsFor(rows, '2026-01-01', '2026-01-31');
  assert.equal(s.filter((x) => x.vacant).length, 0); assert.ok(Math.abs(s.reduce((t, x) => t + x.units, 0) - 2) < 1e-9);
  const r = run({ occupancy: rows, billedRows: [chg('#101', 'Ann Lee', 32.26), chg('101', 'Cy Park', 67.74), chg('102', 'Bo Diaz', 100)] });
  assert.equal(r.items.length, 2); assert.ok(r.items.every((i) => i.status === 'ok'));
});

test('two tenancies on the same days share the unit; they do not make it count twice', () => {
  const rows = [occ[0], { unit: '101', tenant: 'Cy Park', sqft: '1000', occupants: '1', move_in: '2025-06-01' }, occ[1]];
  const p = run({ occupancy: rows }).periods[0];
  assert.ok(p.findings.some((f) => f.code === 'overlapping_tenancies' && f.units.includes('101')));
  const by = (t) => p.lines.find((l) => l.tenant === t).share;
  assert.equal(by('Ann Lee'), 50); assert.equal(by('Cy Park'), 50); assert.equal(by('Bo Diaz'), 100); assert.equal(p.owner_share, 0);
  // By occupants every person still counts.
  const o = run({ occupancy: rows, cfg: water({ method: 'occupants' }) }).periods[0];
  assert.equal(o.lines.find((l) => l.tenant === 'Bo Diaz').share, 50);
});

test('"gas" is not in "Vegas" and a parking or rent line is not a utility charge', () => {
  const cfg = { utilities: { gas: { method: 'units' } } };
  const billedRows = [chg('101', 'Ann Lee', 100, { charge_code: 'GAS', description: 'Gas billback' }), chg('102', 'Bo Diaz', 100, { charge_code: 'GAS', description: 'Gas billback' }),
    chg('101', 'Ann Lee', 75, { charge_code: 'PRK', description: 'Parking - Gas Lamp garage' }), chg('102', 'Bo Diaz', 40, { charge_code: 'MISC', description: 'Vegas trip raffle' }), chg('102', 'Bo Diaz', 1500, { charge_code: 'RENT', description: 'Rent, gas included' })];
  const r = checkRubs({ bills: [bill(200, { utility: 'Gas' })], occupancy: occ, billedRows, cfg });
  assert.equal(r.periods[0].billed, 200); assert.ok(r.items.every((i) => i.status === 'ok')); assert.equal(r.unmatched_charges.length, 0);
});

test('the same bill in two exports is counted once; two accounts for one period are one bill to split', () => {
  const r = run({ bills: [bill(200, { account: 'W-1' }), bill(200, { account: 'W-1' }), bill(90, { account: 'W-2' })] });
  assert.equal(r.periods.length, 1); assert.equal(r.periods[0].amount, 290); assert.deepEqual(r.periods[0].accounts, ['W-1', 'W-2']);
  assert.deepEqual(r.periods[0].lines.map((l) => l.share), [145, 145]);
  assert.match(r.skipped_bills[0].reason, /listed twice/);
});

test('a zero or credit bill before it never makes a spike of "Infinity percent", and a zero bill has no recovery rate', () => {
  const r = run({ bills: [bill(0, { period_start: '2025-12-01', period_end: '2025-12-31' }), bill(200)], billedRows: [chg('101', 'Ann Lee', 100), chg('102', 'Bo Diaz', 100)] });
  assert.ok(r.periods.every((p) => !p.findings.some((f) => f.code === 'bill_spike')));
  assert.equal(r.periods[0].recovery_pct, null); assert.equal(r.periods[1].recovery_pct, 100);
  assert.ok(!JSON.stringify(r).includes('Infinity'));
});

test('a bill whose service period ends before it starts is skipped with the reason', () => {
  const r = run({ bills: [bill(200, { period_start: '2026-01-31', period_end: '2026-01-01' }), bill(200)] });
  assert.equal(r.periods.length, 1); assert.match(r.skipped_bills[0].reason, /ends before it starts/);
});

test('a bill for one property is split over that property\'s units only, and only its charges count', () => {
  const rows = [{ ...occ[0], property: 'Elm Court' }, { ...occ[1], property: 'Elm Court' }, { unit: '101', tenant: 'Dee Roy', sqft: '1000', move_in: '2025-01-01', property: 'Oak Row' }];
  const billedRows = [chg('101', 'Ann Lee', 100, { property: 'Elm Court' }), chg('102', 'Bo Diaz', 100, { property: 'Elm Court' }), chg('101', 'Dee Roy', 80, { property: 'Oak Row' })];
  const r = checkRubs({ bills: [bill(200, { property: 'Elm Court' })], occupancy: rows, billedRows, cfg: water() });
  assert.deepEqual(r.periods[0].lines.map((l) => [l.tenant, l.share, l.code]), [['Ann Lee', 100, 'ok'], ['Bo Diaz', 100, 'ok']]);
  assert.equal(r.unmatched_charges.length, 1); assert.equal(r.unmatched_charges[0].tenant, 'Dee Roy');
});

test('a reversed charge that was billed again is not a duplicate, and a payment is not a charge', () => {
  const billedRows = [chg('101', 'Ann Lee', 100), chg('101', 'Ann Lee', -100, { date: '2026-02-11' }), chg('101', 'Ann Lee', 100, { date: '2026-02-12' }), chg('102', 'Bo Diaz', 100),
    { unit: '102', tenant: 'Bo Diaz', date: '2026-02-15', charge_code: 'WTR', description: 'Water payment', charge: '', payment: '100' }];
  const r = run({ billedRows });
  assert.ok(r.items.every((i) => i.status === 'ok'), JSON.stringify(r.items)); assert.equal(r.periods[0].billed, 200);
  const dup = run({ billedRows: [chg('101', 'Ann Lee', 100), chg('101', 'Ann Lee', 100), chg('102', 'Bo Diaz', 100)] });
  assert.equal(dup.items[0].findings[0].code, 'duplicate_charge');
});
