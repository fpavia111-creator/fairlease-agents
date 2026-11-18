import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFees, creditText } from '../src/fees.js';

const L = (o) => ({ owner: 'O', property: 'P', date: '2026-10-05', ...o });
const ag = (o = {}) => ({ agreements: [{ owner: 'O', property: 'P', management_fee_pct: 10, ...o }] });

test('management fee on collected income, minimum and maximum', () => {
  const rows = [L({ description: 'Rent', income: 1000 }), L({ description: 'Management fee', type: 'Fee', expense: 100 })];
  assert.equal(checkFees({ ledgerRows: rows, agreements: ag() }).items[0].status, 'ok');
  assert.equal(checkFees({ ledgerRows: rows, agreements: ag({ minimum_monthly: 150 }) }).items[0].findings[0].code, 'management_fee_under');
  assert.equal(checkFees({ ledgerRows: rows, agreements: ag({ maximum_monthly: 80 }) }).items[0].findings[0].code, 'management_fee_over');
});

test('security deposits are never fee income; your own exclusions add to them', () => {
  const rows = [L({ description: 'Rent', income: 1000 }), L({ description: 'Security deposit', income: 500 }), L({ description: 'Parking', income: 100 }), L({ description: 'Management fee', expense: 160 })];
  assert.equal(checkFees({ ledgerRows: rows, agreements: ag() }).items[0].findings[0].amount, 50);
  assert.equal(checkFees({ ledgerRows: rows, agreements: ag({ excluded_income: ['parking'] }) }).items[0].findings[0].amount, 60);
});

test('fees recognised in other languages', () => {
  const rows = [L({ description: 'Miete', income: 1000 }), L({ description: 'Verwaltungsgebühr Oktober', expense: 150 }), L({ description: '更新手数料', expense: 50 })];
  const it = checkFees({ ledgerRows: rows, agreements: ag() }).items[0];
  assert.deepEqual(it.findings.map((f) => f.code), ['management_fee_over', 'renewal_fee_not_in_agreement']);
});

test('markup only on maintenance bills, and only if the agreement allows it', () => {
  const rows = [L({ description: 'Rent', income: 1000 }), L({ description: 'Management fee', expense: 100 }), L({ description: 'Plumber', expense: 400 }), L({ description: 'Property tax', expense: 900 }), L({ description: 'Markup', expense: 40 })];
  assert.equal(checkFees({ ledgerRows: rows, agreements: ag({ maintenance_markup_pct: 10 }) }).items[0].status, 'ok');
  assert.equal(checkFees({ ledgerRows: rows, agreements: ag() }).items[0].findings[0].code, 'markup_not_in_agreement');
});

test('owners without an agreement are listed, not guessed', () => {
  const r = checkFees({ ledgerRows: [L({ owner: 'X', description: 'Rent', income: 10 })], agreements: ag() });
  assert.deepEqual(r.owners_without_agreement, ['X (P)']); assert.equal(r.items.length, 0);
});

test('credit note totals the overcharges', () => {
  const it = checkFees({ ledgerRows: [L({ description: 'Rent', income: 1000 }), L({ description: 'Management fee', expense: 130 })], agreements: ag() }).items[0];
  assert.match(creditText(it), /Total to be credited: 30/);
});
