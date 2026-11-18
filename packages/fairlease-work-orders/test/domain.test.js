// Work orders: the edge cases a maintenance manager would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWorkOrders } from '../src/index.js';

const wo = (over = {}) => ({ work_order: 'W1', property: 'Maple Court', unit: '101', category: 'Plumbing', description: 'Faucet drips', priority: 'Normal', status: 'Open', vendor: 'FlowRight Plumbing', created: '2026-11-01', completed: '', cost: '', ...over });
const check = (rows, policy = {}) => checkWorkOrders({ rows, policy, asOf: '2026-11-05' });
const codes = (i) => i.findings.map((f) => f.code);
const by = (r) => Object.fromEntries(r.items.map((i) => [i.work_order, i]));

test('the same unit number in two properties is not a repeat, and neither are two common-area orders', () => {
  const r = by(check([wo(), wo({ work_order: 'W2', property: 'Harbor Point', created: '2026-11-03' }), wo({ work_order: 'C1', unit: '' }), wo({ work_order: 'C2', unit: '', created: '2026-11-03' })]));
  assert.deepEqual([codes(r.W2), codes(r.C2)], [[], []]);
  const same = by(check([wo(), wo({ work_order: 'W2', unit: 'Apt 0101', created: '2026-11-03' })]));
  assert.deepEqual(codes(same.W2), ['repeat']);
});

test('emergency words match whole words: a fireplace is not a fire and a leaky gutter is still a leak', () => {
  const r = by(check([wo({ description: 'Fireplace damper is stuck' }), wo({ work_order: 'W2', unit: '102', description: 'Water leaking under the sink' }), wo({ work_order: 'W3', unit: '103', description: '天井から水漏れしています' })]));
  assert.deepEqual(codes(r.W1), []);
  assert.deepEqual(codes(r.W2), ['possible_emergency']); assert.deepEqual(codes(r.W3), ['possible_emergency']);
});

test('"Non-urgent" is not an emergency and "Incomplete" is not closed', () => {
  const r = by(check([wo({ priority: 'Non-Urgent', created: '2026-11-03' }), wo({ work_order: 'W2', unit: '102', status: 'Incomplete', created: '2026-10-20' })]));
  assert.notEqual(r.W1.priority, 'emergency'); assert.deepEqual(codes(r.W1), []);
  assert.equal(r.W2.open, true); assert.deepEqual(codes(r.W2), ['overdue']);
});

test('a closed order with no completed date is not aged to today or counted as late', () => {
  const r = check([wo({ status: 'Completed', created: '2026-01-10', cost: '120' })]);
  assert.deepEqual(codes(r.items[0]), ['completed_date_missing']); assert.equal(r.items[0].days_open, null);
  assert.equal(r.vendors[0].on_time_pct, null); assert.equal(r.vendors[0].average_days, null);
});

test('a completed date before the created date is reported, not treated as on time', () => {
  const r = check([wo({ status: 'Completed', created: '2026-11-04', completed: '2026-11-01', cost: '80' })]);
  assert.deepEqual(codes(r.items[0]), ['dates_out_of_order']); assert.equal(r.items[0].status, 'issue');
});

test('on-time is judged against the order\'s own priority target, at the boundary', () => {
  const r = by(check([wo({ status: 'Completed', completed: '2026-11-08', cost: '50' }), wo({ work_order: 'W2', unit: '102', status: 'Completed', completed: '2026-11-09', cost: '50' }), wo({ work_order: 'W3', unit: '103', priority: 'Emergency', status: 'Completed', completed: '2026-11-02', cost: '50' })]));
  assert.deepEqual([codes(r.W1), codes(r.W2), codes(r.W3)], [[], ['completed_late'], []]);
});

test('one vendor written two ways is scored once', () => {
  const r = check([wo({ status: 'Completed', completed: '2026-11-02', cost: '100' }), wo({ work_order: 'W2', unit: '102', vendor: 'Flowright Plumbing, LLC', status: 'Completed', completed: '2026-11-03', cost: '50' })]);
  assert.equal(r.vendors.length, 1); assert.equal(r.vendors[0].count, 2); assert.equal(r.vendors[0].total, 150);
});

test('a cost outlier needs three completed orders in the category, and cancelled orders are left out of everything', () => {
  const few = check([wo({ status: 'Completed', completed: '2026-11-02', cost: '100' }), wo({ work_order: 'W2', unit: '102', status: 'Completed', completed: '2026-11-02', cost: '5000' })]);
  assert.ok(!few.items.some((i) => codes(i).includes('cost_outlier')));
  const rows = ['102', '103', '104'].map((u, k) => wo({ work_order: `N${k}`, unit: u, status: 'Completed', completed: '2026-11-02', cost: '100' }));
  const r = by(check([...rows, wo({ work_order: 'BIG', unit: '105', status: 'Completed', completed: '2026-11-02', cost: '900' }), wo({ work_order: 'X', unit: '106', status: 'Cancelled', cost: '99999' })]));
  assert.deepEqual(codes(r.BIG), ['cost_outlier']); assert.equal(r.X, undefined);
});
