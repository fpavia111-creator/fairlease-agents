// Listings against the rent roll: the edge cases a leasing manager would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkListings, correctionText } from '../src/index.js';

const rr = (over = {}) => ({ property: 'Birch Lofts', unit: '102', tenant: '', status: 'Vacant', bedrooms: '1/1', sqft: '640', market_rent: '1500', move_out: '', ...over });
const ad = (over = {}) => ({ channel: 'Website', property: 'Birch Lofts', unit: '102', bedrooms: '1', bathrooms: '1', sqft: '640', rent: '1500', deposit: '500', available: '2026-11-20', status: 'Active', title: 'Sunny one bed', description: 'Near the park.', ...over });
const check = (listings, rentRoll, policy = {}) => checkListings({ listings, rentRoll, policy, asOf: '2026-11-17' });
const codes = (i) => i.findings.map((f) => f.code);
const by = (r) => Object.fromEntries(r.items.map((i) => [`${i.property}|${i.unit}`, i]));

test('the same unit number in two properties is two units', () => {
  const r = by(check([ad()], [rr(), rr({ property: 'Maple Court', tenant: 'Dana Example', status: 'Current' })]));
  assert.deepEqual(codes(r['Birch Lofts|102']), []); assert.equal(r['Maple Court|102'], undefined);
  const r2 = by(check([ad({ property: 'Maple Court' })], [rr(), rr({ property: 'Maple Court', tenant: 'Dana Example', status: 'Current' })]));
  assert.deepEqual(codes(r2['Birch Lofts|102']), ['not_listed']); assert.deepEqual(codes(r2['Maple Court|102']), ['listed_while_occupied']);
});

test('a resident whose name happens to contain "vacant" or "libre" is not a vacant unit', () => {
  const r = check([], [rr({ tenant: 'Joe Vacanti', status: 'Current' }), rr({ unit: '103', tenant: 'Ana Librero', status: 'Current' })]);
  assert.equal(r.items.length, 0);
});

test('a vacant unit that is already leased does not need a listing, and one still advertised is flagged', () => {
  const r = check([], [rr({ status: 'Vacant Rented Ready' }), rr({ unit: '103', status: 'Vacant Unrented Ready' })]);
  assert.deepEqual(r.items.map((i) => [i.unit, i.occupancy, codes(i)]), [['103', 'vacant', ['not_listed']], ['102', 'leased', []]]);
  const still = check([ad()], [rr({ status: 'Vacant-Leased' })]);
  assert.deepEqual(codes(still.items[0]), ['listed_but_leased']);
});

test('a unit on notice by its status is expected to be listed even when the move-out date is blank', () => {
  const r = check([ad()], [rr({ tenant: 'Dana Example', status: 'Notice Unrented' })]);
  assert.equal(r.items[0].occupancy, 'notice'); assert.deepEqual(codes(r.items[0]), []);
  assert.deepEqual(codes(check([], [rr({ tenant: 'Dana Example', status: 'Notice Unrented' })]).items[0]), ['not_listed']);
});

test('model, down and employee units are not expected to be listed', () => {
  const r = check([], [rr({ status: 'Model' }), rr({ unit: '103', status: 'Down' }), rr({ unit: '104', tenant: 'Site Manager', status: 'Employee' })]);
  assert.equal(r.items.length, 0);
});

test('a listing with no price or a zero price is not compared with the market rent', () => {
  const r = check([ad({ rent: '0' }), ad({ channel: 'Zillow', rent: '' })], [rr()]);
  assert.deepEqual(codes(r.items[0]), []); assert.equal(r.items[0].asking, null);
});

test('the rent tolerance is a percentage of the market rent, at the boundary', () => {
  assert.deepEqual(codes(check([ad({ rent: '1530' })], [rr()]).items[0]), []);
  assert.deepEqual(codes(check([ad({ rent: '1531' })], [rr()]).items[0]), ['rent_differs']);
});

test('wording is only pointed out for review: it never changes a unit to an issue and never says the ad is unlawful', () => {
  const r = check([ad({ description: 'Quiet building, no kids please.' })], [rr()]);
  assert.equal(r.items[0].status, 'review'); assert.deepEqual(codes(r.items[0]), ['wording_review']);
  const text = correctionText(r.items[0], {});
  assert.match(text, /A person should review the wording/); assert.doesNotMatch(text, /illegal|unlawful|violat|discriminat/i);
});
