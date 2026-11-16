import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCapex, changeRequestText } from '../src/capex.js';

const asOf = '2026-11-15';
const p = (o) => ({ project: 'X', project_id: 'X1', status: 'In progress', budget: 100, committed: 0, spent: 0, ...o });

test('rows for the same project are added up', () => {
  const r = checkCapex({ rows: [p({ spent: 40 }), p({ budget: null, spent: 30, committed: 10 })], asOf });
  assert.equal(r.items.length, 1); assert.equal(r.items[0].spent, 70); assert.equal(r.items[0].forecast, 80);
});

test('tolerance applies to over budget and forecast', () => {
  assert.equal(checkCapex({ rows: [p({ spent: 104 })], asOf }).items[0].state, 'ok');
  assert.equal(checkCapex({ rows: [p({ spent: 106 })], asOf }).items[0].findings[0].code, 'over_budget');
  assert.equal(checkCapex({ rows: [p({ spent: 90, committed: 20 })], asOf }).items[0].findings[0].code, 'forecast_over');
  assert.equal(checkCapex({ rows: [p({ spent: 90, committed: 20 })], policy: { tolerance_pct: 15 }, asOf }).items[0].state, 'ok');
});

test('completed and cancelled projects are not late, stalled or counted against reserves', () => {
  const r = checkCapex({ rows: [p({ project_id: 'A', status: 'Abgeschlossen', finish: '2026-01-01', committed: 5 }), p({ project_id: 'B', status: 'Cancelled', start: '2025-01-01' }), p({ project_id: 'C', status: '完了', funding: 'R' })], policy: { reserves: { R: 0 } }, asOf });
  const by = (id) => r.items.find((i) => i.project_id === id);
  assert.deepEqual(by('A').findings.map((f) => f.code), ['open_commitments_after_completion']);
  assert.equal(by('B').state, 'ok'); assert.equal(r.reserves.find((x) => x.funding === 'R').short, 0);
});

test('not started after stalled_days with nothing spent or committed', () => {
  assert.equal(checkCapex({ rows: [p({ start: '2026-08-01' })], asOf }).items[0].findings[0].code, 'not_started');
  assert.equal(checkCapex({ rows: [p({ start: '2026-10-01' })], asOf }).items[0].state, 'ok');
});

test('reserve shortfall per funding source', () => {
  const r = checkCapex({ rows: [p({ project_id: 'A', funding: 'Res', budget: 300, spent: 100 }), p({ project_id: 'B', funding: 'Res', budget: 50 })], policy: { reserves: { Res: 120 } }, asOf });
  assert.equal(r.reserves[0].remaining_budgets, 250); assert.equal(r.reserves[0].short, 130);
});

test('change request carries the figures and leaves the new budget to confirm', () => {
  const it = checkCapex({ rows: [p({ spent: 120 })], asOf }).items[0];
  const t = changeRequestText(it); assert.match(t, /Spent to date \| 120/); assert.match(t, /\[TO CONFIRM: amount\]/);
});
