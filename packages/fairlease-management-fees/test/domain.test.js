// Management fees against the agreement: the edge cases an owner's accountant would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFees, creditText } from '../src/index.js';

const ag = (over = {}) => ({ agreements: [{ owner: 'Maple Court Holdings LLC', property: 'Maple Court', management_fee_pct: 6, ...over }] });
const row = (description, over = {}) => ({ owner: 'Maple Court Holdings LLC', property: 'Maple Court', date: '2026-10-05', type: '', account: '', description, ...over });
const rent = (amount) => row('Rent deposit batch', { type: 'Receipt', income: String(amount) });
const fee = (description, amount, over = {}) => row(description, { type: 'Fee', expense: String(amount), ...over });
const run = (rows, agreements = ag(), rentRoll = null) => checkFees({ ledgerRows: rows, agreements, rentRoll });
const codes = (r) => r.items[0].findings.map((f) => f.code);

test('a bounced rent payment comes off the fee base, whichever column the reversal is in', () => {
  const a = run([rent(40000), row('NSF reversal - unit 204', { type: 'Receipt', income: '-2000' }), fee('Management fee October', 2400)]);
  assert.equal(a.items[0].fee_base, 38000); assert.deepEqual(codes(a), ['management_fee_over']); assert.equal(a.items[0].overcharge, 120);
  const b = run([rent(40000), row('Returned payment NSF - unit 204', { type: 'Reversal', expense: '2000' }), fee('Management fee October', 2280)]);
  assert.equal(b.items[0].fee_base, 38000); assert.deepEqual(codes(b), []);
});

test('bank, permit and association fees are costs passed through, not fees the manager charges', () => {
  const r = run([rent(40000), fee('Management fee October', 2400), fee('Bank service fee', 25, { type: 'Bill' }), fee('City permit fee - water heater', 180, { type: 'Bill' }), fee('HOA fee Q4', 600, { type: 'Bill' }), fee('Annual inspection fee', 95)]);
  assert.deepEqual(codes(r), ['fee_not_in_agreement']); assert.match(r.items[0].findings[0].detail, /Annual inspection fee 95/);
});

test('the same leasing fee charged twice for one unit is a duplicate', () => {
  const r = run([rent(40000), fee('Management fee October', 2400), fee('Leasing fee unit 101', 500), fee('Leasing fee unit 101', 500, { date: '2026-10-20' })], ag({ leasing_fee: { flat: 500 } }));
  assert.deepEqual(codes(r), ['duplicate_fee']); assert.equal(r.items[0].overcharge, 500);
});

test('a fee and the credit that corrects it in the same month net out', () => {
  const r = run([rent(40000), fee('Management fee October', 2640), fee('Management fee credit', -240, { date: '2026-10-28' })]);
  assert.equal(r.items[0].charged_management_fee, 2400); assert.deepEqual(codes(r), []);
});

test('the minimum applies when the percentage is lower, the cap when it is higher, and your tolerance has an exact edge', () => {
  assert.equal(run([rent(10000), fee('Management fee', 1000)], ag({ minimum_monthly: 1000 })).items[0].expected_management_fee, 1000);
  assert.equal(run([rent(90000), fee('Management fee', 5000)], ag({ maximum_monthly: 5000 })).items[0].expected_management_fee, 5000);
  assert.deepEqual(codes(run([rent(40000), fee('Management fee', 2401)])), []);
  assert.deepEqual(codes(run([rent(40000), fee('Management fee', 2401.01)])), ['management_fee_over']);
});

test('a leasing fee set as a share of rent is checked against the unit in the rent roll, and left unverified when no unit is named', () => {
  const roll = [{ unit: '101', tenant: 'Aiko Tanaka', rent: '1400' }, { unit: '1010', tenant: 'Ben Okafor', rent: '2000' }]; const a = ag({ leasing_fee: { pct_of_monthly_rent: 50 } });
  assert.deepEqual(codes(run([rent(40000), fee('Management fee', 2400), fee('Leasing fee - unit 101', 900)], a, roll)), ['leasing_fee_over']);
  assert.deepEqual(codes(run([rent(40000), fee('Management fee', 2400), fee('Leasing fee - unit 1010', 1000)], a, roll)), []);
  assert.deepEqual(codes(run([rent(40000), fee('Management fee', 2400), fee('Leasing fee', 700)], a, roll)), ['leasing_fee_unverified']);
  assert.deepEqual(codes(run([rent(40000), fee('Management fee', 2400), fee('Leasing fee - unit 101', 700)], ag(), roll)), ['leasing_fee_not_in_agreement']);
});

test('a maintenance markup is measured on repair bills only, not on utilities, insurance or other fees', () => {
  const rows = [rent(40000), fee('Management fee', 2400), row('Plumbing repair', { type: 'Bill', expense: '1000' }), row('Water bill', { type: 'Bill', expense: '3000' }), row('Property insurance', { type: 'Bill', expense: '5000' })];
  assert.deepEqual(codes(run([...rows, fee('Maintenance markup', 100)], ag({ maintenance_markup_pct: 10 }))), []);
  const r = run([...rows, fee('Maintenance markup', 900)], ag({ maintenance_markup_pct: 10 })); assert.deepEqual(codes(r), ['markup_over']); assert.equal(r.items[0].overcharge, 800);
});

test('an owner with no agreement on file is named, not guessed at, and the credit note adds up only what was overcharged', () => {
  const r = run([rent(40000), fee('Management fee', 2500), { ...rent(5000), owner: 'Unknown Owner LLC' }, { ...fee('Management fee', 900), owner: 'Unknown Owner LLC' }]);
  assert.deepEqual(r.owners_without_agreement, ['Unknown Owner LLC (Maple Court)']); assert.equal(r.items.length, 1);
  assert.match(creditText(r.items[0]), /Total to be credited: 100\./);
});
