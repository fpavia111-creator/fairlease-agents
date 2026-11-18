import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRenewals } from '../src/index.js';

const leases = { leases: [{ lease_id: 'A', unit: '1', tenant: 'Ann', start: '2025-03-01', end: '2026-02-28', rent: { monthly: 1000 } }] };
const roll = (m) => [{ unit: '1', tenant: 'Ann', status: 'Current', market_rent: String(m), rent: '1000' }];
const policy = { max_increase_pct: 4, notice_days: 30 };

test('proposed rent moves to market, never above the cap', () => {
  assert.equal(checkRenewals({ leases, marketRows: roll(1020), policy, asOf: '2026-01-01' }).items[0].proposed, 1020);
  assert.equal(checkRenewals({ leases, marketRows: roll(1200), policy, asOf: '2026-01-01' }).items[0].proposed, 1040);
  assert.equal(checkRenewals({ leases, marketRows: roll(1200), policy: { ...policy, round_to: 25 }, asOf: '2026-01-01' }).items[0].proposed, 1025);
});

test('a minimum increase applies even when market is lower', () => {
  assert.equal(checkRenewals({ leases, marketRows: roll(900), policy: { ...policy, min_increase_pct: 2 }, asOf: '2026-01-01' }).items[0].proposed, 1020);
});

test('deadline is lease end less notice days; no offer after it is overdue', () => {
  const i = checkRenewals({ leases, policy, asOf: '2026-02-10' }).items[0];
  assert.equal(i.deadline, '2026-01-29'); assert.equal(i.stage, 'overdue');
});

test('an offer status in another language is read', () => {
  const i = checkRenewals({ leases, policy, offers: [{ unit: '1', status: 'Angenommen', offered_rent: '1030' }], asOf: '2026-02-10' }).items[0];
  assert.equal(i.stage, 'accepted');
});
