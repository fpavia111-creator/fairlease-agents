// Association accounts and violations: the edge cases a community manager would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAssociation, noticeText } from '../src/index.js';

const policy = { assessment: { amount: 100, frequency: 'monthly', due_day: 1 }, periods_from: '2026-01', grace_days: 10, late_fee: { flat: 10 }, collection_steps: [{ days: 30, step: 'reminder' }, { days: 90, step: 'board' }], violations: { notice_within_days: 5, cure_days: 14, hearing_before_fine: true, stale_days: 60, repeat_days: 120 } };
const row = (date, type, charge, payment, extra = {}) => ({ account: 'X', owner: 'Owner X', unit: '1', date, type, charge, payment, ...extra });
const paidMonth = (m, extra = {}) => [row(`2026-${m}-01`, 'Assessment', 100, '', extra), row(`2026-${m}-05`, 'Payment', '', 100, extra)];
const run = (ledger, p = policy, asOf = '2026-03-20') => checkAssociation({ ledger, policy: p, asOf });
const codes = (i) => i.findings.map((f) => f.code);
const vio = (over = {}) => ({ violation_id: 'V1', unit: '12', owner: 'Owner Y', type: 'Trash bins left out', opened: '2026-03-01', notice_1: '2026-03-03', notice_2: '', hearing: '', closed: '', fine: '', status: 'Open', ...over });

test('a special assessment is not mistaken for the regular assessment', () => {
  const r = run([...paidMonth('01'), ...paidMonth('02'), ...paidMonth('03'), row('2026-02-15', 'Special Assessment - roof', 750, ''), row('2026-02-20', 'Payment', '', 750)]);
  assert.deepEqual(codes(r.items[0]), []); assert.equal(r.items[0].status, 'ok');
});

test('an account that starts part-way through the year is not missing the months before it existed', () => {
  const r = run([...paidMonth('03', { account: 'NEW', owner: 'New Owner', unit: '7' }), ...paidMonth('01'), ...paidMonth('02'), ...paidMonth('03')]);
  const n = r.items.find((i) => i.account === 'NEW');
  assert.deepEqual(codes(n), ['account_starts_late']); assert.equal(n.status, 'ok'); assert.equal(n.periods.length, 1);
});

test('the per-unit amount is found whatever way the ledger writes the unit, and one unit is one account', () => {
  const p = { ...policy, assessment: { ...policy.assessment, per_unit: { 12: 150 } } };
  const rows = [{ owner: 'Owner Y', unit: 'Unit 12', date: '2026-01-01', type: 'Assessment', charge: 150, payment: '' }, { owner: 'Owner Y', unit: '12', date: '2026-01-04', type: 'Payment', charge: '', payment: 150 }];
  const r = run(rows, p, '2026-01-20');
  assert.equal(r.items.length, 1); assert.equal(r.items[0].expected_assessment, 150); assert.deepEqual(codes(r.items[0]), []);
});

test('an owner who pays the year ahead is in credit, never late, and owes no late fee', () => {
  const r = run([row('2026-01-01', 'Assessment', 100, ''), row('2026-01-02', 'Payment', '', 1200), row('2026-02-01', 'Assessment', 100, ''), row('2026-03-01', 'Assessment', 100, '')]);
  assert.deepEqual(codes(r.items[0]), ['credit_balance']); assert.equal(r.items[0].status, 'credit'); assert.equal(r.items[0].balance, -900);
});

test('payment on the last day of grace is on time; the day after it is late', () => {
  const on = run([row('2026-01-01', 'Assessment', 100, ''), row('2026-01-11', 'Payment', '', 100)], policy, '2026-01-25');
  assert.deepEqual(codes(on.items[0]), []);
  const late = run([row('2026-01-01', 'Assessment', 100, ''), row('2026-01-12', 'Payment', '', 100)], policy, '2026-01-25');
  assert.deepEqual(codes(late.items[0]), ['late_fee_missing']);
});

test('the collection step is quoted from the policy and the decision is left to a person', () => {
  const r = run([row('2026-01-01', 'Assessment', 100, ''), row('2026-02-01', 'Assessment', 100, ''), row('2026-03-01', 'Assessment', 100, '')], { ...policy, late_fee: undefined });
  const f = r.items[0].findings.find((x) => x.code === 'past_due');
  assert.equal(r.items[0].step, 'reminder'); assert.equal(r.items[0].next_step, 'board');
  assert.match(f.detail, /Your policy's step at 30 days: reminder\. Next at 90 days: board\. A person decides\./);
  assert.doesNotMatch(noticeText(r.items[0], { as_of: '2026-03-20' }), /lien|foreclos|attorney|legal action/i);
});

test('violations at "Unit 12" and "12" are the same unit for repeats, and a closing date before the opening date is reported', () => {
  const r = checkAssociation({ violations: [vio({ violation_id: 'V0', unit: 'Unit 12', opened: '2026-01-10', notice_1: '2026-01-11', closed: '2026-01-20' }), vio(), vio({ violation_id: 'V2', unit: '14', opened: '2026-03-05', notice_1: '2026-03-06', closed: '2026-03-01' })], policy, asOf: '2026-03-10' });
  const by = Object.fromEntries(r.items.map((i) => [i.id, i]));
  assert.deepEqual(codes(by.V1), ['repeat']); assert.deepEqual(codes(by.V2), ['dates_out_of_order']); assert.equal(by.V2.status, 'action');
});

test('a fine with the hearing already held is fine; a fine before a hearing still to come is flagged', () => {
  const held = checkAssociation({ violations: [vio({ hearing: '2026-03-08', fine: '50' })], policy, asOf: '2026-03-10' });
  assert.deepEqual(codes(held.items[0]), []);
  const ahead = checkAssociation({ violations: [vio({ hearing: '2026-03-20', fine: '50' })], policy, asOf: '2026-03-10' });
  assert.deepEqual(codes(ahead.items[0]), ['fine_without_hearing']);
});
