import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locate, extractTerms, buildAbstract, compareAbstract } from '../src/index.js';

test('lines know their page and section', () => {
  const L = locate('1.1 Premises. Suite 5\n--- Page 3 ---\nARTICLE 4. RENT\n4.2 Rent shall increase');
  assert.deepEqual(L.map((x) => [x.page, x.section]), [[1, '1.1'], [3, '1.1'], [3, '4'], [3, '4.2']]);
});

test('written numbers with digits in brackets, and dates in three shapes', () => {
  const t = extractTerms('Tenant shall deliver an annual statement of Gross Sales within ninety (90) days\nCommencement Date of 3/1/2024\nExpiration Date is 2029-02-28').terms;
  assert.equal(t.pct_rent_report_days.value, 90); assert.equal(t.start.value, '2024-03-01'); assert.equal(t.end.value, '2029-02-28');
});

test('missing required terms become open items with [TO CONFIRM] values, never guesses', () => {
  const r = buildAbstract('between A LLC ("Landlord") and B Inc ("Tenant")');
  assert.equal(r.lease.unit, '[TO CONFIRM: unit]'); assert.deepEqual(r.open.map((o) => o.field), ['unit', 'start', 'end', 'rent', 'deposit']);
});

test('CPI escalation is flagged for a person, not filled in', () => {
  const r = buildAbstract('Base Rent shall be adjusted each year by the change in the Consumer Price Index.');
  assert.equal(r.lease.escalation.type, 'cpi'); assert.ok(r.open.some((o) => /CPI/.test(o.detail)));
});

test('compare ignores terms the text does not state', () => {
  const r = compareAbstract({ lease_id: 'X', unit: 'Suite 9', tenant: 'B Inc', start: '2024-01-01', end: '2025-12-31', deposit: 100 }, 'between A ("Landlord") and B Inc ("Tenant")');
  assert.equal(r.status, 'ok');
});
