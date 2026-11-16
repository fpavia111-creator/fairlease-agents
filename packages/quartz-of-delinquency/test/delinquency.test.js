import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageLedger, checkDelinquency } from '../src/index.js';

const L = { leases: [{ lease_id: 'A', unit: '1', tenant: 'Ann', start: '2026-01-01', end: '2026-12-31', rent: { monthly: 1000 }, deposit: 1000 }] };
const r = (date, code, charge, payment) => ({ unit: '1', tenant: 'Ann', date, charge_code: code, charge: charge === undefined ? '' : String(charge), payment: payment === undefined ? '' : String(payment) });

test('payments go to the oldest charge first; what is left ages from its own date', () => {
  const [t] = ageLedger([r('2026-09-01', 'RENT', 1000), r('2026-10-01', 'RENT', 1000), r('2026-10-05', 'PMT', undefined, 1500)], { leases: L, asOf: '2026-11-15' });
  assert.equal(t.balance, 500); assert.equal(t.open[0].date, '2026-10-01'); assert.equal(t.buckets['31-60'], 500);
});

test('rows after as_of are ignored, and overpayment is a credit', () => {
  const [t] = ageLedger([r('2026-11-01', 'RENT', 1000), r('2026-11-02', 'PMT', undefined, 1100), r('2026-12-01', 'RENT', 1000)], { leases: L, asOf: '2026-11-15' });
  assert.equal(t.balance, -100);
});

test('grace period: a fee on or before due + grace_days is early; after it is fine', () => {
  const policy = { grace_days: 5, late_fee: { type: 'flat', amount: 50 } };
  const early = checkDelinquency({ ledgerRows: [r('2026-11-01', 'RENT', 1000), r('2026-11-06', 'LATE', 50)], leases: L, policy, asOf: '2026-11-15' });
  assert.ok(early.items[0].findings.some((f) => f.code === 'late_fee_in_grace'));
  const ok = checkDelinquency({ ledgerRows: [r('2026-11-01', 'RENT', 1000), r('2026-11-07', 'LATE', 50)], leases: L, policy, asOf: '2026-11-15' });
  assert.ok(!ok.items[0].findings.some((f) => f.code.startsWith('late_fee_')));
});

test('a percent fee cap is worked out from the lease rent', () => {
  const policy = { grace_days: 3, late_fee: { type: 'pct', pct: 5 } };
  const c = checkDelinquency({ ledgerRows: [r('2026-11-01', 'RENT', 1000), r('2026-11-05', 'LATE', 60)], leases: L, policy, asOf: '2026-11-15' });
  assert.equal(c.items[0].findings.find((f) => f.code === 'late_fee_over_policy').amount, 10);
});

test('stages come from the policy, by days of the oldest open charge', () => {
  const policy = { stages: [{ days: 1, name: 'nudge' }, { days: 40, name: 'call' }] };
  const c = checkDelinquency({ ledgerRows: [r('2026-10-01', 'RENT', 1000)], leases: L, policy, asOf: '2026-11-15' });
  assert.equal(c.items[0].stage, 'call');
});
