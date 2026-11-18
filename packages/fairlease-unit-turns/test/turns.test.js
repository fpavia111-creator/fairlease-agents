import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTurns } from '../src/index.js';

const row = (cat, cost, extra = {}) => ({ unit: '7', move_out: '2026-01-01', ready: '2026-01-06', category: cat, vendor: 'V', cost: String(cost), chargeable: 'No', rent: '1000', ...extra });

test('rows with the same unit and move-out make one turn', () => {
  const r = checkTurns({ rows: [row('Paint', 500), row('Clean', 100)], asOf: '2026-01-10' });
  assert.equal(r.items.length, 1); assert.equal(r.items[0].cost, 600); assert.equal(r.items[0].days_to_ready, 5);
});

test('an open turn counts days to as_of; rent lost is market per day times days vacant', () => {
  const i = checkTurns({ rows: [row('Paint', 500, { ready: '' })], asOf: '2026-01-11', policy: { target_days: 7 } }).items[0];
  assert.equal(i.days_to_ready, 10); assert.ok(i.findings.some((f) => f.code === 'open_over_target')); assert.equal(i.rent_lost, Math.round(1000 * 12 / 365 * 10 * 100) / 100);
});

test('chargeable words in other languages are read', () => {
  const i = checkTurns({ rows: [row('Paint', 500, { chargeable: 'Oui' }), row('Clean', 100, { chargeable: 'teilweise' })], asOf: '2026-01-10' }).items[0];
  assert.equal(i.chargeable, 500); assert.ok(i.findings.some((f) => f.code === 'chargeable_partial'));
});
