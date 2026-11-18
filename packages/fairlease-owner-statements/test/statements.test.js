import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStatements, contributionText } from '../src/statements.js';

const s = (o) => ({ owner: 'O', property: 'P', period: '2026-10', beginning_balance: 100, income: 50, expenses: 20, management_fee: 5, owner_draw: 0, ending_balance: 125, ...o });

test('a clean statement', () => { assert.equal(checkStatements({ rows: [s({})] }).items[0].status, 'ok'); });

test('fee inside expenses', () => {
  assert.equal(checkStatements({ rows: [s({ ending_balance: 130 })], policy: { fee_in_expenses: true } }).items[0].status, 'ok');
  assert.equal(checkStatements({ rows: [s({ ending_balance: 130 })] }).items[0].findings[0].code, 'math_error');
});

test('periods in any spelling are ordered and chained', () => {
  const r = checkStatements({ rows: [s({ period: 'Oct 2026', beginning_balance: 90, ending_balance: 115 }), s({ period: '09/2026', ending_balance: 100, beginning_balance: 75 })] });
  const oct = r.items.find((i) => i.period === '2026-10'); assert.equal(oct.findings[0].code, 'beginning_differs');
});

test('reserve from policy by property name, then the statement column', () => {
  const r = checkStatements({ rows: [s({ owner_draw: 100, ending_balance: 25, reserve: 10 })], policy: { reserves: { p: 50 } } });
  assert.equal(r.items[0].findings[0].code, 'distribution_below_reserve');
  assert.equal(checkStatements({ rows: [s({ owner_draw: 100, ending_balance: 25, reserve: 10 })] }).items[0].status, 'ok');
});

test('ledger totals: amount sign or cash in/out, fee told apart', () => {
  const ledgerRows = [{ owner: 'O', property: 'P', date: '2026-10-02', amount: 50 }, { owner: 'O', property: 'P', date: '2026-10-05', amount: -20 }, { owner: 'O', property: 'P', date: '2026-10-31', type: 'Management Fee', expense: 8 }];
  const it = checkStatements({ rows: [s({})], ledgerRows }).items[0];
  assert.deepEqual(it.findings.map((f) => f.code), ['fee_differs']);
});

test('contribution request carries the shortfall', () => {
  const it = checkStatements({ rows: [s({ income: 0, expenses: 200, management_fee: 0, ending_balance: -100 })], policy: { default_reserve: 50 } }).items[0];
  assert.match(contributionText(it), /Amount requested: 150/);
});
