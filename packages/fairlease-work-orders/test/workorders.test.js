import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWorkOrders } from '../src/index.js';

const wo = (id, extra = {}) => ({ work_order: id, unit: '1', category: 'Plumbing', description: 'Drip', priority: 'Normal', status: 'Open', vendor: 'V', created: '2026-01-01', ...extra });

test('priority words in other languages map to your targets', () => {
  const r = checkWorkOrders({ rows: [wo('1', { priority: 'Dringend' }), wo('2', { priority: 'Urgence' }), wo('3', { priority: '低' })], asOf: '2026-01-03' });
  assert.deepEqual(r.items.map((i) => [i.work_order, i.priority]).sort(), [['1', 'normal'], ['2', 'emergency'], ['3', 'low']]);
});

test('an emergency word on an open routine order is flagged; closed or cancelled ones are not', () => {
  const r = checkWorkOrders({ rows: [wo('1', { description: 'Gas smell in hall' }), wo('2', { description: 'Gas smell', completed: '2026-01-01' }), wo('3', { description: 'Gas smell', status: 'Cancelled' })], asOf: '2026-01-01' });
  assert.equal(r.items.length, 2); assert.deepEqual(r.items.filter((i) => i.findings.some((f) => f.code === 'possible_emergency')).map((i) => i.work_order), ['1']);
});

test('a second order of the same category in the same unit within repeat_days is a repeat', () => {
  const r = checkWorkOrders({ rows: [wo('1', { completed: '2026-01-02' }), wo('2', { created: '2026-03-01' }), wo('3', { created: '2026-09-01' })], asOf: '2026-09-02', policy: { repeat_days: 90 } });
  assert.deepEqual(r.items.filter((i) => i.findings.some((f) => f.code === 'repeat')).map((i) => i.work_order), ['2']);
});
