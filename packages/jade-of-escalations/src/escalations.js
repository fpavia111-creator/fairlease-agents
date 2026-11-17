// Rent billed against each lease's schedule, month by month. Pure functions.
import { r2, num, str, monthKey, monthsInRange, addDays, daysBetween, rentSchedule, rentForMonth, chargeKind, sameUnit, sameParty, overlapDays, foldText } from 'keystone-core';

const flat = (v) => foldText(str(v)).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
/** Does the ledger row's property (a name or an id) fit the lease's property? Blank on either side fits. */
function propFits(leases, l, rowProp) {
  const rp = flat(rowProp); if (!rp || !l.property) return true;
  const p = (leases.properties || []).find((x) => x.id === l.property);
  return [l.property, p && p.name].map(flat).filter(Boolean).some((k) => k === rp || (k.length > 3 && rp.length > 3 && (k.includes(rp) || rp.includes(k))));
}

/** Rent billed per lease and month from ledger rows (charges whose kind is rent). */
export function billedRent(rows, leases, aliases = {}) {
  const out = new Map(); const unmatched = [];
  for (const r of rows) {
    let kind = chargeKind(r.charge_code || r.description, aliases); if (kind === 'other' && r.charge_code && r.description) kind = chargeKind(r.description, aliases); // a GL account number as the code says nothing; the description does
    if (kind !== 'rent') continue;
    if (num(r.charge) === null && num(r.payment) !== null) continue; // a payment line coded as rent is money received, not billing
    const m = monthKey(r.date); if (!m) continue;
    const amt = num(r.charge) ?? num(r.amount); if (amt === null) continue;
    const all = leases.leases || []; const id = flat(r.lease_id);
    const byUnit = (strict) => all.find((x) => sameUnit(x.unit, r.unit) && propFits(leases, x, r.property) && (!r.tenant || sameParty(x.tenant, r.tenant)) && (!strict || overlapDays(x.start, x.end, `${m}-01`, `${m}-28`)));
    const l = (id && all.find((x) => flat(x.lease_id) === id)) || (!id ? byUnit(true) || byUnit(false) : null);
    if (!l) { unmatched.push({ unit: str(r.unit), tenant: str(r.tenant), month: m, amount: amt }); continue; }
    const k = `${l.lease_id}|${m}`; out.set(k, r2((out.get(k) || 0) + amt));
  }
  return { billed: out, unmatched };
}

/** Compare billed rent with the schedule for every lease and month in [from, to]. */
export function checkEscalations({ leases, rows, from, to, indexes = {}, tolerance = 1, aliases = {} }) {
  const { billed, unmatched } = billedRent(rows, leases, aliases);
  const months = monthsInRange(from, to); const items = [];
  for (const l of leases.leases || []) {
    const sched = rentSchedule(l, { indexes, through: to });
    const lines = []; const findings = []; const add = (code, detail, amount = null) => findings.push({ code, detail, ...(amount !== null ? { amount: r2(amount) } : {}) });
    for (const m of months) {
      const exp = rentForMonth(l, m, { indexes });
      if (exp === 0 && !billed.has(`${l.lease_id}|${m}`)) continue;
      if (exp === 0 && billed.get(`${l.lease_id}|${m}`) === 0) continue;
      const got = billed.get(`${l.lease_id}|${m}`) ?? null;
      const step = sched.filter((s) => s.from <= `${m}-31`).at(-1);
      const prev = sched.filter((s) => s.from < (step ? step.from : '')).at(-1);
      let code = 'ok';
      if (exp === null) code = 'index_missing';
      else if (got === null) code = exp > 0 ? 'not_billed' : 'ok';
      else if (Math.abs(got - exp) <= tolerance) code = 'ok';
      else if (exp === 0) code = l.end < `${m}-01` || l.start > `${m}-31` ? 'billed_outside_term' : 'billed_during_free_rent';
      else if (exp > 0 && Math.abs(got - 2 * exp) <= tolerance) code = 'billed_twice';
      else if (prev && prev.monthly !== null && Math.abs(got - prev.monthly) <= tolerance && step && step.reason !== 'base rent') code = 'escalation_missed';
      else code = got < exp ? 'underbilled' : 'overbilled';
      lines.push({ month: m, expected: exp, billed: got, difference: exp === null || got === null ? (got === null && exp ? r2(-exp) : null) : r2(got - exp), code, step: step ? `${step.from} ${step.reason}` : '' });
    }
    const bad = lines.filter((x) => x.code !== 'ok');
    const byCode = {}; for (const x of bad) (byCode[x.code] = byCode[x.code] || []).push(x);
    for (const [code, xs] of Object.entries(byCode)) {
      const total = r2(xs.reduce((s, x) => s + (x.difference || 0), 0));
      const what = { escalation_missed: `Billed at the old rent after the ${xs[0].step} step`, underbilled: 'Billed below the schedule', overbilled: 'Billed above the schedule', not_billed: 'No rent billed', billed_during_free_rent: 'Rent billed during free rent', billed_outside_term: `Rent billed outside the lease term (${l.start} to ${l.end})`, billed_twice: 'Rent billed twice', index_missing: 'CPI index month missing; rent not checked' }[code];
      add(code, `${what}: ${xs.map((x) => x.month).join(', ')}${code === 'index_missing' ? '' : ` (${total >= 0 ? '+' : ''}${total})`}.`, code === 'index_missing' ? null : total);
    }
    const net = r2(bad.reduce((s, x) => s + (x.difference || 0), 0));
    items.push({ lease_id: l.lease_id, tenant: l.tenant, unit: l.unit, months: lines.length, expected_total: r2(lines.reduce((s, x) => s + (x.expected || 0), 0)), billed_total: r2(lines.reduce((s, x) => s + (x.billed || 0), 0)), net_difference: net, status: bad.some((x) => x.code === 'index_missing') && bad.every((x) => x.code === 'index_missing') ? 'review' : bad.length ? 'issue' : 'ok', findings, lines });
  }
  const under = r2(-items.reduce((s, i) => s + Math.min(0, i.net_difference), 0));
  const summary = `${items.length} lease(s), ${months[0]} to ${months.at(-1)}: ${items.filter((i) => i.status === 'issue').length} with billing differences, ${items.filter((i) => i.status === 'review').length} to review. Underbilled ${under} in total${unmatched.length ? `; ${unmatched.length} rent charge(s) matched no lease` : ''}.`;
  return { summary, from: months[0], to: months.at(-1), underbilled_total: under, overbilled_total: r2(items.reduce((s, i) => s + Math.max(0, i.net_difference), 0)), unmatched, items };
}

/** Escalations between as_of and as_of + days. */
export function upcoming({ leases, asOf, days = 120, indexes = {} }) {
  const end = addDays(asOf, days); const out = [];
  for (const l of leases.leases || []) {
    const s = rentSchedule(l, { indexes, through: end > l.end ? l.end : end });
    for (let i = 1; i < s.length; i++) if (s[i].from > asOf && s[i].from <= end) out.push({ lease_id: l.lease_id, tenant: l.tenant, unit: l.unit, date: s[i].from, days_away: daysBetween(asOf, s[i].from), from_monthly: s[i - 1].monthly, to_monthly: s[i].monthly, change: s[i].monthly !== null && s[i - 1].monthly !== null ? r2(s[i].monthly - s[i - 1].monthly) : null, reason: s[i].reason, status: s[i].monthly === null ? 'review' : 'ok' });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
