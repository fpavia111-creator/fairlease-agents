// Trust account reconciliation: the edge cases a broker's bookkeeper would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileTrust } from '../src/index.js';

const bk = (date, amount, reference = '', description = '') => ({ date, amount: String(amount), reference, description });
const bn = (date, amount, reference = '', description = '', balance = '') => ({ date, amount: String(amount), reference, description, balance: String(balance) });
const run = (bankRows, bookRows, policy = {}, ledgerRows = null) => reconcileTrust({ bankRows, bookRows, ledgerRows, policy: { statement_end: '2026-10-31', ...policy } });
const types = (r) => r.items.filter((i) => i.type !== 'three_way').map((i) => [i.type, i.reference, i.findings.map((f) => f.code).join(' ')]);

test('"Check No. 001042" on the statement is check 1042 in the book', () => {
  const r = run([bn('2026-10-20', -500, 'Check No. 001042', '', 9500)], [bk('2026-10-01', 10000, 'DEP-1'), bk('2026-10-02', -500, '1042')], { bank_ending_balance: 9500 });
  assert.deepEqual(types(r).filter((t) => t[0] === 'outstanding_check' || t[0] === 'bank_not_in_book'), []);
});

test('a deposit matches by amount and date although the bank trace number is not the book receipt number; checks never swap numbers', () => {
  const r = run([bn('2026-10-06', 1850, 'TRC 00044871'), bn('2026-10-09', -500, '1002')], [bk('2026-10-05', 1850, 'RCPT-311'), bk('2026-10-07', -500, '1001'), bk('2026-10-07', -500, '1002')], { bank_ending_balance: 1350 });
  assert.deepEqual(types(r), [['outstanding_check', '1001', '']]); assert.equal(r.balanced, true);
});

test('a statement exported newest first still gives the closing balance of the last day', () => {
  const r = run([bn('2026-10-30', -200, '', 'Wire', 800), bn('2026-10-10', 1000, '', 'Deposit', 1000)], [bk('2026-10-10', 1000), bk('2026-10-30', -200)]);
  assert.equal(r.three_way.bank_statement_balance, 800); assert.equal(r.balanced, true);
});

test('a check that cleared for a different amount than it was written for is called that', () => {
  const r = run([bn('2026-10-12', -550, '1042')], [bk('2026-10-05', -500, '1042')], { bank_ending_balance: -550 });
  const hit = r.items.find((i) => i.type === 'bank_not_in_book');
  assert.deepEqual(hit.findings.map((f) => f.code), ['cleared_for_different_amount']); assert.match(hit.findings[0].detail, /cleared for -550; the book has -500/);
  assert.equal(hit.amount, -50); assert.equal(r.three_way.bank_minus_book, -50); assert.ok(!r.items.some((i) => i.type === 'outstanding_check'));
});

test('a check is stale the day after your limit, and a deposit is late in transit the day after its allowance', () => {
  const r = run([], [bk('2026-08-02', -100, '900'), bk('2026-08-01', -100, '901'), bk('2026-10-26', 300, 'D1'), bk('2026-10-25', 300, 'D2')], { bank_ending_balance: 0, stale_check_days: 90, transit_days: 5 });
  assert.deepEqual(types(r), [['outstanding_check', '901', 'stale_check'], ['deposit_in_transit', 'D2', 'old_deposit_in_transit'], ['outstanding_check', '900', ''], ['deposit_in_transit', 'D1', '']]);
});

test('ledgers that add up to the book still fail when one of them is negative', () => {
  const r = run([bn('2026-10-10', 1000, '', '', 1000)], [bk('2026-10-10', 1000)], {}, [{ party: 'Owner A', type: 'Owner', balance: '1200' }, { party: 'Owner B', type: 'Owner', balance: '-200' }]);
  assert.equal(r.three_way.book_minus_ledgers, 0); assert.equal(r.balanced, false);
  assert.match(r.summary, /Not reconciled.*1 negative ledger\(s\)/); assert.doesNotMatch(r.summary, /All three agree/);
});

test('a check that clears after the statement end is still outstanding at the end, and the account balances', () => {
  const r = run([bn('2026-10-10', 1000, '', '', 1000), bn('2026-11-03', -400, '77', '', 600)], [bk('2026-10-10', 1000), bk('2026-10-29', -400, '77')]);
  assert.deepEqual(types(r), [['outstanding_check', '77', 'cleared_after_end']]); assert.equal(r.three_way.bank_statement_balance, 1000); assert.equal(r.three_way.adjusted_bank_balance, 600); assert.equal(r.balanced, true);
});

test('a statement whose lines do not get from the opening to the closing balance is reported as incomplete', () => {
  const r = run([bn('2026-10-10', 1000, '', '', 6000), bn('2026-10-20', -200, '', '', 5300)], [bk('2026-10-10', 1000), bk('2026-10-20', -200)], { bank_opening_balance: 5000, book_opening_balance: 5000 });
  const top = r.items[0].findings.map((f) => f.code);
  assert.ok(top.includes('statement_does_not_add_up')); assert.match(r.items[0].findings.find((f) => f.code === 'statement_does_not_add_up').detail, /5000 plus the lines \(800\) is 5800, but the statement ends at 5300/);
});
