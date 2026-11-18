import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePayouts, readPayoutFile, channelOf, listingName, inquiryText } from '../src/payouts.js';

const policy = { channels: { airbnb: { fee_pct: 3, payout_lag_days: 2 } }, listings: { Cabin: { cleaning_fee: 100, aliases: ['Cozy Cabin!'] } }, bank_lag_days: 3, tolerance: 1 };
const asOf = '2026-03-31';
const line = (id, extra = {}) => ({ booking_id: id, type: 'Reservation', listing: 'Cabin', check_in: '2026-03-01', check_out: '2026-03-03', nights: 2, gross: 200, cleaning_fee: 100, service_fee: 9, amount: 291, payout_date: '2026-03-02', ...extra });

test('channels are read from names and descriptions', () => {
  assert.equal(channelOf('airbnb transactions 2026'), 'airbnb');
  assert.equal(channelOf('HOMEAWAY VRBO PAYOUT'), 'vrbo');
  assert.equal(channelOf('FeWo-direkt Auszahlungen'), 'vrbo');
  assert.equal(channelOf('Booking.com payout'), 'booking');
  assert.equal(channelOf('CLEANCO'), null);
});

test('listing aliases from the policy and from memory', () => {
  assert.equal(listingName('cozy cabin!', policy), 'Cabin');
  assert.equal(listingName('Seaside 2BR', policy, { 'Seaside 2BR': 'Seaside' }), 'Seaside');
  assert.equal(listingName('Other', policy), 'Other');
});

test('payout rows become transfers; channels with none are grouped by payout date', () => {
  const a = readPayoutFile([line('A'), { type: 'Payout', paid_out: 291, payout_date: '2026-03-02' }], 'airbnb', policy);
  assert.equal(a.lines.length, 1); assert.deepEqual(a.transfers.map((t) => t.amount), [291]);
  const v = readPayoutFile([line('B', { amount: 100, payout_date: '2026-03-05' }), line('C', { amount: 50, payout_date: '2026-03-05' })], 'vrbo', policy);
  assert.deepEqual(v.transfers, [{ channel: 'vrbo', date: '2026-03-05', amount: 150, explicit: false }]);
});

test('gross that includes cleaning is split back out', () => {
  const a = readPayoutFile([line('A', { gross: 300 })], 'airbnb', policy);
  assert.equal(a.lines[0].gross, 200);
});

test('a clean booking is ok; expected comes from the rates when there is no reservation file', () => {
  const r = reconcilePayouts({ payoutFiles: [{ channel: 'airbnb', rows: [line('A')] }], policy, asOf });
  assert.equal(r.items[0].status, 'ok'); assert.equal(r.items[0].expected, 291);
});

test('missing, short, duplicate, fee and cleaning differences', () => {
  const bookings = [
    { booking_id: 'A', channel: 'Airbnb', listing: 'Cabin', check_in: '2026-03-01', check_out: '2026-03-03', amount: 291 },
    { booking_id: 'B', channel: 'Airbnb', listing: 'Cabin', check_in: '2026-03-10', check_out: '2026-03-12', amount: 291 },
    { booking_id: 'C', channel: 'Airbnb', listing: 'Cabin', check_in: '2026-03-20', check_out: '2026-03-23', amount: 400 },
    { booking_id: 'D', channel: 'Airbnb', listing: 'Cabin', check_in: '2026-04-10', check_out: '2026-04-12', amount: 291 },
    { booking_id: 'E', channel: 'Airbnb', listing: 'Cabin', check_in: '2026-03-15', check_out: '2026-03-17', amount: 291, status: 'Cancelled by guest' },
  ];
  const rows = [line('A'), line('A', { payout_date: '2026-03-03' }), line('C', { check_in: '2026-03-20', nights: 2, service_fee: 45, cleaning_fee: 120, amount: 275 })];
  const r = reconcilePayouts({ payoutFiles: [{ channel: 'airbnb', rows }], bookings, policy, asOf });
  const by = Object.fromEntries(r.items.map((i) => [i.id, i]));
  assert.deepEqual(by.A.findings.map((f) => f.code), ['payout_over', 'duplicate_payout']);
  assert.equal(by.B.status, 'missing');
  assert.deepEqual(by.C.findings.map((f) => f.code), ['payout_short', 'fee_rate_differs', 'cleaning_fee_differs', 'nights_differ']);
  assert.equal(by.D.status, 'pending'); assert.equal(by.E.status, 'cancelled');
});

test('payouts are matched to bank deposits within the lag; stray channel deposits are listed', () => {
  const rows = [line('A'), { type: 'Payout', paid_out: 291, payout_date: '2026-03-02' }, line('B', { check_in: '2026-03-10', payout_date: '2026-03-11' }), { type: 'Payout', paid_out: 291, payout_date: '2026-03-11' }];
  const bank = [{ date: '2026-03-04', description: 'AIRBNB 123', credit: 291 }, { date: '2026-03-20', description: 'AIRBNB 123', credit: 291 }, { date: '2026-03-21', description: 'AIRBNB 123', credit: 80 }, { date: '2026-03-21', description: 'RENT', credit: 900 }];
  const r = reconcilePayouts({ payoutFiles: [{ channel: 'airbnb', rows }], bank, policy, asOf });
  const tr = r.items.filter((i) => i.kind === 'transfer');
  assert.deepEqual(tr.map((t) => t.status).sort(), ['missing', 'ok']);
  const dep = r.items.filter((i) => i.kind === 'deposit');
  assert.deepEqual(dep.map((d) => d.amount).sort(), [291, 80].sort());
});

test('the inquiry lists the differences and keeps open items marked', () => {
  const r = reconcilePayouts({ payoutFiles: [{ channel: 'airbnb', rows: [line('A', { amount: 250 })] }], policy, asOf });
  const t = inquiryText(r.items[0], {});
  assert.match(t, /Payout inquiry: A/); assert.match(t, /short 41/); assert.match(t, /\[TO CONFIRM: host account or ID\]/);
});
