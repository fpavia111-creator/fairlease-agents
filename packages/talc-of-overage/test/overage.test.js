import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOverage, salesByMonth, leaseYear } from '../src/index.js';

const lease = (pr, extra = {}) => ({ leases: [{ lease_id: 'A', unit: '1', tenant: 'Ann Co', start: '2024-01-01', end: '2030-12-31', rent: { monthly: 5000 }, percentage_rent: { rate_pct: 5, report_due_days: 30, ...pr }, ...extra }] });
const year = (total, m0 = 1, y = 2025) => Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(y, m0 - 1 + i, 1)); return { lease_id: 'A', period: d.toISOString().slice(0, 7), gross_sales: String(total / 12), reported_on: d.toISOString().slice(0, 10) }; });

test('natural breakpoint is base rent over the rate; owed is the rate on sales above it', () => {
  const r = computeOverage({ leases: lease({ breakpoint: 'natural' }), rows: year(1_320_000), year: 2025, asOf: '2026-06-30' });
  assert.equal(r.items[0].breakpoint, 1_200_000); assert.equal(r.items[0].owed, 6000);
});

test('free rent does not lower the natural breakpoint', () => {
  const r = computeOverage({ leases: lease({ breakpoint: 'natural' }, { free_rent: [{ from: '2025-01-01', to: '2025-03-31' }] }), rows: year(1_200_000), year: 2025, asOf: '2026-06-30' });
  assert.equal(r.items[0].breakpoint, 1_200_000); assert.equal(r.items[0].owed, 0);
});

test('a fixed breakpoint is prorated for a partial year unless the lease says not to', () => {
  const rows = year(1_000_000).slice(6);
  const half = { leases: [{ ...lease({ breakpoint: 365000 }).leases[0], start: '2025-07-01' }] };
  const r = computeOverage({ leases: half, rows, year: 2025, asOf: '2026-06-30' });
  assert.equal(r.items[0].breakpoint, 184000); assert.ok(r.items[0].findings.some((f) => f.code === 'breakpoint_prorated'));
  half.leases[0].percentage_rent.prorate_partial_year = false;
  assert.equal(computeOverage({ leases: half, rows, year: 2025, asOf: '2026-06-30' }).items[0].breakpoint, 365000);
});

test('a missing month due already makes the year review; one not yet due is only a note', () => {
  const rows = year(1_320_000).filter((x) => x.period !== '2025-12');
  assert.equal(computeOverage({ leases: lease({ breakpoint: 'natural' }), rows, year: 2025, asOf: '2026-03-01' }).items[0].status, 'review');
  const early = computeOverage({ leases: lease({ breakpoint: 'natural' }), rows, year: 2025, asOf: '2026-01-15' }).items[0];
  assert.ok(early.findings.some((f) => f.code === 'reports_not_due')); assert.ok(!early.findings.some((f) => f.code === 'sales_missing'));
});

test('a revision with a later date wins; two different reports on one date are a conflict', () => {
  const l = lease({ breakpoint: 'natural' });
  const { sales } = salesByMonth([{ lease_id: 'A', period: 'Mar 2025', gross_sales: '100', reported_on: '2025-04-05' }, { lease_id: 'A', period: '03/2025', gross_sales: '120', reported_on: '2025-04-20' }], l);
  assert.equal(sales.get('A|2025-03').gross_sales, 120); assert.equal(sales.get('A|2025-03').revised_from, 100);
  const c = salesByMonth([{ lease_id: 'A', period: '2025-03', gross_sales: '100', reported_on: '2025-04-05' }, { lease_id: 'A', period: '2025-03', gross_sales: '90', reported_on: '2025-04-05' }], l);
  assert.equal(c.sales.get('A|2025-03').conflict, true);
});

test('billed percentage rent is subtracted, and a lease year can start in any month', () => {
  assert.deepEqual(leaseYear({ percentage_rent: { year_start_month: 7 } }, 2025).months.slice(0, 2), ['2025-07', '2025-08']);
  const r = computeOverage({ leases: lease({ breakpoint: 'natural' }), rows: year(1_320_000), year: 2025, asOf: '2026-06-30', billedRows: [{ lease_id: 'A', date: '2025-06-01', charge_code: 'PCTRENT', charge: '7000' }, { lease_id: 'A', date: '2025-06-01', charge_code: 'RNT', charge: '5000' }] });
  assert.equal(r.items[0].billed, 7000); assert.equal(r.items[0].balance, -1000); assert.equal(r.items[0].status, 'credit');
});
