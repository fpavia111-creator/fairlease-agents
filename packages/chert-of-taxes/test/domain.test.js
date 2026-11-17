// Property tax tracking: the edge cases a tax or asset manager would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTaxes } from '../src/index.js';

const row = (over = {}) => ({ property: 'Harbor Point Plaza', parcel: '14-22-301-001', tax_year: '2026', assessed_value: '6200000', prior_assessed_value: '5100000', appeal_deadline: '', due_date: '2026-12-01', tax_amount: '98000', paid: '', ...over });
const check = (rows, policy = {}, asOf = '2026-11-17') => checkTaxes({ rows, policy, asOf });
const codes = (i) => i.findings.map((f) => f.code);

test('a deadline in the policy applies however the parcel number is punctuated', () => {
  const r = check([row()], { appeal_deadlines: { '1422301001': '2026-12-04' } });
  assert.equal(r.items[0].appeal_deadline, '2026-12-04'); assert.ok(!codes(r.items[0]).includes('appeal_deadline_unknown'));
  assert.deepEqual(r.unmatched_policy_parcels, []);
});

test('a policy deadline for a parcel that is not in the file is reported, since a typo would hide the deadline', () => {
  const r = check([row()], { appeal_deadlines: { '14-22-301-099': '2026-12-04' } });
  assert.deepEqual(r.unmatched_policy_parcels, ['14-22-301-099']); assert.match(r.summary, /1 appeal deadline\(s\) in your policy match no parcel/);
  assert.ok(codes(r.items[0]).includes('appeal_deadline_unknown'));
});

test('tax years written "FY2026" or "2026/2027" are kept apart and still find last year\'s value', () => {
  const r = check([row({ tax_year: 'FY2025', assessed_value: '5000000', prior_assessed_value: '', due_date: '2025-12-01', paid: '98000' }), row({ tax_year: '2026/2027', prior_assessed_value: '' })]);
  assert.equal(r.items.length, 2);
  const cur = r.items.find((i) => i.year === 2026); assert.equal(cur.prior, 5000000); assert.equal(cur.change_pct, 24);
});

test('no deadline is ever worked out: a jump with no deadline entered says so and puts nothing on the calendar', () => {
  const r = check([row({ notice_date: '2026-11-01', paid: '98000' })]);
  assert.deepEqual(codes(r.items[0]), ['assessment_jump', 'appeal_deadline_unknown']); assert.equal(r.items[0].appeal_deadline, null);
  assert.equal(r.events.length, 0);
});

test('an installment is due soon on its due date and overdue the day after', () => {
  assert.deepEqual(codes(check([row({ prior_assessed_value: '6200000', due_date: '2026-11-17' })]).items[0]), ['installment_due_soon']);
  assert.deepEqual(codes(check([row({ prior_assessed_value: '6200000', due_date: '2026-11-16' })]).items[0]), ['installment_overdue']);
});

test('an amount with no due date is counted as billed and flagged; it is not silently treated as fine', () => {
  const r = check([row({ prior_assessed_value: '6200000', due_date: '' })]);
  assert.equal(r.items[0].billed, 98000); assert.deepEqual(codes(r.items[0]), ['due_date_missing']); assert.equal(r.items[0].status, 'issue');
});

test('a fall in assessed value and a rise at exactly the review percentage are not flagged', () => {
  assert.deepEqual(codes(check([row({ assessed_value: '4000000', paid: '98000' })]).items[0]), []);
  assert.deepEqual(codes(check([row({ assessed_value: '5610000', paid: '98000' })]).items[0]), []);
  assert.deepEqual(codes(check([row({ assessed_value: '5610001', paid: '98000', appeal_deadline: '2027-03-01' })]).items[0]), ['assessment_jump']);
});

test('calendar events carry only open items: unpaid installments and deadlines still ahead', () => {
  const r = check([row({ appeal_deadline: '2026-12-04', due_date: '2026-06-01', paid: '98000' }), row({ appeal_deadline: '2026-12-04' }), row({ parcel: '14-22-301-002', prior_assessed_value: '6200000', appeal_deadline: '2026-10-01', due_date: '2026-10-01', paid: '98000' })]);
  assert.deepEqual(r.events.map((e) => [e.date, e.summary.split(':')[0]]), [['2026-12-01', 'Property tax due 14-22-301-001'], ['2026-12-04', 'Tax appeal deadline 14-22-301-001 (Harbor Point Plaza)']]);
});
