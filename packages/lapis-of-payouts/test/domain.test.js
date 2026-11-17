// Short-term rental payouts: the edge cases a host's bookkeeper would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePayouts } from '../src/index.js';

const policy = { channels: { airbnb: { fee_pct: 3, fee_base: 'gross_plus_cleaning', payout_lag_days: 2 } }, bank_lag_days: 5, tolerance: 1 };
const line = (id, amount, over = {}) => ({ type: 'Reservation', booking_id: id, check_in: '2026-10-02', nights: '3', listing: 'Pine Loft', amount: String(amount), payout_date: '2026-10-03', ...over });
const payout = (date, amount) => ({ type: 'Payout', paid_out: String(amount), payout_date: date });
const booking = (id, expected, over = {}) => ({ booking_id: id, channel: 'Airbnb', listing: 'Pine Loft', check_in: '2026-10-02', check_out: '2026-10-05', nights: '3', amount: String(expected), status: 'Confirmed', ...over });
const run = (rows, bookings = null, bank = null, extra = {}) => reconcilePayouts({ payoutFiles: [{ channel: 'airbnb', rows }], bookings, bank, policy, asOf: '2026-11-15', ...extra });
const one = (r, id) => r.items.find((i) => i.booking_id === id); const codes = (i) => i.findings.map((f) => f.code);

test('a confirmation code typed in lower case or with spaces is the same booking', () => {
  const r = run([line('HMA1QX7Z', 727.5)], [booking(' hma1qx7z', 727.5)]);
  assert.equal(r.items.filter((i) => i.kind === 'booking').length, 1); assert.equal(r.items[0].status, 'ok');
});

test('a long stay paid in equal instalments is not a duplicate; the same payout twice is', () => {
  const split = run([line('HMLONG', 1000, { nights: '60' }), line('HMLONG', 1000, { nights: '60', payout_date: '2026-11-03' })], [booking('HMLONG', 2000, { nights: '60', check_out: '2026-12-01' })]);
  assert.deepEqual(codes(one(split, 'HMLONG')), []); assert.equal(one(split, 'HMLONG').status, 'ok');
  const dup = run([line('HMA', 500), line('HMA', 500, { payout_date: '2026-10-10' })], [booking('HMA', 500)]);
  assert.deepEqual(codes(one(dup, 'HMA')).sort(), ['duplicate_payout', 'payout_over']);
});

test('a payroll "DIRECT DEPOSIT" on the bank statement is not a channel payout; an unexplained Airbnb deposit is', () => {
  const bank = [{ date: '2026-10-05', description: 'AIRBNB PAYMENTS 4471', credit: '727.50' }, { date: '2026-10-06', description: 'DIRECT DEPOSIT ACME PAYROLL', credit: '2100' }, { date: '2026-10-09', description: 'AIRBNB PAYMENTS 4471', credit: '310' }];
  const r = run([line('HMA', 727.5), payout('2026-10-03', 727.5)], null, bank);
  assert.deepEqual(r.items.filter((i) => i.kind === 'deposit').map((i) => i.amount), [310]);
  assert.equal(r.items.find((i) => i.kind === 'transfer').status, 'ok');
});

test('two exports that overlap do not double a booking or its payout', () => {
  const rows = [line('HMA', 727.5), payout('2026-10-03', 727.5)];
  const r = reconcilePayouts({ payoutFiles: [{ channel: 'airbnb', rows }, { channel: 'airbnb', rows: [...rows, line('HMB', 300, { payout_date: '2026-10-12' }), payout('2026-10-12', 300)] }], bookings: [booking('HMA', 727.5), booking('HMB', 300)], policy, asOf: '2026-11-15', bank: [{ date: '2026-10-05', description: 'AIRBNB', credit: '727.50' }, { date: '2026-10-13', description: 'AIRBNB', credit: '300' }] });
  assert.deepEqual(r.items.map((i) => [i.kind, i.status]), [['booking', 'ok'], ['booking', 'ok'], ['transfer', 'ok'], ['transfer', 'ok']]);
  assert.match(r.summary, /2 line\(s\) appear in more than one file and were counted once/);
});

test('a cancelled booking with no payout is not missing; one that was still paid is asked about', () => {
  const r = run([line('HMPAID', 120)], [booking('HMPAID', 500, { status: 'Cancelled by guest' }), booking('HMGONE', 500, { status: 'Canceled' })]);
  assert.deepEqual(codes(one(r, 'HMPAID')), ['paid_while_cancelled']); assert.equal(one(r, 'HMGONE').status, 'cancelled'); assert.equal(r.short_or_missing, 0);
});

test('a resolution adjustment against a booking makes it short by exactly that amount', () => {
  const r = run([line('HMA', 727.5), line('HMA', -50, { type: 'Resolution Adjustment', payout_date: '2026-10-20' })], [booking('HMA', 727.5)]);
  assert.deepEqual(codes(one(r, 'HMA')), ['payout_short']); assert.equal(one(r, 'HMA').findings[0].amount, -50); assert.equal(r.short_or_missing, 50);
});

test('the channel fee is checked on the base you set: the stay alone, or the stay plus cleaning', () => {
  const l = line('HMA', 727.5, { gross: '600', cleaning_fee: '150', service_fee: '22.50' });
  assert.deepEqual(codes(one(run([l]), 'HMA')), []);
  const stayOnly = reconcilePayouts({ payoutFiles: [{ channel: 'airbnb', rows: [l] }], policy: { channels: { airbnb: { fee_pct: 3, fee_base: 'gross' } } }, asOf: '2026-11-15' });
  assert.deepEqual(codes(stayOnly.items[0]), ['payout_short', 'fee_rate_differs']); assert.equal(stayOnly.items[0].findings[1].amount, 4.5);
});

test('a payout is only missing once the channel has had its days, and only missing from the bank once the bank has had its days', () => {
  const b = [booking('HMSOON', 400, { check_in: '2026-11-13', check_out: '2026-11-15', nights: '2' }), booking('HMLATE', 400, { check_in: '2026-11-12', check_out: '2026-11-14', nights: '2' })];
  const r = run([], b); assert.equal(one(r, 'HMSOON').status, 'pending'); assert.equal(one(r, 'HMLATE').status, 'missing');
  const t = run([line('HMA', 300, { payout_date: '2026-11-10' }), payout('2026-11-10', 300), line('HMB', 200, { payout_date: '2026-11-09' }), payout('2026-11-09', 200)], null, [{ date: '2026-10-01', description: 'OTHER', credit: '1' }]);
  assert.deepEqual(t.items.filter((i) => i.kind === 'transfer').map((i) => [i.date, i.status]), [['2026-11-09', 'missing'], ['2026-11-10', 'pending']]);
});
