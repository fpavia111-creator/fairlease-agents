import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTaxes } from '../src/taxes.js';

const asOf = '2026-11-15';
const row = (o) => ({ parcel: 'P1', tax_year: 2026, assessed_value: 110, prior_assessed_value: 100, ...o });

test('prior value comes from last year\'s row when not given; only the latest year is judged for appeal', () => {
  const r = checkTaxes({ rows: [{ parcel: 'P1', tax_year: 2025, assessed_value: 100 }, { parcel: 'P1', tax_year: 2026, assessed_value: 150 }], asOf });
  const cur = r.items.find((i) => i.year === 2026); assert.equal(cur.change_pct, 50); assert.equal(cur.findings[0].code, 'assessment_jump');
  assert.equal(r.items.find((i) => i.year === 2025).findings.length, 0);
});

test('appeal deadline: never computed, policy entry wins over the file', () => {
  const none = checkTaxes({ rows: [row({ assessed_value: 200 })], asOf }).items[0];
  assert.deepEqual(none.findings.map((f) => f.code), ['assessment_jump', 'appeal_deadline_unknown']); assert.equal(none.appeal_deadline, null);
  const pol = checkTaxes({ rows: [row({ assessed_value: 200, appeal_deadline: '2027-06-01' })], policy: { appeal_deadlines: { P1: '2026-11-20' } }, asOf });
  assert.equal(pol.items[0].appeal_deadline, '2026-11-20'); assert.equal(pol.events[0].date, '2026-11-20');
});

test('installments: overdue, short, due soon, overpaid', () => {
  const r = checkTaxes({ rows: [row({ due_date: '2026-10-01', tax_amount: 50 }), row({ due_date: '2026-10-15', tax_amount: 50, paid: 40 }), row({ due_date: '2026-12-01', tax_amount: 50 }), row({ due_date: '2026-05-01', tax_amount: 50, paid: 60 })], asOf });
  assert.deepEqual(r.items[0].findings.map((f) => f.code), ['installment_overdue', 'installment_short', 'installment_due_soon', 'installment_overpaid']);
  assert.equal(r.items[0].outstanding, 100); assert.equal(r.events.length, 1);
});

test('within the review threshold nothing is flagged', () => {
  assert.equal(checkTaxes({ rows: [row({ assessed_value: 105 })], asOf }).items[0].status, 'ok');
  assert.equal(checkTaxes({ rows: [row({ assessed_value: 105 })], policy: { appeal_review_pct: 3 }, asOf }).items[0].findings[0].code, 'assessment_jump');
});
