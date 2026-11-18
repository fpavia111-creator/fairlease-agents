// Renewals: the edge cases a property manager would raise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRenewals, offerText } from '../src/index.js';

const policy = { max_increase_pct: 5, notice_days: 60, due_soon_days: 21 };
const lease = (over = {}) => ({ lease_id: 'L-1', unit: '101', tenant: 'Dana Example', start: '2026-02-01', end: '2027-01-31', rent: { monthly: 1000 }, ...over });
const mkt = (unit = '101', market = 1200, over = {}) => ({ unit, tenant: 'Dana Example', rent: '1000', market_rent: String(market), ...over });
const offer = (over = {}) => ({ unit: '101', tenant: 'Dana Example', offered_on: '2026-11-10', offered_rent: '1040', status: 'Sent', ...over });
const check = (leases, extra = {}) => checkRenewals({ leases: { leases }, marketRows: [mkt()], policy, asOf: '2026-11-17', ...extra });
const codes = (i) => i.findings.map((f) => f.code);

test('the cap is applied to the rent the tenant pays today, after the lease\'s own steps', () => {
  const r = check([lease({ rent: { monthly: 1000, steps: [{ from: '2026-08-01', monthly: 1100 }] } })]);
  assert.equal(r.items[0].rent, 1100); assert.equal(r.items[0].proposed, 1155); assert.equal(r.items[0].increase_pct, 5);
});

test('a lease already renewed in the lease file is not chased for an offer', () => {
  const r = check([lease({ end: '2026-12-31' }), lease({ lease_id: 'L-2', start: '2027-01-01', end: '2027-12-31', rent: { monthly: 1040 } })], { horizonDays: 60 });
  assert.deepEqual(r.items.map((i) => [i.lease_id, i.stage, codes(i)]), [['L-1', 'renewed', ['renewed']]]);
  assert.equal(r.items[0].status, 'ok');
});

test('the latest offer counts, and an offer from before this lease began does not', () => {
  const two = check([lease()], { offers: [offer({ offered_on: '2026-10-01', offered_rent: '1100' }), offer()] });
  assert.equal(two.items[0].offered_rent, 1040); assert.ok(!codes(two.items[0]).includes('offer_over_cap'));
  const old = check([lease({ end: '2026-12-20' })], { offers: [offer({ offered_on: '2025-11-01', status: 'Accepted' })] });
  assert.deepEqual(codes(old.items[0]).filter((c) => c !== 'capped'), ['offer_overdue']);
});

test('"Renewal notice sent" is a pending offer; only notice to vacate ends the offer', () => {
  const sent = check([lease()], { offers: [offer({ status: 'Renewal notice sent' })] });
  assert.equal(sent.items[0].stage, 'pending');
  for (const s of ['Notice to vacate', 'NTV', 'Gave notice', 'Non-renewal', 'Moving out']) assert.equal(check([lease()], { offers: [offer({ status: s })] }).items[0].stage, 'notice', s);
});

test('the offer deadline: due soon up to the day, overdue the day after', () => {
  assert.deepEqual(codes(check([lease({ end: '2027-01-16' })]).items[0]).filter((c) => c !== 'capped'), ['offer_due_soon']);
  assert.deepEqual(codes(check([lease({ end: '2027-01-15' })]).items[0]).filter((c) => c !== 'capped'), ['offer_overdue']);
  assert.deepEqual(codes(check([lease({ end: '2027-03-01' })]).items[0]).filter((c) => c !== 'capped'), []);
});

test('rounding never lifts the proposed rent over the cap', () => {
  const r = checkRenewals({ leases: { leases: [lease({ rent: { monthly: 1013 } })] }, marketRows: [mkt()], policy: { ...policy, round_to: 25 }, asOf: '2026-11-17' });
  assert.equal(r.items[0].proposed, 1050); assert.ok(r.items[0].proposed <= 1013 * 1.05);
});

test('rent at or above market proposes no increase unless you set a minimum', () => {
  const r = check([lease({ rent: { monthly: 1300 } })]);
  assert.equal(r.items[0].proposed, 1200 > 1300 ? 1200 : 1300); assert.equal(r.items[0].increase, 0);
  assert.ok(codes(r.items[0]).includes('at_or_over_market'));
});

test('the offer letter states the rent and leaves term and reply date to confirm; it promises nothing else', () => {
  const it = check([lease()]).items[0]; const text = offerText(it, {});
  assert.match(text, /New monthly rent: \*\*1,050\.00\*\* \(currently 1,000\.00\)/);
  assert.equal((text.match(/\[TO CONFIRM/g) || []).length, 4); assert.doesNotMatch(text, /guarantee|legally|must vacate/i);
});
