// Percentage rent: the edge cases a retail lease accountant would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOverage, statementText } from '../src/index.js';

const lease = (over = {}) => ({ lease_id: 'L-1', unit: 'Suite 100', tenant: 'Acme Bagels LLC', start: '2024-01-01', end: '2028-12-31', rent: { monthly: 5000 }, percentage_rent: { rate_pct: 6, breakpoint: 600000, report_due_days: 20 }, ...over });
const months = (y, n = 12) => Array.from({ length: n }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
const sale = (period, gross, over = {}) => ({ lease_id: 'L-1', period, gross_sales: String(gross), exclusions: '0', reported_on: `${period}-28`, ...over });
const yearOf = (gross, over = {}) => months(2025).map((m) => sale(m, gross, { reported_on: '', ...over }));
const run = (rows, l = lease(), extra = {}) => computeOverage({ leases: { leases: [l] }, rows, year: 2025, asOf: '2026-03-01', ...extra });
const codes = (r) => r.items[0].findings.map((f) => f.code);

test('exclusions exported as negative numbers are still taken off, not added on', () => {
  const r = run(yearOf(60000, { exclusions: '-1000' }));
  assert.equal(r.items[0].exclusions, 12000); assert.equal(r.items[0].net_sales, 708000); assert.equal(r.items[0].owed, 6480);
});

test('exclusions larger than the sales they come off are a question for a person', () => {
  const r = run([...yearOf(60000).slice(1), sale('2025-01', 60000, { exclusions: '75000', reported_on: '' })]);
  assert.ok(codes(r).includes('exclusions_exceed_sales')); assert.equal(r.items[0].status, 'review');
});

test('months that are not over yet are not "missing" when the lease sets no report deadline', () => {
  const l = lease({ percentage_rent: { rate_pct: 6, breakpoint: 600000 } });
  const r = computeOverage({ leases: { leases: [l] }, rows: months(2025, 9).map((m) => sale(m, 60000)), year: 2025, asOf: '2025-10-15' });
  assert.deepEqual(codes(r), ['reports_not_due', 'below_so_far']); assert.deepEqual(r.items[0].lines.slice(9).map((x) => x.status), ['not_due', 'not_due', 'not_due']);
  const later = computeOverage({ leases: { leases: [l] }, rows: months(2025, 9).map((m) => sale(m, 60000)), year: 2025, asOf: '2025-11-15' });
  assert.deepEqual(later.items[0].findings.find((f) => f.code === 'sales_missing').months, ['2025-10']);
});

test('a lease id typed differently in the sales or billing file still finds its lease', () => {
  const r = run(yearOf(60000, { lease_id: 'l1' }), lease(), { billedRows: [{ lease_id: 'L 1', date: '2025-06-01', charge_code: 'PCTRNT', description: 'Percentage rent estimate', charge: '2000' }] });
  assert.equal(r.unmatched.length, 0); assert.equal(r.items[0].owed, 7200); assert.equal(r.items[0].billed, 2000); assert.equal(r.items[0].balance, 5200);
});

test('a month with zero sales is a report, and the breakpoint has an exact edge', () => {
  const zero = run([...yearOf(60000).slice(1), sale('2025-01', 0, { reported_on: '' })]); assert.ok(!codes(zero).includes('sales_missing')); assert.equal(zero.items[0].months_reported, 12);
  assert.equal(run(yearOf(50000)).items[0].owed, 0);
  assert.equal(run([...yearOf(50000).slice(1), sale('2025-01', 50100, { reported_on: '' })]).items[0].owed, 6);
});

test('a later report replaces an earlier one and says so; two different reports on one date stop the calculation', () => {
  const rev = run([...yearOf(60000), sale('2025-03', 66000, { reported_on: '2025-05-02' })]);
  assert.deepEqual(codes(rev), ['sales_revised']); assert.equal(rev.items[0].net_sales, 726000);
  const two = run([...yearOf(60000, { reported_on: '2026-01-10' }), sale('2025-03', 66000, { reported_on: '2026-01-10' })]);
  assert.ok(codes(two).includes('conflicting_reports')); assert.equal(two.items[0].status, 'review');
});

test('a fixed breakpoint is prorated by days in a part year, unless the lease says not to', () => {
  const part = lease({ start: '2025-07-01' });
  const r = run(months(2025).slice(6).map((m) => sale(m, 60000, { reported_on: '' })), part);
  assert.equal(r.items[0].breakpoint, 302465.75); assert.ok(codes(r).includes('breakpoint_prorated')); assert.equal(r.items[0].owed, 3452.06);
  const full = run(months(2025).slice(6).map((m) => sale(m, 60000, { reported_on: '' })), { ...part, percentage_rent: { ...part.percentage_rent, prorate_partial_year: false } });
  assert.equal(full.items[0].breakpoint, 600000); assert.equal(full.items[0].owed, 0);
});

test('estimates billed above what was earned are a credit to the tenant, and missing reports produce a request, not a statement', () => {
  const r = run(yearOf(60000), lease(), { billedRows: [{ lease_id: 'L-1', date: '2025-06-01', description: 'Percentage rent estimate', charge: '9000' }] });
  assert.equal(r.items[0].status, 'credit'); assert.equal(r.items[0].balance, -1800); assert.match(statementText(r.items[0], r), /Credit due to tenant: 1,800\.00/);
  const miss = run(yearOf(60000).slice(0, 10)); assert.equal(miss.items[0].owed, null); assert.equal(miss.items[0].status, 'review');
  assert.match(statementText(miss.items[0], miss), /^# Request for sales reports/); assert.match(statementText(miss.items[0], miss), /2025-11, 2025-12/);
});
