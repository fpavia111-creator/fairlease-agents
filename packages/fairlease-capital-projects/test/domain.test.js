// Capital projects: the edge cases an asset manager would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCapex, changeRequestText } from '../src/index.js';

const row = (over = {}) => ({ property: 'Harbor Point', project_id: 'P-1', project: 'Roof replacement', category: 'Roof', status: 'In progress', funding: 'Replacement reserve', start: '2026-09-01', finish: '2026-12-31', budget: '100000', committed: '0', spent: '0', ...over });
const check = (rows, policy = {}) => checkCapex({ rows, policy, asOf: '2026-11-17' });
const codes = (i) => i.findings.map((f) => f.code);

test('a project on hold is not cancelled: it is not late, but its remaining budget still counts against the reserve', () => {
  const r = check([row({ status: 'On hold', finish: '2026-10-31', spent: '20000' })], { reserves: { 'Replacement reserve': 50000 } });
  assert.deepEqual(codes(r.items[0]), ['on_hold']); assert.equal(r.items[0].state, 'ok');
  assert.equal(r.reserves[0].remaining_budgets, 80000); assert.equal(r.reserves[0].short, 30000);
  const c = check([row({ status: 'Cancelled', spent: '20000' })], { reserves: { 'Replacement reserve': 50000 } });
  assert.equal(c.reserves[0].remaining_budgets, 0);
});

test('"Complete - punch list" and "Closed out" are complete; "Substantially complete" is still open', () => {
  const r = check([row({ status: 'Complete - punch list', finish: '2026-10-31', spent: '99000' }), row({ project_id: 'P-2', status: 'Closed out', finish: '2026-10-31', spent: '50000' }), row({ project_id: 'P-3', status: 'Substantially complete', finish: '2026-10-31', spent: '90000' })]);
  const by = Object.fromEntries(r.items.map((i) => [i.project_id, codes(i)]));
  assert.deepEqual(by, { 'P-1': [], 'P-2': [], 'P-3': ['past_finish'] });
});

test('when committed is the total contract value, spending is not counted twice in the forecast', () => {
  const rows = [row({ committed: '95000', spent: '60000' })];
  assert.deepEqual(codes(check(rows).items[0]), ['forecast_over']); assert.equal(check(rows).items[0].forecast, 155000);
  const r = check(rows, { committed_includes_spent: true });
  assert.equal(r.items[0].forecast, 95000); assert.deepEqual(codes(r.items[0]), []);
});

test('the same budget on every line of a project is pointed out, since some exports repeat it', () => {
  const r = check([row({ spent: '10000' }), row({ spent: '15000' }), row({ spent: '5000' })]);
  assert.equal(r.items[0].budget, 300000); assert.deepEqual(codes(r.items[0]), ['budget_repeated']);
  assert.match(r.items[0].findings[0].detail, /100000 appears on 3 lines and was added up to 300000/);
  const once = check([row({ spent: '10000' }), row({ budget: '', spent: '15000' })]);
  assert.equal(once.items[0].budget, 100000); assert.deepEqual(codes(once.items[0]), []);
});

test('over budget is judged before rounding and exactly at the tolerance is allowed', () => {
  assert.deepEqual(codes(check([row({ start: '2026-01-01', spent: '105000' })]).items[0]), []);
  assert.deepEqual(codes(check([row({ start: '2026-01-01', spent: '105004' })]).items[0]), ['over_budget']);
});

test('spending far ahead of the schedule is a watch item, not an issue', () => {
  const r = check([row({ start: '2026-11-01', finish: '2027-04-30', spent: '60000' })]);
  assert.deepEqual(codes(r.items[0]), ['spending_ahead']); assert.equal(r.items[0].state, 'watch');
});

test('a reserve only has to cover what is left on open projects, by funding source', () => {
  const r = check([row({ spent: '40000' }), row({ project_id: 'P-2', funding: 'Owner contribution', budget: '30000', spent: '30000', status: 'Completed' }), row({ project_id: 'P-3', budget: '20000', spent: '0' })], { reserves: { 'Replacement reserve': 80000, 'Owner contribution': 0 } });
  const by = Object.fromEntries(r.reserves.map((x) => [x.funding, [x.remaining_budgets, x.short]]));
  assert.deepEqual(by, { 'Replacement reserve': [80000, 0], 'Owner contribution': [0, 0] });
});

test('the change request asks for approval and commits to nothing above the approved budget', () => {
  const it = check([row({ spent: '120000' })]).items[0]; const text = changeRequestText(it, {});
  assert.match(text, /\| Approved budget \| 100000 \|/); assert.match(text, /Requested new budget \| \[TO CONFIRM: amount\]/);
  assert.match(text, /No further commitments will be made on this project above the approved budget until then\./);
});
