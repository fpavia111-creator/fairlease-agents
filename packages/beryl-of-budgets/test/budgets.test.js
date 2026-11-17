import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBudget, memoText } from '../src/budgets.js';

const long = (account, period, budget, actual) => ({ account, account_name: account, period, budget, actual });
const asOf = '2026-03-31';

test('both thresholds must be crossed', () => {
  const r = checkBudget({ budgetRows: [long('5000', '2026-03', 1000, 1500), long('5100', '2026-03', 100000, 105000), long('5200', '2026-03', 10000, 12000)], asOf });
  const by = (a) => r.items.find((i) => i.account === a);
  assert.equal(by('5000').status, 'ok'); assert.equal(by('5100').status, 'ok'); assert.equal(by('5200').status, 'explain');
});

test('income and expense direction decide favorable', () => {
  const r = checkBudget({ budgetRows: [long('4000', '2026-03', 10000, 12000), long('5000', '2026-03', 10000, 12000)], policy: { explain: 'unfavorable' }, asOf });
  assert.equal(r.items.find((i) => i.account === '4000').status, 'ok');
  assert.equal(r.items.find((i) => i.account === '5000').findings[0].favorable, false);
});

test('fiscal year start sets the year-to-date window', () => {
  const rows = [long('5000', '2025-06', 5000, 0), long('5000', '2025-07', 5000, 9000), long('5000', '2026-03', 5000, 5000)];
  const r = checkBudget({ budgetRows: rows, policy: { fiscal_start_month: 7, basis: 'ytd' }, asOf });
  assert.equal(r.ytd_from, '2025-07'); assert.equal(r.items[0].ytd_budget, 10000); assert.equal(r.items[0].ytd_actual, 14000);
});

test('separate actuals from a GL: credit minus debit per month', () => {
  const r = checkBudget({ budgetRows: [long('4000', '2026-03', 1000)], actualRows: [{ account: '4000', date: '2026-03-05', credit: 600 }, { account: '4000', date: '2026-03-20', credit: 500, debit: 50 }], asOf });
  assert.equal(r.items[0].ptd_actual, 1050);
  const e = checkBudget({ budgetRows: [long('5000', '2026-03', 1000)], actualRows: [{ account: '5000', date: '2026-03-05', debit: 700 }, { account: '5000', date: '2026-03-09', credit: 100 }], asOf });
  assert.equal(e.items[0].ptd_actual, 600);
});

test('unbudgeted spend and explanations', () => {
  const r = checkBudget({ budgetRows: [long('5000', '2026-03', 1000, 1000)], actualRows: [{ account: '5000', period: '2026-03', amount: 1000 }, { account: '5900', period: '2026-03', amount: 2500 }], policy: { explanations: { 5900: 'Snow removal' } }, asOf });
  const x = r.items.find((i) => i.account === '5900'); assert.equal(x.status, 'explained'); assert.equal(x.explanation, 'Snow removal');
  assert.match(memoText(r), /Snow removal/);
});
