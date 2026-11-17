// Leasing leads: the edge cases a leasing manager would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLeads } from '../src/index.js';

const lead = (id, over = {}) => ({ lead_id: id, name: `Person ${id}`, email: `${id.toLowerCase()}@example.com`, source: 'Zillow', created: '2026-11-01', first_response: '2026-11-01', status: 'Active', ...over });
const run = (leads, policy = {}, asOf = '2026-11-03') => checkLeads({ leads, policy, asOf });
const codes = (r, id) => (r.items.find((i) => i.id === id) || { findings: [] }).findings.map((f) => f.code);
const src = (r, name) => r.sources.find((s) => s.source === name);

test('two people with the same name and different emails are two leads; the same email in capitals is one', () => {
  const r = run([lead('A', { name: 'Jordan Lee', email: 'jordan.lee@example.com' }), lead('B', { name: 'Jordan Lee', email: 'jlee88@example.org', created: '2026-11-02', first_response: '2026-11-02' }), lead('C', { name: 'J. Lee', email: 'Jordan.Lee@Example.com', created: '2026-11-02', first_response: '2026-11-02' })]);
  assert.deepEqual(codes(r, 'B'), []); assert.deepEqual(codes(r, 'C'), ['duplicate']); assert.equal(src(r, 'Zillow').count, 2);
});

test('someone who asked twice and leased on the second inquiry is one lead and one lease, credited to the first source', () => {
  const r = run([lead('A', { email: 'kim@example.com' }), lead('B', { email: 'kim@example.com', source: 'Website', created: '2026-11-05', first_response: '2026-11-05', toured: '2026-11-06', applied: '2026-11-07', leased: '2026-11-10', status: 'Leased' })], {}, '2026-12-20');
  assert.match(r.summary, /^1 lead\(s\) \(1 duplicate\(s\) set aside\): 1 toured, 1 applied, 1 leased \(100%\)/);
  assert.equal(src(r, 'Zillow').leases, 1); assert.equal(src(r, 'Website'), undefined);
  assert.deepEqual(codes(r, 'A'), []); // not a stale open lead: the person leased
});

test('a walk-in who toured with no "first response" recorded was not ignored', () => {
  const r = run([lead('A', { first_response: '', toured: '2026-11-01' })], {}, '2026-11-03');
  assert.deepEqual(codes(r, 'A'), []); assert.equal(src(r, 'Zillow').on_time_pct, 100);
});

test('a response dated before the lead came in is a data error, not an instant answer', () => {
  const r = run([lead('A', { first_response: '2026-10-28' }), lead('B', { first_response: '2026-11-04' })], {}, '2026-11-04');
  assert.deepEqual(codes(r, 'A'), ['dates_out_of_order']); assert.equal(src(r, 'Zillow').response_days, 3); assert.equal(src(r, 'Zillow').on_time_pct, 0);
});

test('spend entered under an alias goes to the source it stands for', () => {
  const r = run([lead('A', { source: 'zillow.com', leased: '2026-11-02', status: 'Leased' })], { source_aliases: { 'zillow.com': 'Zillow', 'Zillow Rental Network': 'Zillow' }, spend: { 'Zillow Rental Network': 600, Billboard: 400 } });
  assert.equal(src(r, 'Zillow').spend, 600); assert.equal(src(r, 'Zillow').cost_per_lease, 600); assert.equal(r.sources.length, 2); assert.equal(src(r, 'Billboard').note, 'spend with no leads');
});

test('the response target has an exact edge: on the day it is fine, the day after is slow, and silence is flagged only once the day has passed', () => {
  const r = run([lead('A', { first_response: '2026-11-02' }), lead('B', { first_response: '2026-11-03' }), lead('C', { first_response: '' }), lead('D', { first_response: '', created: '2026-11-02' })], { respond_within_days: 1 }, '2026-11-03');
  assert.deepEqual([codes(r, 'A'), codes(r, 'B'), codes(r, 'C'), codes(r, 'D')], [[], ['slow_response'], ['no_response'], []]);
});

test('approved with no lease after a week is an action; lost needs a reason', () => {
  const r = run([lead('A', { toured: '2026-11-02', applied: '2026-11-03', approved: '2026-11-04' }), lead('B', { status: 'Inactive', lost_reason: 'N/A' }), lead('C', { status: 'Inactive', lost_reason: 'Chose another community' })], {}, '2026-11-12');
  assert.deepEqual(codes(r, 'A'), ['approved_not_leased']); assert.equal(r.items.find((i) => i.id === 'A').status, 'action');
  assert.deepEqual(codes(r, 'B'), ['lost_reason_missing']); assert.deepEqual(codes(r, 'C'), []);
  assert.deepEqual(r.lost_reasons, [{ reason: 'Chose another community', count: 1 }, { reason: 'No reason recorded', count: 1 }]);
});

test('a lead dated in the future is pointed out and not judged for response time', () => {
  const r = run([lead('A', { created: '2027-11-01', first_response: '' })]);
  assert.deepEqual(codes(r, 'A'), ['created_in_future']); assert.equal(src(r, 'Zillow').on_time_pct, null);
});
