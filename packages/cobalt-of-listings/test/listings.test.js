import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkListings, bedBath, correctionText } from '../src/listings.js';

const asOf = '2026-11-15';
const rr = (unit, extra = {}) => ({ unit, tenant: 'Someone', bedrooms: '2/1', sqft: 800, market_rent: 1500, ...extra });
const ls = (unit, channel, extra = {}) => ({ unit, channel, rent: 1500, bedrooms: 2, bathrooms: 1, sqft: 800, deposit: 500, available: '2026-11-20', status: 'Active', title: 'Nice home', description: 'Near transit.', ...extra });

test('beds and baths from common rent roll spellings', () => {
  assert.deepEqual(bedBath('2/1'), { beds: 2, baths: 1 });
  assert.deepEqual(bedBath('2 BD / 1.5 BA'), { beds: 2, baths: 1.5 });
  assert.deepEqual(bedBath('Studio'), { beds: 0, baths: null });
  assert.deepEqual(bedBath('3'), { beds: 3, baths: null });
  assert.deepEqual(bedBath(''), { beds: null, baths: null });
});

test('occupied units that are not listed are left out; vacant listed units are ok', () => {
  const r = checkListings({ rentRoll: [rr('1'), rr('2', { tenant: 'VACANT' })], listings: [ls('2', 'Site A')], asOf });
  assert.deepEqual(r.items.map((i) => [i.unit, i.status]), [['2', 'ok']]);
});

test('vacant not listed, on notice missing a required site, occupied still listed, unknown unit', () => {
  const r = checkListings({ rentRoll: [rr('1', { tenant: '' }), rr('2', { move_out: '2026-12-01' }), rr('3')], listings: [ls('2', 'Site A', { available: '2026-12-05' }), ls('3', 'Site A'), ls('9', 'Site A'), ls('3', 'Site B', { status: 'Leased' })], policy: { required_channels: ['Site A', 'Site B'] }, asOf });
  const by = Object.fromEntries(r.items.map((i) => [i.unit, i]));
  assert.deepEqual(by['1'].findings.map((f) => f.code), ['not_listed']);
  assert.deepEqual(by['2'].findings.map((f) => f.code), ['missing_on_channel']); assert.equal(by['2'].occupancy, 'notice');
  assert.deepEqual(by['3'].findings.map((f) => f.code), ['listed_while_occupied']);
  assert.deepEqual(by['9'].findings.map((f) => f.code), ['not_in_rent_roll']);
});

test('rent, deposit, details, pets and duplicates are compared', () => {
  const r = checkListings({ rentRoll: [rr('1', { tenant: 'VACANT' })], listings: [ls('1', 'A', { rent: 1560, deposit: 600, pets: 'Cats' }), ls('1', 'B', { bedrooms: 3, sqft: 900, pets: 'None' }), ls('1', 'B')], asOf });
  const codes = r.items[0].findings.map((f) => f.code);
  for (const c of ['duplicate_listing', 'rent_differs', 'rent_inconsistent', 'deposit_inconsistent', 'details_differ', 'pets_inconsistent']) assert.ok(codes.includes(c), c);
});

test('rent within tolerance is not a difference', () => {
  const r = checkListings({ rentRoll: [rr('1', { tenant: 'VACANT' })], listings: [ls('1', 'A', { rent: 1520 })], policy: { rent_tolerance_pct: 2 }, asOf });
  assert.equal(r.items[0].status, 'ok');
});

test('stale and early available dates are grouped by date', () => {
  const r = checkListings({ rentRoll: [rr('1', { tenant: 'VACANT' }), rr('2', { move_out: '2026-12-10' })], listings: [ls('1', 'A', { available: '2026-09-01' }), ls('1', 'B', { available: '2026-09-01' }), ls('2', 'A', { available: '2026-12-01' })], asOf });
  const by = Object.fromEntries(r.items.map((i) => [i.unit, i]));
  assert.match(by['1'].findings[0].detail, /A, B 2026-09-01/);
  assert.equal(by['2'].findings[0].code, 'available_before_move_out');
});

test('wording is flagged for review in several languages, and custom words replace the default list', () => {
  const r = checkListings({ rentRoll: [rr('1', { tenant: 'VACANT' }), rr('2', { tenant: 'VACANT' })], listings: [ls('1', 'A', { description: 'Quiet. Adults only!' }), ls('2', 'A', { title: 'Piso tranquilo, sin niños' })], asOf });
  assert.deepEqual(r.items.map((i) => i.status), ['review', 'review']);
  assert.match(r.items[0].findings[0].detail, /"adults only".*does not judge/);
  const c = checkListings({ rentRoll: [rr('1', { tenant: 'VACANT' })], listings: [ls('1', 'A', { description: 'Adults only. Walk-in closet.' })], policy: { review_words: ['walk-in closet'] }, asOf });
  assert.match(c.items[0].findings[0].detail, /walk-in closet/); assert.equal(c.items[0].findings.length, 1);
});

test('ignored units are skipped everywhere', () => {
  const r = checkListings({ rentRoll: [rr('M1', { tenant: '' })], listings: [ls('M1', 'A', { rent: 9999 })], policy: { ignore_units: ['m1'] }, asOf });
  assert.equal(r.items.length, 0);
});

test('the correction lists each finding', () => {
  const r = checkListings({ rentRoll: [rr('1', { tenant: 'VACANT' })], listings: [ls('1', 'A', { rent: 1700 })], asOf });
  const t = correctionText(r.items[0], {});
  assert.match(t, /Listing corrections: unit 1/); assert.match(t, /A asks 1700/); assert.match(t, /\[TO CONFIRM: leasing or marketing contact\]/);
});
