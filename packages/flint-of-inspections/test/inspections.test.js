import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkInspections, conditionScore, inspectionKind, noticeText } from '../src/inspections.js';

const policy = { interval_days: 365, followup_days: 14 };
const row = (unit, date, type, area, item, condition, photo = '') => ({ unit, inspected_at: date, inspection_type: type, area, item, condition, photo });

test('conditions are read in nine languages and as scores', () => {
  assert.equal(conditionScore('Good'), 4); assert.equal(conditionScore('beschädigt'), 1); assert.equal(conditionScore('usé'), 3);
  assert.equal(conditionScore('需维修'), 2); assert.equal(conditionScore('양호'), 4); assert.equal(conditionScore('8/10'), 4.1);
  assert.equal(conditionScore('3', 5), 3); assert.equal(conditionScore('n/a'), null); assert.equal(conditionScore('not good'), null); assert.equal(conditionScore('Not working'), 1);
});

test('inspection kinds', () => {
  assert.equal(inspectionKind('Move-In'), 'move_in'); assert.equal(inspectionKind('Auszug'), 'move_out'); assert.equal(inspectionKind('État des lieux de sortie'), 'move_out');
  assert.equal(inspectionKind('Vistoria de entrada'), 'move_in'); assert.equal(inspectionKind('退去立会い'), 'move_out'); assert.equal(inspectionKind('Annual'), 'periodic');
});

test('move-out is compared with the latest move-in before it', () => {
  const rows = [row('1', '2020-01-01', 'Move-in', 'Kitchen', 'Oven', 'Poor'), row('1', '2023-01-01', 'Move-in', 'Kitchen', 'Oven', 'New'), row('1', '2026-01-01', 'Move-out', 'kitchen', 'oven', 'Dirty', 'p.jpg')];
  const it = checkInspections({ rows, policy, asOf: '2026-02-01' }).items[0];
  assert.equal(it.worse.length, 1); assert.equal(it.worse[0].moved_in, '2023-01-01'); assert.equal(it.worse[0].drop, 3);
  assert.ok(!it.findings.some((f) => f.code === 'no_photo'));
});

test('schedule: overdue, due soon, never inspected, vacant skipped', () => {
  const rows = [row('1', '2025-01-01', 'Annual', 'Hall', 'Smoke', 'Good'), row('2', '2025-12-01', 'Annual', 'Hall', 'Smoke', 'Good')];
  const rentRoll = [{ unit: '1', tenant: 'A', status: 'Current' }, { unit: '2', tenant: 'B', status: 'Current' }, { unit: '3', tenant: 'C', status: 'Current' }, { unit: '4', tenant: '', status: 'Vacant-Unrented' }];
  const r = checkInspections({ rows, policy, rentRoll, asOf: '2026-11-15' }); const by = (u) => r.items.find((i) => i.unit === u);
  assert.equal(by('1').findings[0].code, 'inspection_overdue'); assert.equal(by('2').findings[0].code, 'inspection_due_soon');
  assert.equal(by('3').findings[0].code, 'never_inspected'); assert.equal(by('4').status, 'ok');
});

test('poor items need a work order within the follow-up days', () => {
  const rows = [row('1', '2026-11-01', 'Annual', 'Hall', 'Smoke detector', 'Missing')];
  const late = checkInspections({ rows, policy, workOrders: [], asOf: '2026-11-20' }).items[0];
  const early = checkInspections({ rows, policy, workOrders: [], asOf: '2026-11-05' }).items[0];
  const done = checkInspections({ rows, policy, workOrders: [{ unit: '1', work_order: '9', created: '2026-11-02' }], asOf: '2026-11-20' }).items[0];
  const none = checkInspections({ rows, policy, asOf: '2026-11-20' }).items[0];
  assert.equal(late.findings[0].code, 'poor_no_work_order'); assert.equal(early.status, 'due_soon'); assert.equal(done.status, 'ok'); assert.equal(none.findings[0].code, 'poor_items');
});

test('unrated words are reported, not guessed', () => {
  const it = checkInspections({ rows: [row('1', '2026-11-01', 'Annual', 'Hall', 'Door', 'squeaky')], policy, asOf: '2026-11-02' }).items[0];
  assert.equal(it.findings[0].code, 'unrated');
});

test('notice leaves the notice period to confirm unless the policy sets it', () => {
  assert.match(noticeText({ unit: '1', tenant: 'A' }, {}), /\[TO CONFIRM: notice period/);
  assert.match(noticeText({ unit: '1', tenant: 'A' }, {}, { notice_hours: 24 }), /at least 24 hours/);
});
