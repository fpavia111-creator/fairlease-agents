import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLeads, sourceName, followUpText } from '../src/leads.js';

const asOf = '2026-11-15';
const lead = (id, extra = {}) => ({ lead_id: id, name: `Person ${id}`, email: `${id}@example.com`, source: 'Site A', created: '2026-11-01', first_response: '2026-11-01', status: 'Active', ...extra });

test('source aliases from the policy and from memory', () => {
  assert.equal(sourceName('ILS - Zillow', { source_aliases: { 'ils - zillow': 'Zillow' } }), 'Zillow');
  assert.equal(sourceName('Zil', {}, { Zil: 'Zillow' }), 'Zillow');
  assert.equal(sourceName('', {}), 'Unknown');
});

test('no response, slow response and follow-up due', () => {
  const r = checkLeads({ leads: [lead('A', { first_response: '' , created: '2026-11-12' }), lead('B', { first_response: '2026-11-04', toured: '2026-11-05' }), lead('C', { created: '2026-11-14', first_response: '2026-11-14' })], asOf });
  const by = Object.fromEntries(r.items.map((i) => [i.id, i]));
  assert.deepEqual(by.A.findings.map((f) => f.code), ['no_response']); assert.equal(by.A.status, 'action');
  assert.deepEqual(by.B.findings.map((f) => f.code), ['slow_response', 'follow_up_due']);
  assert.equal(by.C, undefined);
});

test('approved with no lease, stale open, lost without a reason', () => {
  const r = checkLeads({ leads: [lead('A', { applied: '2026-11-02', approved: '2026-11-03' }), lead('B', { created: '2026-09-01', first_response: '2026-09-01' }), lead('C', { status: 'Lost' }), lead('D', { status: 'Inactive', lost_reason: 'Price' })], asOf });
  const by = Object.fromEntries(r.items.map((i) => [i.id, i]));
  assert.deepEqual(by.A.findings.map((f) => f.code), ['approved_not_leased']);
  assert.deepEqual(by.B.findings.map((f) => f.code), ['stale_open']);
  assert.deepEqual(by.C.findings.map((f) => f.code), ['lost_reason_missing']); assert.equal(by.C.status, 'review');
  assert.equal(by.D, undefined);
  assert.deepEqual(r.lost_reasons, [{ reason: 'No reason recorded', count: 1 }, { reason: 'Price', count: 1 }]);
});

test('duplicates by email, phone or name are set aside in the source table', () => {
  const r = checkLeads({ leads: [lead('A', { source: 'X' }), lead('B', { source: 'Y', created: '2026-11-03', email: 'a@example.com', name: 'Someone Else' }), lead('C', { source: 'Y', created: '2026-11-04', phone: '(555) 123-4567', name: 'P' }), lead('D', { source: 'Y', created: '2026-11-05', phone: '555.123.4567', name: 'Q', email: 'q@example.com' })], asOf });
  const dup = r.items.filter((i) => i.findings.some((f) => f.code === 'duplicate')).map((i) => i.id);
  assert.deepEqual(dup, ['B', 'D']);
  assert.deepEqual(r.sources.map((s) => [s.source, s.count]), [['X', 1], ['Y', 1]]);
});

test('source table: on-time rate, median days, conversion and cost per lease', () => {
  const leads = [lead('A', { leased: '2026-11-10', applied: '2026-11-05' }), lead('B', { first_response: '2026-11-04' }), lead('C', { source: 'Site B' })];
  const r = checkLeads({ leads, policy: { spend: { 'site a': 500, Ghost: 100 } }, asOf });
  const a = r.sources.find((s) => s.source === 'Site A');
  assert.equal(a.count, 2); assert.equal(a.on_time_pct, 50); assert.equal(a.response_days, 1.5); assert.equal(a.leases, 1); assert.equal(a.conversion_pct, 50); assert.equal(a.cost_per_lease, 500);
  assert.equal(r.sources.find((s) => s.source === 'Ghost').note, 'spend with no leads');
});

test('dates out of order and the from/to window', () => {
  const r = checkLeads({ leads: [lead('A', { toured: '2026-10-30' }), lead('B', { created: '2026-01-01' })], policy: { from: '2026-10-01' }, asOf });
  assert.equal(r.items.length, 1); assert.equal(r.items[0].findings[0].code, 'dates_out_of_order');
});

test('follow-up wording fits the stage', () => {
  const r = checkLeads({ leads: [lead('A', { applied: '2026-11-02', approved: '2026-11-03' }), lead('B', { first_response: '', created: '2026-11-12' })], asOf });
  const by = Object.fromEntries(r.items.map((i) => [i.id, i]));
  assert.match(followUpText(by.A, {}), /application is approved/);
  assert.match(followUpText(by.B, {}), /show you the home/);
  assert.match(followUpText(by.B, {}), /To:\*\* b@example\.com/);
});
