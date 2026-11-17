import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileTrust } from '../src/trust.js';

const policy = { statement_end: '2026-10-31', book_opening_balance: 1000 };
const bankRows = [{ date: '2026-10-02', credit: 500, reference: 'D1' }, { date: '2026-10-09', debit: 200, reference: '101' }, { date: '2026-10-31', balance: 1300, debit: 0, credit: 0 }];

test('balanced three-way', () => {
  const r = reconcileTrust({ bankRows: [...bankRows.slice(0, 2), { date: '2026-10-20', debit: 0.0, credit: 0.0, balance: 1300 }], bookRows: [{ date: '2026-10-01', credit: 500, reference: 'D1' }, { date: '2026-10-05', debit: 200, reference: '101' }], ledgerRows: [{ party: 'Owner A', balance: 1300 }], policy });
  assert.equal(r.balanced, true); assert.equal(r.three_way.adjusted_bank_balance, 1300);
});

test('outstanding checks and deposits in transit adjust the bank', () => {
  const r = reconcileTrust({ bankRows: [{ date: '2026-10-02', credit: 500, reference: 'D1', balance: 1500 }], bookRows: [{ date: '2026-10-01', credit: 500, reference: 'D1' }, { date: '2026-10-28', debit: 300, reference: '102' }, { date: '2026-10-30', credit: 50 }], policy });
  assert.equal(r.three_way.outstanding_checks, -300); assert.equal(r.three_way.deposits_in_transit, 50); assert.equal(r.three_way.adjusted_bank_balance, 1250); assert.equal(r.balanced, true);
});

test('a check cleared after the statement end stays outstanding', () => {
  const r = reconcileTrust({ bankRows: [{ date: '2026-10-02', credit: 500, balance: 1500 }, { date: '2026-11-03', debit: 300, reference: '102' }], bookRows: [{ date: '2026-10-01', credit: 500 }, { date: '2026-10-28', debit: 300, reference: '102' }], policy });
  const it = r.items.find((i) => i.reference === '102'); assert.equal(it.type, 'outstanding_check'); assert.equal(it.findings[0].code, 'cleared_after_end');
});

test('book in GL sign convention', () => {
  const r = reconcileTrust({ bankRows: [{ date: '2026-10-02', credit: 500, balance: 1500 }], bookRows: [{ date: '2026-10-01', debit: 500 }], policy: { ...policy, book_debit_is_deposit: true } });
  assert.equal(r.three_way.book_balance, 1500); assert.equal(r.balanced, true);
});

test('ledger difference and missing ledgers', () => {
  const r = reconcileTrust({ bankRows: [{ date: '2026-10-02', credit: 500, balance: 1500 }], bookRows: [{ date: '2026-10-01', credit: 500 }], ledgerRows: [{ party: 'A', balance: 1400 }], policy });
  assert.equal(r.items[0].findings[0].code, 'book_ledger_difference');
  assert.equal(reconcileTrust({ bankRows: [{ date: '2026-10-02', credit: 500, balance: 1500 }], bookRows: [{ date: '2026-10-01', credit: 500 }], policy }).items[0].findings[0].code, 'ledgers_missing');
});

test('book entries before the opening date are ignored', () => {
  const r = reconcileTrust({ bankRows: [{ date: '2026-10-02', credit: 500, balance: 1500 }], bookRows: [{ date: '2026-09-01', credit: 999 }, { date: '2026-10-01', credit: 500 }], policy: { ...policy, book_opening_date: '2026-09-30' } });
  assert.equal(r.three_way.book_balance, 1500);
});
