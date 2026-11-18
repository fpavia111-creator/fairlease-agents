import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAssociation, applyPayments, dueDates, noticeText } from '../src/associations.js';

const policy = { assessment: { amount: 100, frequency: 'monthly', due_day: 1 }, periods_from: '2026-01', grace_days: 10, late_fee: { flat: 10 }, collection_steps: [{ days: 30, step: 'reminder' }, { days: 90, step: 'board' }], violations: { notice_within_days: 5, cure_days: 14, hearing_before_fine: true, stale_days: 60, repeat_days: 120 } };
const row = (date, type, charge, payment, extra = {}) => ({ account: 'X', owner: 'Owner X', unit: '1', date, type, charge, payment, ...extra });

test('due dates step by frequency and stop at as_of', () => {
  assert.deepEqual(dueDates('2026-01', '2026-03-15'), ['2026-01-01', '2026-02-01', '2026-03-01']);
  assert.deepEqual(dueDates('2026-01', '2026-12-31', 'quarterly', 15), ['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15']);
});

test('payments apply oldest charge first and record when each was paid', () => {
  const r = applyPayments([{ date: '2026-02-01', amount: 100 }, { date: '2026-01-01', amount: 100 }], [{ date: '2026-02-20', amount: 150 }, { date: '2026-03-01', amount: 100 }]);
  assert.equal(r.charges[0].paid_on, '2026-02-20'); assert.equal(r.charges[1].paid_on, '2026-03-01'); assert.equal(r.credit, 50);
});

test('a clean account is ok', () => {
  const r = checkAssociation({ policy, asOf: '2026-02-20', ledger: [row('2026-01-01', 'Assessment', 100), row('2026-01-05', 'Payment', null, 100), row('2026-02-01', 'Assessment', 100), row('2026-02-03', 'Payment', null, 100)] });
  assert.equal(r.items[0].status, 'ok'); assert.deepEqual(r.items[0].findings, []);
});

test('missing, wrong and late are found; the collection step comes from the policy', () => {
  const r = checkAssociation({ policy, asOf: '2026-03-20', ledger: [row('2026-01-01', 'HOA dues', 100), row('2026-02-01', 'HOA dues', 90)] });
  const i = r.items[0]; const codes = i.findings.map((f) => f.code);
  assert.ok(codes.includes('missing_assessment')); assert.ok(codes.includes('wrong_amount')); assert.ok(codes.includes('late_fee_missing'));
  assert.equal(i.status, 'delinquent'); assert.equal(i.days, 78); assert.equal(i.step, 'reminder'); assert.equal(i.next_step, 'board');
});

test('a late fee within grace is flagged, a wrong fee amount too', () => {
  const r = checkAssociation({ policy, asOf: '2026-03-05', ledger: [row('2026-01-01', 'Assessment', 100), row('2026-01-05', 'Payment', null, 100), row('2026-01-12', 'Late fee', 10), row('2026-02-01', 'Assessment', 100), row('2026-02-12', 'Late charge', 15), row('2026-02-20', 'Payment', null, 125), row('2026-03-01', 'Assessment', 100), row('2026-03-02', 'Payment', null, 100)] });
  const codes = r.items[0].findings.map((f) => f.code);
  assert.deepEqual(codes, ['late_fee_not_due', 'late_fee_amount']);
});

test('per-unit amounts override the default and a wrong ledger balance is caught', () => {
  const r = checkAssociation({ policy: { ...policy, assessment: { amount: 100, per_unit: { 1: 150 } } }, asOf: '2026-01-05', ledger: [row('2026-01-01', 'Assessment', 150, null, { balance: 100 })] });
  assert.deepEqual(r.items[0].findings.map((f) => f.code), ['balance_differs']);
});

test('German and Japanese assessment words are read', () => {
  for (const t of ['Hausgeld Januar', '管理費 1月']) {
    const r = checkAssociation({ policy, asOf: '2026-01-05', ledger: [row('2026-01-01', t, 100)] });
    assert.ok(!r.items[0].findings.some((f) => f.code === 'missing_assessment'), t);
  }
});

test('violations follow the policy steps', () => {
  const v = [
    { violation_id: 'A', unit: '1', type: 'Trash', opened: '2026-01-01', notice_1: '2026-01-02', fine: 50 },
    { violation_id: 'B', unit: '1', type: 'trash', opened: '2026-03-01', notice_1: '2026-03-01', hearing: '2026-03-10', status: 'Open' },
    { violation_id: 'C', unit: '2', type: 'Fence', opened: '2026-03-01' },
    { violation_id: 'D', unit: '3', type: 'Noise', opened: '2026-01-01', notice_1: '2026-01-02', status: 'Cured' },
  ];
  const r = checkAssociation({ policy, asOf: '2026-03-12', violations: v });
  const by = Object.fromEntries(r.items.map((i) => [i.id, i]));
  assert.deepEqual(by.A.findings.map((f) => f.code), ['second_notice_due', 'fine_without_hearing', 'stale']);
  assert.deepEqual(by.B.findings.map((f) => f.code), ['repeat']); assert.equal(by.B.status, 'open');
  assert.deepEqual(by.C.findings.map((f) => f.code), ['first_notice_late']);
  assert.equal(by.D.status, 'closed');
});

test('a ledger or a violations log is required', () => {
  assert.throws(() => checkAssociation({ policy, asOf: '2026-01-01' }), /ledger/);
});

test('notices keep open items marked', () => {
  const r = checkAssociation({ policy, asOf: '2026-03-20', ledger: [row('2026-01-01', 'Assessment', 100)], violations: [{ violation_id: 'V1', unit: '1', type: 'Trash', opened: '2026-03-01' }] });
  const acct = noticeText(r.items.find((i) => i.kind === 'account'), { as_of: '2026-03-20' });
  assert.match(acct, /past due/); assert.match(acct, /\[TO CONFIRM: payment address or portal\]/);
  const vio = noticeText(r.items.find((i) => i.kind === 'violation'), {});
  assert.match(vio, /Notice of rule violation/); assert.match(vio, /\[TO CONFIRM: section of the governing documents\]/);
});
