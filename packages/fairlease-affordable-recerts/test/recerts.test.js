import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRecerts, programFor, reminderText } from '../src/recerts.js';

const policy = { programs: { 'Section 8': { frequency_months: 12, notice_days: [120, 90, 60], start_days_before: 120, words: ['hud'] }, LIHTC: { frequency_months: 12, notice_days: [90], start_days_before: 90 } }, due_soon_days: 30 };
const h = (extra) => ({ household: 'Doe household', unit: '1', program: 'Section 8', ...extra });

test('programs match by name or words, with an optional default', () => {
  assert.equal(programFor('HUD Section 8 HAP', policy), 'Section 8');
  assert.equal(programFor('lihtc 60%', policy), 'LIHTC');
  assert.equal(programFor('Other', policy), null);
  assert.equal(programFor('Other', { ...policy, default_program: 'LIHTC' }), 'LIHTC');
});

test('next due comes from the tracker, or last certification plus the frequency', () => {
  const r = checkRecerts({ households: [h({ last_cert: '2026-03-01' })], policy, asOf: '2026-05-01' });
  assert.equal(r.items[0].next_due, '2027-03-01'); assert.equal(r.items[0].status, 'ok');
});

test('overdue, due soon and in window', () => {
  const r = checkRecerts({ households: [h({ household: 'A', unit: '1', last_cert: '2025-04-01', notice_sent: '2025-12-02', second_notice: '2026-01-01', third_notice: '2026-01-30' }), h({ household: 'B', unit: '2', last_cert: '2025-05-20', notice_sent: '2026-01-20', second_notice: '2026-02-19', third_notice: '2026-03-21' }), h({ household: 'C', unit: '3', program: 'LIHTC', last_cert: '2025-07-15', notice_sent: '2026-04-10' })], policy, asOf: '2026-05-01' });
  const by = Object.fromEntries(r.items.map((i) => [i.household, i]));
  assert.equal(by.A.status, 'overdue'); assert.equal(by.A.days_left, -30);
  assert.equal(by.B.status, 'due_soon'); assert.deepEqual(by.B.findings.map((f) => f.code), ['due_soon']);
  assert.equal(by.C.status, 'in_window');
});

test('notices from the previous cycle do not count; late notices are flagged', () => {
  const r = checkRecerts({ households: [h({ last_cert: '2026-01-01', notice_sent: '2025-09-01', second_notice: '2026-10-10' })], policy, asOf: '2026-11-15' });
  const codes = r.items[0].findings.map((f) => f.code);
  assert.deepEqual(codes, ['notice_missing', 'notice_late', 'notice_missing', 'in_window']);
});

test('a due date that disagrees with the last certification is flagged', () => {
  const r = checkRecerts({ households: [h({ last_cert: '2026-01-01', next_due: '2027-03-15' })], policy, asOf: '2026-05-01' });
  assert.ok(r.items[0].findings.some((f) => f.code === 'due_date_differs')); assert.equal(r.items[0].next_due, '2027-03-15');
});

test('unknown program and missing dates are reported, never guessed silently', () => {
  const r = checkRecerts({ households: [h({ program: 'Voucher X', last_cert: '2026-01-01' }), h({ household: 'E', unit: '5' }), h({ household: 'F', unit: '6', move_in: '2024-06-01' })], policy, asOf: '2026-05-01' });
  const by = Object.fromEntries(r.items.map((i) => [i.household, i]));
  assert.deepEqual(by['Doe household'].findings.map((f) => f.code), ['program_unknown']);
  assert.deepEqual(by.E.findings.map((f) => f.code), ['last_cert_missing', 'due_unknown']);
  assert.equal(by.F.next_due, '2026-06-01'); assert.ok(by.F.findings.some((f) => f.code === 'due_from_move_in'));
});

test('rent roll: untracked occupied units, vacant tracked units, market units skipped', () => {
  const rentRoll = [{ unit: '1', tenant: 'Jane Doe' }, { unit: '2', tenant: 'VACANT' }, { unit: '3', tenant: 'Sam Roe' }, { unit: '4', tenant: 'Market Person' }];
  const r = checkRecerts({ households: [h({ last_cert: '2026-01-01' }), h({ household: 'Moe household', unit: '2', last_cert: '2026-01-01' })], rentRoll, policy: { ...policy, market_units: ['4'] }, asOf: '2026-05-01' });
  const by = Object.fromEntries(r.items.map((i) => [i.unit, i]));
  assert.deepEqual(by['1'].findings, []);
  assert.deepEqual(by['2'].findings.map((f) => f.code), ['not_in_rent_roll']);
  assert.deepEqual(by['3'].findings.map((f) => f.code), ['not_tracked']);
  assert.equal(by['4'], undefined);
});

test('calendar events are future notices and due dates', () => {
  const r = checkRecerts({ households: [h({ last_cert: '2026-01-01' })], policy, asOf: '2026-05-01' });
  assert.deepEqual(r.events.map((e) => e.date), ['2026-09-03', '2026-10-03', '2026-11-02', '2027-01-01']);
});

test('the reminder lists policy documents and never mentions income figures', () => {
  const r = checkRecerts({ households: [h({ last_cert: '2025-06-01' })], policy, asOf: '2026-05-15' });
  const t = reminderText(r.items[0], {}, { documents: ['Photo ID'] });
  assert.match(t, /due 2026-06-01/); assert.match(t, /- Photo ID/); assert.match(t, /\[TO CONFIRM: how to book\]/);
  assert.match(reminderText(r.items[0], {}, {}), /\[TO CONFIRM: list of documents/);
});
