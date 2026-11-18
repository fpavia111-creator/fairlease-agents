import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMigration, matchUnits, punchListText } from '../src/migration.js';

const u = (unit, extra = {}) => ({ unit, tenant: `T ${unit}`, status: 'Current', rent: 1000, deposit: 1000, balance: 0, market_rent: 1100, sqft: 700, lease_start: '2026-01-01', lease_end: '2026-12-31', ...extra });

test('pairing: unit map and learned aliases, then same unit, then a unique trailing number', () => {
  const m = matchUnits([{ unit: 'A-1' }, { unit: '2' }, { unit: 'B-3' }, { unit: 'X-4' }, { unit: 'Y-4' }], [{ unit: 'one' }, { unit: '2' }, { unit: '3' }, { unit: '4' }], { unitMap: { 'A-1': 'one' } });
  assert.deepEqual(m.pairs.map((p) => [p.old.unit, p.new.unit, p.how]), [['A-1', 'one', 'unit map'], ['2', '2', 'same unit'], ['B-3', '3', 'same number']]);
  assert.deepEqual(m.missing.map((x) => x.unit), ['X-4', 'Y-4']); assert.deepEqual(m.extra.map((x) => x.unit), ['4']);
  const l = matchUnits([{ unit: 'X-4' }], [{ unit: '4' }, { unit: 'Z-4' }], { learned: { 'X-4': 'Z-4' } });
  assert.equal(l.pairs[0].new.unit, 'Z-4');
});

test('identical rent rolls match and every total ties', () => {
  const r = checkMigration({ before: [u('1'), u('2')], after: [u('1'), u('2')] });
  assert.deepEqual(r.items.map((i) => i.status), ['ok', 'ok']); assert.ok(r.totals.every((t) => t.ties)); assert.match(r.summary, /All totals tie/);
});

test('every compared field is reported', () => {
  const r = checkMigration({ before: [u('1')], after: [u('1', { tenant: 'Other Person', rent: 1100, deposit: 100, balance: 50, market_rent: 1200, sqft: 750, lease_end: '2027-01-31', status: 'Vacant' })] });
  const codes = r.items[0].findings.map((f) => f.code).sort();
  assert.deepEqual(codes, ['balance_differs', 'deposit_differs', 'lease_dates_differ', 'market_rent_differs', 'occupancy_differs', 'rent_differs', 'sqft_differs', 'tenant_differs']);
});

test('the fields list limits what is compared, and tolerance is respected', () => {
  const r = checkMigration({ before: [u('1')], after: [u('1', { rent: 1000.004, deposit: 900 })], policy: { fields: ['rent'] } });
  assert.equal(r.items[0].status, 'ok');
});

test('charge-per-row rent rolls are grouped before comparing', () => {
  const before = [{ unit: '1', tenant: 'Ana', charge_code: 'rent', charge_amount: 900 }, { unit: '', charge_code: 'parking', charge_amount: 50 }];
  const after = [{ unit: '1', tenant: 'Ana', rent: 900 }];
  const r = checkMigration({ before, after, policy: { fields: ['tenant', 'rent'] } });
  assert.equal(r.items[0].status, 'ok');
});

test('missing and extra units, and ignored units', () => {
  const r = checkMigration({ before: [u('1'), u('2')], after: [u('1'), u('MODEL', { tenant: '', status: 'Vacant', rent: 0 })], policy: { ignore_units: ['model'] } });
  assert.deepEqual(r.items.map((i) => [i.unit, i.status]), [['2', 'missing'], ['1', 'ok']]);
  assert.equal(r.totals.find((t) => t.item === 'Units').difference, -1);
});

test('the punch list carries open lines and untied totals, and leaves sign-off to a person', () => {
  const r = checkMigration({ before: [u('1'), u('2')], after: [u('1', { deposit: 100 })], policy: { cutover: '2026-11-01' } });
  const t = punchListText(r, {});
  assert.match(t, /cutover 2026-11-01/); assert.match(t, /Deposit 1000 became 100/); assert.match(t, /Totals that do not tie/); assert.match(t, /\[TO CONFIRM: who signs off\]/);
});
