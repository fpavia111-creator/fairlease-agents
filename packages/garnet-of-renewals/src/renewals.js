// Renewal pipeline: offer deadlines, proposed rents within the buyer's cap, offers already made. Pure functions.
import { r2, num, str, isoDate, addDays, daysBetween, sameUnit, sameParty, groupRentRoll, rentAt } from 'keystone-core';

export const RENEWAL_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['max_increase_pct', 'notice_days'],
  properties: {
    max_increase_pct: { type: 'number', minimum: 0, maximum: 100 },
    min_increase_pct: { type: 'number', minimum: 0, maximum: 100 },
    notice_days: { type: 'integer', minimum: 0, maximum: 365 },
    round_to: { type: 'number', minimum: 0, maximum: 1000 },
    due_soon_days: { type: 'integer', minimum: 0, maximum: 180 },
  },
});
const T = (aliases, translate = false, type) => ({ aliases, translate, ...(type ? { type } : {}) });
export const OFFER_FIELDS = Object.freeze({
  unit: { ...T(['Unit', 'Unit Number', 'Apt', 'Suite'], 'unit'), required: true }, tenant: T(['Tenant', 'Resident', 'Name'], 'tenant'),
  offered_on: T(['Offered On', 'Offer Date', 'Date Offered', 'Sent', 'Angebot vom', "Date de l'offre", 'Fecha de oferta', 'Data da oferta', 'Data offerta', '提示日', '报价日期', '제안일'], false, 'date'),
  offered_rent: T(['Offered Rent', 'Renewal Rent', 'New Rent', 'Proposed Rent', 'Neue Miete', 'Loyer proposé', 'Renta ofrecida', 'Aluguel proposto', 'Canone proposto', '提示賃料', '续租租金', '제안 임대료'], false, 'money'),
  term_months: T(['Term (months)', 'Term', 'Months', 'Laufzeit', 'Durée', 'Plazo', 'Prazo', 'Durata', '期間', '租期', '기간'], false, 'number'),
  status: T(['Status', 'Offer Status', 'Statut', 'Estado', 'Stato', 'ステータス', '状态', '상태'], 'status'),
});

const roundTo = (v, step) => (step ? Math.round(v / step) * step : r2(v));
const offerState = (s) => { const t = str(s).toLowerCase(); if (/notice to vacate|notice of non|gave notice|given notice|on notice|^notice$|\bntv\b|non.?renew|vacat|mov(e|ing).?out|préavis|kündig|aviso|disdetta|退去|退租|퇴거/.test(t)) return 'notice'; if (/accept|signed|renewed|accept|angenommen|accepté|aceptad|aceito|accettat|承諾|接受|수락/.test(t)) return 'accepted'; if (/declin|reject|refus|abgelehnt|rechaz|recus|rifiut|辞退|拒绝|거절/.test(t)) return 'declined'; return 'pending'; };

export function checkRenewals({ leases, marketRows = null, offers = [], policy, asOf, horizonDays = 120 }) {
  const market = marketRows ? groupRentRoll(marketRows) : [];
  const until = addDays(asOf, horizonDays); const soon = policy.due_soon_days ?? 21; const items = [];
  for (const l of leases.leases || []) {
    if (l.end > until || l.end < addDays(asOf, -366)) continue;
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    // The contract rent today: the base rent after the lease's own steps and escalations (a free-rent month does not make it zero).
    const stepped = rentAt({ ...l, free_rent: [] }, l.end < asOf ? l.end : asOf); const rent = stepped ?? num(l.rent && l.rent.monthly);
    const m = market.find((u) => sameUnit(u.unit, l.unit)); const mkt = m ? m.market_rent : null;
    const mtm = l.end < asOf;
    const gone = !!(m && m.vacant);
    const deadline = addDays(l.end, -policy.notice_days); const left = daysBetween(asOf, deadline);
    // The latest offer made during this lease; an offer dated before the lease began belongs to the term before.
    const o = offers.filter((x) => sameUnit(x.unit, l.unit) && (!str(x.tenant) || sameParty(x.tenant, l.tenant)) && !(isoDate(x.offered_on) && l.start && isoDate(x.offered_on) < l.start))
      .sort((x, y) => String(isoDate(y.offered_on) || '').localeCompare(String(isoDate(x.offered_on) || '')))[0];
    const next = (leases.leases || []).find((x) => x !== l && sameUnit(x.unit, l.unit) && sameParty(x.tenant, l.tenant) && x.start > l.start && x.start <= addDays(l.end, 45) && (!x.end || x.end > l.end));
    if (next) { items.push({ lease_id: l.lease_id, unit: l.unit, tenant: l.tenant, lease_end: l.end, days_to_end: daysBetween(asOf, l.end), deadline: null, days_to_deadline: null, rent, market_rent: mkt, proposed: null, increase: null, increase_pct: null, offered_rent: o ? num(o.offered_rent) : null, stage: 'renewed', status: 'ok', findings: [{ code: 'renewed', detail: `Lease ${next.lease_id} for the same tenant starts ${next.start}; nothing to offer.`, severity: 'note' }] }); continue; }
    const state = o ? offerState(o.status) : null;
    let proposed = null;
    if (rent !== null && mkt !== null) {
      const cap = rent * (1 + policy.max_increase_pct / 100); const floor = rent * (1 + (policy.min_increase_pct || 0) / 100);
      proposed = roundTo(Math.max(floor, Math.min(mkt, cap)), policy.round_to); if (proposed > cap + 0.004) proposed = policy.round_to ? Math.floor(cap / policy.round_to) * policy.round_to : r2(cap);
      if (mkt > cap) add('capped', `Market ${mkt} is above your ${policy.max_increase_pct}% cap; proposed ${proposed}.`, { severity: 'note' });
      if (rent >= mkt) add('at_or_over_market', `Rent ${rent} is at or over market ${mkt}; a renewal at the same rent may be the right offer.`, { severity: 'note' });
    } else if (mkt === null) add('market_rent_missing', 'No market rent for this unit; no rent is proposed.');
    if (state === 'notice') add('notice_to_vacate', 'Tenant gave notice to vacate; hand over to leasing and turn planning.', { severity: 'note' });
    else if (state === 'accepted') add('accepted', `Renewal accepted${num(o.offered_rent) !== null ? ` at ${num(o.offered_rent)}` : ''}; check the new lease is in the system.`, { severity: 'note' });
    else if (state === 'declined') add('declined', 'Offer declined; a turnover is likely.');
    if (o && num(o.offered_rent) !== null && rent) {
      const pct = r2((num(o.offered_rent) / rent - 1) * 100);
      if (pct > policy.max_increase_pct + 0.005) add('offer_over_cap', `Offered ${num(o.offered_rent)} is ${pct}% over the current ${rent}, above your ${policy.max_increase_pct}% cap.`);
      if (isoDate(o.offered_on) && isoDate(o.offered_on) > deadline) add('offer_after_deadline', `Offer sent ${isoDate(o.offered_on)}, after the ${deadline} deadline (${policy.notice_days} days before the lease ends).`);
    }
    if (!o && !mtm && !gone) {
      if (left < 0) add('offer_overdue', `No offer recorded, and the deadline ${deadline} (${policy.notice_days} days before ${l.end}) passed ${-left} days ago.`);
      else if (left <= soon) add('offer_due_soon', `Offer deadline ${deadline}: ${left} day(s) left.`);
    }
    if (gone) add('vacant_on_rent_roll', `The rent roll shows unit ${l.unit} vacant; the lease file still has ${l.tenant}. Close the old lease record.`, { severity: 'note' });
    if (mtm && state !== 'notice' && !gone) add('month_to_month', `Lease ended ${l.end}; month to month with no renewal recorded.`);
    const stage = gone ? 'moved_out' : state || (mtm ? 'month_to_month' : left < 0 ? 'overdue' : left <= soon ? 'due_soon' : 'upcoming');
    const issue = findings.some((f) => ['offer_overdue', 'offer_over_cap', 'offer_after_deadline', 'declined', 'market_rent_missing', 'month_to_month'].includes(f.code));
    items.push({ lease_id: l.lease_id, unit: l.unit, tenant: l.tenant, lease_end: l.end, days_to_end: daysBetween(asOf, l.end), deadline: mtm ? null : deadline, days_to_deadline: mtm ? null : left, rent, market_rent: mkt, proposed, increase: proposed !== null && rent ? r2(proposed - rent) : null, increase_pct: proposed !== null && rent ? r2((proposed / rent - 1) * 100) : null, offered_rent: o ? num(o.offered_rent) : null, stage, status: issue ? 'issue' : stage === 'due_soon' ? 'due_soon' : 'ok', findings });
  }
  items.sort((a, b) => (a.status === 'issue' ? 0 : a.status === 'due_soon' ? 1 : 2) - (b.status === 'issue' ? 0 : b.status === 'due_soon' ? 1 : 2) || a.lease_end.localeCompare(b.lease_end));
  const uplift = r2(items.filter((i) => !['notice', 'moved_out'].includes(i.stage) && i.increase !== null).reduce((s, i) => s + i.increase, 0));
  const summary = `${items.length} lease(s) end by ${until} or are month to month: ${items.filter((i) => i.stage === 'overdue').length} offer(s) overdue, ${items.filter((i) => i.stage === 'due_soon').length} due soon, ${items.filter((i) => i.stage === 'pending').length} pending, ${items.filter((i) => i.stage === 'notice').length} on notice. Proposed rents within your ${policy.max_increase_pct}% cap add ${uplift} a month.`;
  return { summary, as_of: asOf, horizon_days: horizonDays, monthly_uplift: uplift, items };
}

export function offerText(it, a = {}) {
  const fmt = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rent = a.offer_rent ?? it.proposed;
  return `**To:** ${a.to || '[TO CONFIRM: tenant email or address]'}
**Unit:** ${it.unit}

# Lease renewal offer

Dear ${it.tenant},

Your lease for unit ${it.unit} ends on ${it.lease_end}. We would like you to stay, and we are pleased to offer a renewal:

- New monthly rent: **${rent === null || rent === undefined ? '[TO CONFIRM: rent]' : fmt(rent)}** (currently ${fmt(it.rent)})
- Term: ${a.term_months ? `${a.term_months} months` : '[TO CONFIRM: term]'}, starting the day after your current lease ends
- Please reply by: ${a.reply_by || '[TO CONFIRM: reply date]'}

All other terms stay as in your current lease unless we tell you otherwise in writing. ${a.extra || ''}

${a.from || '[TO CONFIRM: manager name and contact]'}
`;
}
