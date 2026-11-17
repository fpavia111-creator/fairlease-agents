import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFilings, tinProblem, flag1099, w9RequestText } from '../src/filings.js';

const pay = (payee, amount, date = '2026-03-01', extra = {}) => ({ payee, amount, date, ...extra });
const base = { taxYear: 2026, threshold: 2000 };

test('threshold is required and has no default', () => {
  assert.throws(() => checkFilings({ payments: [], taxYear: 2026 }), /threshold is required/);
});

test('tax ID format check: nine digits, no placeholders', () => {
  assert.equal(tinProblem('12-3456780'), null);
  assert.equal(tinProblem('123 45 6780'), null);
  assert.equal(tinProblem(''), 'missing');
  assert.equal(tinProblem('123-45-678'), 'not nine digits');
  assert.equal(tinProblem('12-345678X'), 'not nine digits');
  assert.equal(tinProblem('000000000'), 'placeholder number');
  assert.equal(tinProblem('123456789'), 'placeholder number');
});

test('1099 flags in several spellings', () => {
  assert.equal(flag1099('Yes'), true); assert.equal(flag1099('No'), false); assert.equal(flag1099('Sí'), true);
  assert.equal(flag1099('1099-MISC'), 'MISC'); assert.equal(flag1099('NEC'), 'NEC'); assert.equal(flag1099(''), null);
});

test('records on one tax ID are added together; tax IDs are masked everywhere', () => {
  const vendors = [{ vendor: 'Alpha Repairs', tax_id: '11-2223334', address: 'x' }, { vendor: 'Alpha Repair Svc', tax_id: '112223334', address: 'x' }];
  const r = checkFilings({ ...base, vendors, payments: [pay('Alpha Repairs', 1200), pay('Alpha Repair Svc', 900)] });
  assert.equal(r.items.length, 1); assert.equal(r.items[0].total, 2100); assert.equal(r.items[0].status, 'fix');
  assert.deepEqual(r.items[0].findings.map((f) => f.code), ['shared_tin']);
  assert.ok(!JSON.stringify(r).includes('2223334'));
});

test('excluded methods are left out of the total and the list is the caller\'s', () => {
  const vendors = [{ vendor: 'Beta', tax_id: '22-3334445', address: 'x' }];
  const payments = [pay('Beta', 1500, '2026-01-02', { method: 'Check' }), pay('Beta', 900, '2026-02-02', { method: 'Visa Credit Card' })];
  const a = checkFilings({ ...base, vendors, payments });
  assert.equal(a.items[0].total, 1500); assert.equal(a.items[0].excluded, 900); assert.equal(a.items[0].status, 'below_threshold');
  const b = checkFilings({ ...base, vendors, payments, excludeMethods: ['paypal'] });
  assert.equal(b.items[0].total, 2400); assert.equal(b.items[0].status, 'ready');
});

test('other years and undated payments are skipped and counted', () => {
  const r = checkFilings({ ...base, vendors: [], payments: [pay('Gamma', 5000, '2025-12-31'), pay('Gamma', 100, 'n/a'), pay('Gamma', 2500, '2026-07-01')] });
  assert.equal(r.items[0].total, 2500); assert.equal(r.other_year_payments, 1); assert.equal(r.skipped_undated, 1);
  assert.deepEqual(r.items[0].findings.map((f) => f.code), ['payee_not_in_directory']);
});

test('rents to an owner suggest MISC; law firms and corporations go to confirm', () => {
  const vendors = [
    { vendor: 'Owner One LLC', trade: 'Owner', tax_id: '33-4445556', address: 'x' },
    { vendor: 'Doe Law PC', trade: 'Legal', tax_id: '44-5556667', address: 'x', entity_type: 'C Corporation' },
    { vendor: 'Widget Corp', tax_id: '55-6667778', address: 'x' },
    { vendor: 'Floors Inc', tax_id: '66-7778889', address: 'x', type_1099: 'No' },
  ];
  const r = checkFilings({ ...base, vendors, payments: [pay('Owner One LLC', 9000, '2026-02-01', { account: 'Owner rent distribution' }), pay('Doe Law PC', 3000), pay('Widget Corp', 3000), pay('Floors Inc', 3000)] });
  const by = Object.fromEntries(r.items.map((i) => [i.payee, i]));
  assert.equal(by['Owner One LLC'].form, 'MISC'); assert.equal(by['Owner One LLC'].status, 'ready');
  assert.equal(by['Doe Law PC'].status, 'confirm'); assert.equal(by['Doe Law PC'].findings[0].code, 'attorney');
  assert.equal(by['Widget Corp'].status, 'confirm'); assert.equal(by['Widget Corp'].findings[0].code, 'corporation');
  assert.equal(by['Floors Inc'].status, 'confirm'); assert.equal(by['Floors Inc'].findings[0].code, 'directory_says_no_1099');
});

test('missing address and W-9 block a payee over the threshold', () => {
  const r = checkFilings({ ...base, vendors: [{ vendor: 'Delta', tax_id: '77-8889990', w9_on_file: 'No' }], payments: [pay('Delta', 2000)] });
  assert.equal(r.items[0].status, 'fix'); assert.deepEqual(r.items[0].findings.map((f) => f.code), ['address_missing', 'w9_missing']);
});

test('Japanese rent words count as rent', () => {
  const r = checkFilings({ ...base, vendors: [{ vendor: '山田不動産', tax_id: '88-9990001', address: 'x' }], payments: [pay('山田不動産', 3000, '2026-04-01', { account: '家賃 支払' })] });
  assert.equal(r.items[0].form, 'MISC');
});

test('the W-9 request never contains a tax ID and asks for a secure channel', () => {
  const r = checkFilings({ ...base, vendors: [{ vendor: 'Echo', tax_id: '99-000111', address: '', email: 'e@example.com' }], payments: [pay('Echo', 2500)] });
  const t = w9RequestText(r.items[0], { tax_year: 2026 });
  assert.ok(!t.includes('000111')); assert.match(t, /Form W-9/); assert.match(t, /mailing address/); assert.match(t, /secure upload/); assert.match(t, /e@example.com/);
});
