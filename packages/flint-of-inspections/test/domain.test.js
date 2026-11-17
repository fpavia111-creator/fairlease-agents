// Inspections: the edge cases a property manager would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkInspections, conditionScore, noticeText } from '../src/index.js';

const policy = { interval_days: 180, due_soon_days: 30, followup_days: 14 };
const row = (over = {}) => ({ unit: '101', inspected_at: '2026-06-01', inspection_type: 'Periodic', area: 'Kitchen', item: 'Sink', condition: 'Good', notes: '', photo: '', ...over });
const check = (rows, extra = {}) => checkInspections({ rows, policy, asOf: '2026-11-17', ...extra });
const codes = (i) => i.findings.map((f) => f.code);

test('an inspection scheduled for a later date does not count as done', () => {
  const r = check([row({ inspected_at: '2026-01-10' }), row({ inspected_at: '2026-12-05' })]);
  assert.equal(r.items[0].last_inspection, '2026-01-10'); assert.deepEqual(codes(r.items[0]), ['inspection_overdue']);
  assert.equal(r.items[0].next_scheduled, '2026-12-05');
});

test('one unit written three ways is one unit, with or without a rent roll', () => {
  const rows = [row({ unit: 'Apt 101' }), row({ unit: '0101', inspected_at: '2026-09-01' }), row({ unit: 'Unit 101', inspected_at: '2026-10-01' })];
  assert.equal(check(rows).items.length, 1); assert.equal(check(rows).items[0].inspections, 3);
  const withRoll = check(rows, { rentRoll: [{ unit: '#101', tenant: 'Dana Example', rent: '1500' }] });
  assert.equal(withRoll.items.length, 1); assert.equal(withRoll.items[0].last_inspection, '2026-10-01');
});

test('"N/A" and "not applicable" are simply not rated; a negated phrase is left for a person', () => {
  assert.equal(conditionScore('N/A'), null);
  const r = check([row({ condition: 'N/A' }), row({ item: 'Dishwasher', condition: 'Not applicable' }), row({ item: 'Oven', condition: 'not clean' })]);
  const f = r.items[0].findings.find((x) => x.code === 'unrated');
  assert.match(f.detail, /Oven "not clean"/); assert.doesNotMatch(f.detail, /N\/A|Not applicable/);
});

test('the interval is met on its last day and overdue the day after; it is due soon inside the warning window', () => {
  assert.deepEqual(codes(check([row({ inspected_at: '2026-05-21' })]).items[0]), ['inspection_due_soon']);
  assert.deepEqual(codes(check([row({ inspected_at: '2026-05-20' })]).items[0]), ['inspection_overdue']);
  assert.deepEqual(codes(check([row({ inspected_at: '2026-07-01' })]).items[0]), []);
});

test('a move-out is compared with the move-in of the same tenancy, not an older one, and never decides what is damage', () => {
  const rows = [row({ inspected_at: '2024-01-05', inspection_type: 'Move-In', item: 'Carpet', area: 'Bedroom', condition: 'New' }),
    row({ inspected_at: '2025-06-01', inspection_type: 'Move-In', item: 'Carpet', area: 'Bedroom', condition: 'Fair' }),
    row({ inspected_at: '2026-10-30', inspection_type: 'Move-Out', item: 'Carpet', area: 'Bedroom', condition: 'Fair', photo: 'p1.jpg' })];
  assert.ok(!codes(check(rows).items[0]).includes('worse_at_move_out'));
  rows[2] = row({ inspected_at: '2026-10-30', inspection_type: 'Move-Out', item: 'Carpet', area: 'Bedroom', condition: 'Damaged', photo: 'p1.jpg' });
  const f = check(rows).items[0].findings.find((x) => x.code === 'worse_at_move_out');
  assert.match(f.detail, /Bedroom: Carpet Fair → Damaged\. A person decides what is damage and what is normal wear\./);
});

test('a number is read on your scale: 2 of 10 is poor, 2 of 2 is the top', () => {
  assert.equal(conditionScore('2', 10), 1.4); assert.equal(conditionScore('2/2'), 5); assert.equal(conditionScore('3'), 3);
});

test('a poor item is followed up by a work order for that unit opened on or after the inspection, not an older one', () => {
  const rows = [row({ inspected_at: '2026-10-20', condition: 'Needs repair' })];
  const wo = (created, unit = 'Apt 101') => [{ unit, work_order: 'W1', created, description: 'Sink', category: 'Plumbing' }];
  assert.deepEqual(codes(check(rows, { workOrders: wo('2026-10-01') }).items[0]), ['poor_no_work_order']);
  assert.deepEqual(codes(check(rows, { workOrders: wo('2026-10-20') }).items[0]), []);
  assert.deepEqual(codes(check(rows, { workOrders: wo('2026-10-21', '102') }).items[0]), ['poor_no_work_order']);
});

test('the entry notice never states a legal notice period of its own', () => {
  const it = check([row({ inspected_at: '2026-01-10' })]).items[0];
  assert.match(noticeText(it, {}, {}), /\[TO CONFIRM: notice period your lease and local rules require\]/);
  assert.match(noticeText(it, {}, { notice_hours: 48 }), /at least 48 hours ahead, as your company's policy sets/);
});
