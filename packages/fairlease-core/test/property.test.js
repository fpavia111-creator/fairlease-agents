import { fileURLToPath } from 'node:url';
// Property helpers: dates, rent schedules, CPI, CAM, RUBS, matching, export layouts, report languages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import {
  addMonths, monthsBetween, overlapDays, monthsInRange, prorateMonth, unitKey, sameUnit, partyKey, sameParty, maskId,
  rentSchedule, rentAt, rentForMonth, leaseFor, grossUp, capLimit, shareOf, naturalBreakpoint, percentageRent, rubsSplit, chargeKind, agingBucket,
  validate, LEASES_SCHEMA, CAM_SCHEMA, adaptRecords, RENT_ROLL_FIELDS, RENT_ROLL_PROFILES, AGING_FIELDS, AGING_PROFILES, BOOKING_FIELDS, BOOKING_PROFILES, LEDGER_FIELDS,
  writeWorklist, reportWords, EXPORTS, readTable,
} from '../src/index.js';
import { tmp } from './helpers.js';

const lease = (extra = {}) => ({ lease_id: 'L1', unit: 'Suite 100', tenant: 'Acme Bagels LLC', start: '2024-01-01', end: '2028-12-31', sqft: 2000, rent: { monthly: 10000 }, ...extra });

test('dates: months, overlaps, proration', () => {
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2025-11-15', 3), '2026-02-15');
  assert.equal(monthsBetween('2024-01-01', '2024-12-31'), 12);
  assert.equal(monthsBetween('2024-01-15', '2025-01-14'), 12);
  assert.equal(overlapDays('2024-01-01', '2024-01-31', '2024-01-20', '2024-03-01'), 12);
  assert.equal(overlapDays('2024-01-01', '2024-01-31', '2024-02-01', '2024-03-01'), 0);
  assert.deepEqual(monthsInRange('2024-11-20', '2025-02-01'), ['2024-11', '2024-12', '2025-01', '2025-02']);
  assert.equal(prorateMonth(3000, '2024-02', '2024-02-15', null), 1551.72);
});

test('fixed escalations compound from the first anniversary', () => {
  const s = rentSchedule(lease({ escalation: { type: 'fixed_pct', pct: 3 } }));
  assert.deepEqual(s.map((x) => [x.from, x.monthly]), [['2024-01-01', 10000], ['2025-01-01', 10300], ['2026-01-01', 10609], ['2027-01-01', 10927.27], ['2028-01-01', 11255.09]]);
  assert.equal(s.at(-1).to, '2028-12-31');
  assert.equal(rentAt(lease({ escalation: { type: 'fixed_amount', amount: 250 } }), '2026-06-01'), 10500);
});

test('explicit rent steps win over the escalation clause; per-sqft rents convert', () => {
  const l = lease({ rent: { annual_per_sqft: 30, steps: [{ from: '2026-01-01', annual_per_sqft: 32 }] }, escalation: { type: 'fixed_pct', pct: 10 } });
  assert.equal(rentAt(l, '2025-05-01'), 5000);
  assert.equal(rentAt(l, '2026-05-01'), 5333.33);
});

test('CPI escalation applies floor and cap and stops when the index month is missing', () => {
  const l = lease({ escalation: { type: 'cpi', cpi: { index: 'CPI-U', base_month: '2023-11', lag_months: 2, floor_pct: 2, cap_pct: 3 } } });
  const indexes = { 'CPI-U': { '2023-11': 300, '2024-11': 312, '2025-11': 315.12 } };
  const s = rentSchedule(l, { indexes });
  assert.equal(s[1].monthly, 10300); assert.match(s[1].reason, /CPI 3%/);
  assert.equal(s[2].monthly, 10506); assert.match(s[2].reason, /CPI 2%/);
  assert.equal(s[3].monthly, null); assert.equal(s[3].reason, 'index missing');
  assert.equal(rentAt(l, '2027-03-01', { indexes }), null);
});

test('rent for a month prorates by days and applies free rent', () => {
  const l = lease({ start: '2024-01-16', rent: { monthly: 3100 }, free_rent: [{ from: '2024-02-01', to: '2024-02-29' }, { from: '2024-03-01', to: '2024-03-31', pct: 50 }] });
  assert.equal(rentForMonth(l, '2024-01'), 1600);
  assert.equal(rentForMonth(l, '2024-02'), 0);
  assert.equal(rentForMonth(l, '2024-03'), 1550);
  assert.equal(rentForMonth(l, '2023-12'), 0);
});

test('units, parties and masked ids match across systems', () => {
  assert.equal(unitKey('Suite 100'), '100'); assert.equal(unitKey('Ste. 0100'), '100'); assert.equal(unitKey('#100'), '100');
  assert.equal(unitKey('Bldg A Unit 2'), 'a-2'); assert.equal(unitKey('101号室'), '101');
  assert.ok(sameUnit('Unit 4B', '4b')); assert.ok(!sameUnit('', ''));
  assert.equal(partyKey('Acme Bagels, LLC'), partyKey('ACME BAGELS'));
  assert.ok(sameParty('Fictional Dental Group, P.C.', 'fictional dental group pc') || sameParty('Fictional Dental Group', 'fictional dental group'));
  assert.equal(maskId('12-3456789'), '••••••6789');
  const leases = { leases: [lease(), lease({ lease_id: 'L2', start: '2019-01-01', end: '2023-12-31', tenant: 'Old Tenant' })] };
  assert.equal(leaseFor(leases, { unit: '100', date: '2022-06-01' }).lease_id, 'L2');
  assert.equal(leaseFor(leases, { unit: 'ste 100', date: '2025-06-01' }).lease_id, 'L1');
});

test('CAM: gross-up only upward, caps, shares, percentage rent', () => {
  assert.equal(grossUp(100000, 80, 95), 118750); assert.equal(grossUp(100000, 97, 95), 100000);
  assert.equal(capLimit({ pct: 5, base_year: 2023, base_amount: 10000 }, 2026), 11576.25);
  assert.equal(capLimit({ pct: 5, type: 'noncumulative' }, 2026, 10500), 11025);
  assert.equal(capLimit({ pct: 5, type: 'noncumulative' }, 2026), null);
  assert.equal(shareOf(lease(), 40000), 5); assert.equal(shareOf(lease({ cam: { share_pct: 6.25 } }), 40000), 6.25);
  assert.equal(naturalBreakpoint(120000, 6), 2000000);
  assert.equal(percentageRent(2300000, 2000000, 6), 18000); assert.equal(percentageRent(1000, 2000, 6), 0);
});

test('RUBS split adds up to the cent', () => {
  assert.deepEqual(rubsSplit(1000, [{ sqft: 500 }, { sqft: 500 }, { sqft: 1000 }]).map((x) => x.share), [250, 250, 500]);
  const eq = rubsSplit(100, [{}, {}, {}], 'units'); assert.equal(eq.reduce((s, x) => s + x.share, 0).toFixed(2), '100.00'); assert.deepEqual(eq.map((x) => x.share), [33.34, 33.33, 33.33]);
  const mix = rubsSplit(300, [{ sqft: 1000, occupants: 1 }, { sqft: 1000, occupants: 3 }], { sqft: 0.5, occupants: 0.5 });
  assert.deepEqual(mix.map((x) => x.share), [112.5, 187.5]);
});

test('charge kinds read codes and words in several languages', () => {
  assert.equal(chargeKind('Base Rent'), 'rent'); assert.equal(chargeKind('CAM Recovery'), 'cam'); assert.equal(chargeKind('Late Fee'), 'late_fee');
  assert.equal(chargeKind('Miete'), 'rent'); assert.equal(chargeKind('家賃'), 'rent'); assert.equal(chargeKind('관리비'), 'cam');
  assert.equal(chargeKind('RNT', { RNT: 'rent' }), 'rent'); assert.equal(chargeKind('Mystery'), 'other');
  assert.equal(agingBucket(0), 'current'); assert.equal(agingBucket(45), '31-60'); assert.equal(agingBucket(120), '90+');
});

test('the leases and CAM schemas catch typos with a path', () => {
  assert.equal(validate(LEASES_SCHEMA, { leases: [lease({ escalation: { type: 'fixed_pct', pct: 3 } })] }).ok, true);
  const bad = validate(LEASES_SCHEMA, { leases: [lease({ escalation: { type: 'fixed-percent' } })] }).errors;
  assert.ok(bad.some((e) => /\/leases\/0\/escalation\/type/.test(e.path)), JSON.stringify(bad));
  assert.ok(validate(CAM_SCHEMA, { property: 'P', year: 2025, rentable_sqft: 0, pools: [] }).errors.length >= 2);
});

test('named PM exports: every profile is in the catalogue and marked recalled', () => {
  for (const p of [...RENT_ROLL_PROFILES, ...AGING_PROFILES, ...BOOKING_PROFILES]) { assert.ok(EXPORTS[p.id], p.id); assert.equal(p.basis, 'recalled'); for (const f of Object.keys(p.map)) assert.ok(f in { ...RENT_ROLL_FIELDS, ...AGING_FIELDS, ...BOOKING_FIELDS }, `${p.id}.${f}`); }
});

test('an AppFolio-style rent roll with property headings reads into the shared layout', () => {
  const matrix = [
    ['Unit', 'BD/BA', 'Tenant', 'Status', 'Sqft', 'Market Rent', 'Rent', 'Deposit', 'Lease From', 'Lease To', 'Move-in', 'Move-out', 'Past Due'],
    ['-> Maple Court (fictional)', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['101', '2/1', 'Rivera, Ana', 'Current', '850', '$1,650.00', '$1,595.00', '$1,500.00', '03/01/2025', '02/28/2026', '03/01/2025', '', '$0.00'],
    ['102', '1/1', '', 'Vacant-Unrented', '640', '$1,300.00', '', '', '', '', '', '', ''],
    ['Total Maple Court', '', '', '', '', '', '$1,595.00', '', '', '', '', '', ''],
  ];
  const { rows, report } = adaptRecords({ format: 'csv', matrix }, { fields: RENT_ROLL_FIELDS, profiles: RENT_ROLL_PROFILES }, { kind: 'rent_roll' });
  assert.equal(report.profile, 'appfolio_rent_roll');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].property, 'Maple Court (fictional)'); assert.equal(rows[0].rent, '1595.00'); assert.equal(rows[0].lease_start, '2025-03-01');
  assert.equal(rows[1].status, 'Vacant-Unrented');
});

test('a German rent roll reads by its own column names', () => {
  const matrix = [['Objekt', 'Einheit', 'Mieter', 'Fläche', 'Nettokaltmiete', 'Kaution', 'Mietbeginn', 'Mietende'], ['Haus Linde', 'WE 3', 'Fiktiv GmbH', '72,5', '1.234,50 €', '2.400,00', '01.04.2025', '31.03.2027']];
  const { rows, report } = adaptRecords({ format: 'csv', matrix }, { fields: RENT_ROLL_FIELDS }, { kind: 'rent_roll' });
  assert.equal(rows[0].unit, 'WE 3'); assert.equal(rows[0].rent, '1234.50'); assert.equal(rows[0].lease_end, '2027-03-31'); assert.equal(rows[0].sqft, '72.5');
  assert.ok(Object.keys(report.translated || report.mapped).length >= 5);
});

test('a Japanese ledger in Shift_JIS reads (encoding, headers, amounts)', () => {
  const t = readTable(fileURLToPath(new URL('./fixtures/intl/ja-ledger-sjis.csv', import.meta.url)));
  const { rows, report } = adaptRecords(t, { fields: LEDGER_FIELDS }, { kind: 'ledger' });
  assert.equal(report.encoding, 'shift_jis');
  assert.equal(rows[0].date, '2026-04-01'); assert.equal(rows[0].unit, '101号室'); assert.equal(rows[0].payment, '120000');
  assert.equal(chargeKind(rows[0].charge_code), 'rent');
});

test('Airbnb transaction history maps to bookings', () => {
  const matrix = [['Date', 'Type', 'Confirmation Code', 'Booking date', 'Start date', 'Nights', 'Guest', 'Listing', 'Details', 'Reference code', 'Currency', 'Amount', 'Paid out', 'Service fee', 'Fast Pay Fee', 'Cleaning fee', 'Gross earnings', 'Occupancy taxes', 'Earnings year'],
    ['04/02/2026', 'Reservation', 'HMFAKE001', '03/01/2026', '04/01/2026', '3', 'Pat Example', 'Lake Cabin (fictional)', '', '', 'USD', '612.00', '', '108.00', '', '120.00', '720.00', '0.00', '2026']];
  const { rows, report } = adaptRecords({ format: 'csv', matrix }, { fields: BOOKING_FIELDS, profiles: BOOKING_PROFILES }, { kind: 'bookings' });
  assert.equal(report.profile, 'airbnb_transaction_history');
  assert.equal(rows[0].booking_id, 'HMFAKE001'); assert.equal(rows[0].gross, '720.00'); assert.equal(rows[0].check_in, '2026-04-01');
});

test('worklists follow the report language; CSV codes stay English', () => {
  const root = tmp(); const out = [];
  const ctx = { root, lang: 'de', outDir: (d) => { const p = `${root}/${d}`; mkdirSync(p, { recursive: true }); return p; }, writeFile: (d, n, t) => { const p = `${d}/${n}`; writeFileSync(p, t); out.push(p); return p; } };
  const w = writeWorklist(ctx, 'out', 'x', { title: { en: 'Rent check', de: 'Mietprüfung' }, rows: [{ unit: '101', status: 'review' }], columns: ['unit', 'status'], limits: ['files'] });
  const html = readFileSync(w.files[1], 'utf8'); const csv = readFileSync(w.files[0], 'utf8');
  assert.match(html, /<html lang="de">/); assert.match(html, /Mietprüfung/); assert.match(html, /<th[^>]*>Einheit<\/th>/); assert.match(html, /prüfen/); assert.match(html, /Liest nur die Dateien/); assert.match(html, /Muttersprachler/);
  assert.match(csv, /^unit,status/); assert.match(csv, /review/);
  assert.equal(reportWords('ja').label('tenant'), '賃借人'); assert.equal(reportWords('xx').t('limits'), 'Limits');
});

test('periodKey reads reporting months in many shapes', async () => {
  const { periodKey } = await import('../src/index.js');
  const got = ['2025-03', '2025/3', '03/2025', 'Mar 2025', 'März 2025', '2025年3月', '2025년 3월', '202503', '2025-03-31', 'Dec-25', 'junk', '13/2025'].map(periodKey);
  assert.deepEqual(got, ['2025-03', '2025-03', '2025-03', '2025-03', '2025-03', '2025-03', '2025-03', '2025-03', '2025-03', '2025-12', null, null]);
});

test('headers that are the agent\'s own names in another spelling ("Move In", "Sq Ft") are renamed', async () => {
  const { adaptRecords, UNIT_FIELDS } = await import('../src/index.js');
  const r = adaptRecords({ format: 'csv', matrix: [['Unit', 'Sq Ft', 'Move In'], ['7', '650', '2026-01-02']] }, { fields: UNIT_FIELDS, profiles: [] }, { kind: 'occupancy' });
  assert.equal(Number(r.rows[0].sqft), 650); assert.equal(r.rows[0].move_in, '2026-01-02'); assert.equal(r.report.adapted, true);
});
