// Recertification dates: the edge cases a compliance coordinator would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRecerts, programFor } from '../src/index.js';

const policy = { programs: { 'Section 8': { frequency_months: 12, notice_days: [120, 90, 60], start_days_before: 120, words: ['hud', 'hap'] }, LIHTC: { frequency_months: 12, notice_days: [90], start_days_before: 90, words: ['tax credit'] }, HOME: { frequency_months: 12, notice_days: [60] } }, due_soon_days: 30, market_units: ['110'] };
const hh = (over = {}) => ({ household: 'Rivera household', unit: '101', program: 'LIHTC', move_in: '2022-03-01', last_cert: '2026-03-01', next_due: '2027-03-01', status: 'Completed', ...over });
const run = (households, rentRoll = null, asOf = '2026-11-15') => checkRecerts({ households, rentRoll, policy, asOf });
const codes = (i) => i.findings.map((f) => f.code);

test('program words match whole words: "Homeless preference" is not HOME, "HAP contract" is Section 8', () => {
  assert.equal(programFor('Homeless preference voucher', policy), null); assert.equal(programFor('HAP contract', policy), 'Section 8');
  assert.equal(programFor('Chapter 40B', policy), null); assert.equal(programFor('HOME', policy), 'HOME'); assert.equal(programFor('Tax Credit 60%', policy), 'LIHTC');
});

test('a market unit is skipped however the rent roll writes it', () => {
  const r = run([hh()], [{ unit: '101', tenant: 'Ana Rivera' }, { unit: 'Apt 110', tenant: 'Market Renter' }, { unit: '#0110', tenant: 'Market Renter' }]);
  assert.deepEqual(r.items.filter((i) => i.kind === 'untracked'), []);
});

test('a next-due date that was never moved forward after the last certification is not counted as overdue', () => {
  const r = run([hh({ next_due: '2026-03-01' })]);
  assert.deepEqual(codes(r.items[0]), ['due_date_differs']); assert.equal(r.items[0].next_due, '2027-03-01'); assert.equal(r.items[0].status, 'review');
  assert.match(r.items[0].findings[0].detail, /not after the last certification 2026-03-01, so 2027-03-01 is used/);
  assert.ok(codes(run([hh({ last_cert: '2027-03-01', next_due: '' })]).items[0]).includes('last_cert_in_future'));
});

test('a notice already recorded is not put on the calendar again; one still to send is', () => {
  const s8 = hh({ program: 'Section 8', notice_sent: '2026-10-30', next_due: '2027-03-01' });
  const r = run([s8]);
  assert.deepEqual(r.events.map((e) => [e.date, e.summary.split(':')[0]]), [['2026-12-01', '90-day recertification notice'], ['2026-12-31', '60-day recertification notice'], ['2027-03-01', 'Recertification due']]);
});

test('a household that moved out is closed, not overdue', () => {
  const r = run([hh({ last_cert: '2025-06-01', next_due: '2026-06-01', status: 'Moved out' })]);
  assert.equal(r.items[0].status, 'closed'); assert.deepEqual(codes(r.items[0]), []); assert.match(r.summary, /0 overdue/);
});

test('unit 101 in two properties is checked against its own property in the rent roll', () => {
  const r = run([hh({ property: 'Birch Row' }), hh({ household: 'Chen household', property: 'Cedar Court' })], [{ property: 'Birch Row', unit: '101', tenant: 'Ana Rivera' }, { property: 'Cedar Court', unit: '101', tenant: 'Wei Chen' }]);
  assert.deepEqual(r.items.map((i) => codes(i)), [[], []]);
});

test('the same unit twice in the tracker is pointed out', () => {
  const r = run([hh(), hh({ household: 'Chen household' })]);
  assert.ok(r.items.every((i) => codes(i).includes('unit_listed_twice'))); assert.ok(r.items.every((i) => i.status === 'review'));
});

test('a notice sent on its last day is on time, the day after is late, and one from the previous cycle does not count', () => {
  const base = { last_cert: '2025-12-01', next_due: '2026-12-01' }; // 90-day notice by 2026-09-02
  assert.deepEqual(codes(run([hh({ ...base, notice_sent: '2026-09-02' })]).items[0]), ['due_soon']);
  assert.deepEqual(codes(run([hh({ ...base, notice_sent: '2026-09-03' })]).items[0]), ['notice_late', 'due_soon']);
  assert.deepEqual(codes(run([hh({ ...base, notice_sent: '2025-09-01' })]).items[0]), ['notice_missing', 'due_soon']);
});
