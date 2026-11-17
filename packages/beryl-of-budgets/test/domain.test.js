// Budget variance: the edge cases an asset manager would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBudget, memoText } from '../src/index.js';

const long = (account, period, budget, actual, name = account) => ({ account, account_name: name, period, budget, actual });
const run = (budgetRows, policy = {}, actualRows = null, asOf = '2026-03-31') => checkBudget({ budgetRows, actualRows, policy, asOf });
const codes = (i) => i.findings.map((f) => f.code);

test('accounts that are neither income nor expense by your prefixes are listed, not silently dropped', () => {
  const r = run([long('4000', '2026-03', 10000, 10000), long('Repairs', '2026-03', 1000, 5000), long('1200', '2026-03', 0, 300)]);
  assert.deepEqual(r.unclassified_accounts.map((a) => a.account).sort(), ['1200', 'Repairs']);
  assert.match(r.summary, /2 account\(s\) were left out/);
  assert.equal(run([long('4000', '2026-03', 10000, 10000)]).unclassified_accounts.length, 0);
});

test('a month with no actuals at all is said to be not closed; it is not reported as everything under budget', () => {
  const r = run([long('4000', '2026-03', 10000, ''), long('5000', '2026-03', 4000, ''), long('5000', '2026-02', 4000, 4100), long('4000', '2026-02', 10000, 10000)]);
  assert.equal(r.month_has_actuals, false); assert.match(r.summary, /No actuals for 2026-03/);
  assert.ok(r.items.every((i) => !codes(i).some((c) => /_variance$/.test(c))));
});

test('a variance exactly at either threshold is not flagged; one cent over both is', () => {
  const at = run([long('5000', '2026-03', 10000, 11000)], { basis: 'ptd' });
  assert.equal(at.items[0].status, 'ok');
  const over = run([long('5000', '2026-03', 10000, 11000.01)], { basis: 'ptd', threshold_amount: 1000, threshold_pct: 10 });
  assert.equal(codes(over.items[0])[0], 'ptd_variance');
});

test('a contra-income line such as vacancy loss: a bigger loss than budgeted is unfavorable', () => {
  const r = run([long('4050', '2026-03', -2000, -5000, 'Vacancy loss')], { basis: 'ptd' });
  assert.equal(r.items[0].findings[0].favorable, false); assert.match(r.items[0].findings[0].detail, /income under budget by 3000 \(150%\)/);
  assert.equal(r.noi.ptd_actual, -5000);
});

test('spending with a zero budget in the month but a budget elsewhere in the year is a variance, not unbudgeted', () => {
  const r = run([long('6100', '2026-03', 0, 4000), long('6100', '2026-06', 40000, '')], { basis: 'ptd' });
  assert.deepEqual(codes(r.items[0]), ['ptd_variance']); assert.equal(r.items[0].ptd_variance_pct, null); assert.equal(r.items[0].forecast, 44000);
});

test('the forecast adds the remaining months\' budget to actuals to date and flags an expense heading over the year', () => {
  const rows = [long('6000', '2026-01', 1000, 4000), long('6000', '2026-02', 1000, 1000), long('6000', '2026-03', 1000, 1000), ...['04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => long('6000', `2026-${m}`, 1000, ''))];
  const r = run(rows, { basis: 'ptd' });
  assert.equal(r.items[0].forecast, 15000); assert.equal(r.items[0].annual_budget, 12000);
  assert.deepEqual(codes(r.items[0]), ['forecast_over_annual']);
});

test('an explanation only changes the status; the variance and its amount stay in the report and the memo', () => {
  const r = run([long('5200', '2026-03', 10000, 14000, 'Repairs')], { basis: 'ptd', explanations: { 5200: 'Boiler replaced after failure.' } });
  assert.equal(r.items[0].status, 'explained'); assert.deepEqual(codes(r.items[0]), ['ptd_variance', 'forecast_over_annual', 'explained']);
  const memo = memoText(r, {});
  assert.match(memo, /\| 5200 Repairs \| 14000 \| 10000 \| 4000 \|/); assert.match(memo, /Boiler replaced after failure\./);
  assert.equal((memo.match(/\[TO CONFIRM/g) || []).length, 3);
});

test('with explain set to unfavorable, good news is left out but an unfavorable income shortfall is not', () => {
  const r = run([long('4000', '2026-03', 20000, 15000), long('5000', '2026-03', 20000, 15000)], { basis: 'ptd', explain: 'unfavorable' });
  const by = Object.fromEntries(r.items.map((i) => [i.account, i.status]));
  assert.deepEqual(by, { 4000: 'explain', 5000: 'ok' });
});
