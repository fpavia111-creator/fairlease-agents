// System migration: the edge cases a conversion lead would raise at cutover.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMigration, matchUnits, propScore, sameTenant } from '../src/migration.js';

const u = (unit, extra = {}) => ({ unit, tenant: `Tenant ${unit}`, status: 'Current', rent: 1000, deposit: 1000, balance: 0, market_rent: 1100, sqft: 700, lease_start: '2026-01-01', lease_end: '2026-12-31', ...extra });
const cmp = (before, after, o = {}) => checkMigration({ before, after, ...o });
const codes = (i) => i.findings.map((f) => f.code);

test('the same unit number in two buildings pairs by building, even when the new system renames the buildings and sorts differently', () => {
  const before = [u('101', { property: 'Maple Court', tenant: 'Ana Rivera', rent: 1450 }), u('101', { property: 'Oak Row', tenant: 'Wei Chen', rent: 1900 })];
  const after = [u('101', { property: 'Oak Row Townhomes LLC', tenant: 'Wei Chen', rent: 1900 }), u('101', { property: 'The Maple Court Apartments', tenant: 'Ana Rivera', rent: 1450 })];
  const r = cmp(before, after);
  assert.deepEqual(r.items.map((i) => i.status), ['ok', 'ok']);
  assert.ok(propScore('Maple Court', 'The Maple Court Apartments') > propScore('Maple Court', 'Oak Row Townhomes LLC'));
});

test('a building that did not come over is the one reported missing, not its namesake unit next door', () => {
  const before = [u('101', { property: 'Maple Court', tenant: 'Ana Rivera' }), u('101', { property: 'Oak Row', tenant: 'Wei Chen' })];
  const r = cmp(before, [u('101', { property: 'Oak Row', tenant: 'Wei Chen' })]);
  assert.deepEqual(r.items.map((i) => [i.property, i.status]), [['Maple Court', 'missing'], ['Oak Row', 'ok']]);
});

test('"Rivera, Ana" is Ana Rivera; a respelled name or a dropped co-tenant is still a difference', () => {
  assert.ok(sameTenant('Rivera, Ana', 'Ana Rivera')); assert.ok(!sameTenant('Jon Brooks', 'John Brooks'));
  const r = cmp([u('1', { tenant: 'Rivera, Ana' }), u('2', { tenant: 'Ana Rivera & Bo Chen' }), u('3', { tenant: 'Jon Brooks' })], [u('1', { tenant: 'Ana Rivera' }), u('2', { tenant: 'Ana Rivera' }), u('3', { tenant: 'John Brooks' })]);
  const by = Object.fromEntries(r.items.map((i) => [i.unit, i]));
  assert.equal(by['1'].status, 'ok'); assert.deepEqual(codes(by['3']), ['tenant_differs']);
  assert.match(by['2'].findings[0].detail, /One name carried over; the other did not/);
});

test('a unit keyed twice in the new system is flagged; the charge lines of one lease are not duplicates', () => {
  const r = cmp([u('1'), u('2')], [u('1'), u('1'), u('2')]);
  const one = r.items.find((i) => i.unit === '1');
  assert.deepEqual(codes(one), ['listed_twice_in_new']); assert.equal(one.status, 'differs'); assert.equal(r.items.find((i) => i.unit === '2').status, 'ok');
  const yardi = [{ unit: '1', tenant: 'Tenant 1', charge_code: 'rent', charge_amount: 1000 }, { unit: '1', tenant: 'Tenant 1', charge_code: 'parking', charge_amount: 50 }];
  assert.equal(cmp(yardi, [{ unit: '1', tenant: 'Tenant 1', rent: 1000 }], { policy: { fields: ['tenant', 'rent'] } }).items[0].status, 'ok');
});

test('a future resident listed first does not replace the current one', () => {
  const before = [u('1', { tenant: 'Ana Rivera' }), u('1', { tenant: 'Next Person', status: 'Future', rent: 1200 })];
  const after = [u('1', { tenant: 'Next Person', status: 'Future Resident', rent: 1200 }), u('1', { tenant: 'Ana Rivera' })];
  const r = cmp(before, after);
  assert.equal(r.items[0].status, 'ok', JSON.stringify(r.items[0].findings)); assert.equal(r.items[0].tenant, 'Ana Rivera'); assert.equal(r.items[0].new.rent, 1000);
});

test('"B-201" and "B201" are the same unit; a bare number is only a suggestion to confirm', () => {
  const m = matchUnits([{ unit: 'B-201' }, { unit: 'C-305' }], [{ unit: 'B201' }, { unit: '305' }]);
  assert.deepEqual(m.pairs.map((p) => [p.old.unit, p.new.unit, p.how]), [['B-201', 'B201', 'same unit'], ['C-305', '305', 'same number']]);
  const two = matchUnits([{ unit: 'B-201' }, { unit: 'B201' }], [{ unit: 'B201' }]);
  assert.deepEqual(two.pairs.map((p) => p.old.unit), ['B201']); assert.deepEqual(two.missing.map((x) => x.unit), ['B-201']);
});

test('blank and zero are the same money; blank against an amount, and a flipped sign, are not', () => {
  const r = cmp([u('1', { deposit: 0, balance: null }), u('2', { deposit: 1000 }), u('3', { balance: -50 })], [u('1', { deposit: null, balance: 0 }), u('2', { deposit: null }), u('3', { balance: 50 })]);
  const by = Object.fromEntries(r.items.map((i) => [i.unit, i]));
  assert.equal(by['1'].status, 'ok'); assert.deepEqual(codes(by['2']), ['deposit_differs']);
  assert.equal(by['3'].findings[0].amount, 100); assert.equal(r.totals.find((t) => t.item === 'Balance').difference, 100);
});

test('vacant is vacant however each system writes it, and a learned alias pairs units without hiding a difference', () => {
  const r = cmp([u('5', { tenant: 'VACANT', status: '', rent: 0, deposit: 0 })], [u('5', { tenant: '', status: 'Vacant-Unrented', rent: null, deposit: null })]);
  assert.equal(r.items[0].status, 'ok', JSON.stringify(r.items[0].findings)); assert.ok(r.totals.find((t) => t.item === 'Occupied units').ties);
  const a = cmp([u('OLD-9', { tenant: 'Ana Rivera' })], [u('N9', { tenant: 'Ana Rivera', rent: 1100 })], { learned: { 'OLD-9': 'N9' } });
  assert.equal(a.items[0].matched_by, 'unit map'); assert.deepEqual(codes(a.items[0]), ['rent_differs']);
});
