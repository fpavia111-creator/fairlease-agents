// RUBS (ratio utility billing) re-worked from bills and occupancy, against what was billed. Pure functions.
import { r2, num, str, isoDate, addDays, daysBetween, overlapDays, rubsSplit, chargeKind, sameUnit, sameParty, foldText } from 'keystone-core';

const METHOD = { oneOf: [{ type: 'string', enum: ['sqft', 'occupants', 'units'] }, { type: 'object', additionalProperties: false, minProperties: 1, properties: { sqft: { type: 'number', minimum: 0 }, occupants: { type: 'number', minimum: 0 }, units: { type: 'number', minimum: 0 } } }] };
export const RUBS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['utilities'],
  properties: {
    utilities: { type: 'object', minProperties: 1, additionalProperties: { type: 'object', additionalProperties: false, required: ['method'], properties: {
      method: METHOD, common_area_pct: { type: 'number', minimum: 0, maximum: 100 }, words: { type: 'array', items: { type: 'string', minLength: 2 } }, cap_per_unit: { type: 'number', minimum: 0 },
    } } },
    vacant_occupants: { type: 'number', minimum: 0, maximum: 10 },
    billing_window_days: { type: 'integer', minimum: 1, maximum: 120 },
    spike_pct: { type: 'number', minimum: 1, maximum: 1000 },
    tolerance: { type: 'number', minimum: 0, maximum: 100 },
  },
});

const slug = (s) => foldText(str(s)).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const wordsOf = (key, u) => (u.words && u.words.length ? u.words : key.split('_')).map((w) => foldText(w).toLowerCase());
const utilityKey = (cfg, text) => { const t = foldText(str(text)).toLowerCase(); const s = slug(text); if (cfg.utilities[s]) return s; return Object.keys(cfg.utilities).find((k) => wordsOf(k, cfg.utilities[k]).some((w) => t.includes(w))) || null; };

/** Occupancy slots for a period: each occupancy weighted by its share of days, plus the vacant remainder of each unit (owner's share). */
export function slotsFor(occupancy, from, to, vacantOccupants = 1) {
  const days = daysBetween(from, to) + 1; const byUnit = new Map(); const slots = [];
  for (const o of occupancy) { const k = str(o.unit); if (!byUnit.has(k)) byUnit.set(k, []); byUnit.get(k).push(o); }
  for (const [unit, occ] of byUnit) {
    const sqft = Math.max(...occ.map((o) => num(o.sqft) || 0));
    let used = 0;
    for (const o of occ) {
      if (!str(o.tenant)) continue;
      const d = overlapDays(isoDate(o.move_in) || '1900-01-01', isoDate(o.move_out) || '2999-12-31', from, to); if (d <= 0) continue;
      const f = d / days; used += d;
      slots.push({ unit, tenant: str(o.tenant), days: d, sqft: sqft * f, occupants: (num(o.occupants) ?? 1) * f, units: f });
    }
    const vac = Math.max(0, days - used);
    if (vac > 0) slots.push({ unit, tenant: '', vacant: true, days: vac, sqft: sqft * (vac / days), occupants: vacantOccupants * (vac / days), units: vac / days });
  }
  return slots;
}

/** Utility charges billed per unit and tenant, per utility key, within the window after a bill period. */
export function billedUtility(rows, cfg, aliases = {}) {
  const out = [];
  for (const r of rows || []) {
    const text = `${str(r.charge_code)} ${str(r.description)}`;
    if (chargeKind(r.charge_code, aliases) !== 'utility' && chargeKind(r.description, aliases) !== 'utility' && !utilityKey(cfg, text)) continue;
    const amt = num(r.charge) ?? num(r.amount); const d = isoDate(r.date); if (amt === null || !d) continue;
    out.push({ unit: str(r.unit), tenant: str(r.tenant), date: d, amount: amt, key: utilityKey(cfg, text) });
  }
  return out;
}

export function checkRubs({ bills, occupancy, billedRows = null, cfg, aliases = {} }) {
  const window = cfg.billing_window_days ?? 45; const tol = cfg.tolerance ?? 1; const spike = cfg.spike_pct ?? 25;
  const billed = billedUtility(billedRows, cfg, aliases); const usedBilled = new Set();
  const periods = []; const units = new Map(); const unknown = [];
  const sorted = [...bills].map((b) => ({ ...b, key: utilityKey(cfg, b.utility), from: isoDate(b.period_start), to: isoDate(b.period_end), amount: num(b.amount) })).sort((a, b) => String(a.from).localeCompare(String(b.from)));
  const history = {};
  // Each charge belongs to the latest bill of its utility that ended before it, within the window.
  const owner_of = billed.map((x) => sorted.filter((b) => b.key && b.to && (x.key === b.key || (!x.key && Object.keys(cfg.utilities).length === 1)) && x.date > b.to && x.date <= addDays(b.to, window)).sort((a, c) => c.to.localeCompare(a.to))[0] || null);
  for (const b of sorted) {
    if (!b.key || !b.from || !b.to || b.amount === null) { unknown.push({ utility: str(b.utility), period: `${b.from || '?'} to ${b.to || '?'}`, amount: b.amount, reason: !b.key ? 'utility not in your RUBS file' : 'period or amount unreadable' }); continue; }
    const u = cfg.utilities[b.key]; const findings = [];
    const common = num(b.common_area) ?? r2((b.amount * (u.common_area_pct || 0)) / 100);
    const recoverable = r2(b.amount - common);
    const slots = slotsFor(occupancy, b.from, b.to, cfg.vacant_occupants ?? 1);
    const split = slots.length ? rubsSplit(recoverable, slots, u.method) : [];
    const prior = history[b.key] || []; const avg = prior.length ? prior.reduce((s, x) => s + x, 0) / prior.length / 1 : null;
    const perDay = b.amount / (daysBetween(b.from, b.to) + 1);
    if (avg !== null && perDay > avg * (1 + spike / 100)) findings.push({ code: 'bill_spike', detail: `${b.key} bill for ${b.from} to ${b.to} is ${r2((perDay / avg - 1) * 100)}% above the average of earlier bills per day; check for a leak or a meter error before billing it back.` });
    (history[b.key] = prior).push(perDay);
    const owner = r2(common + split.filter((s) => s.vacant).reduce((s, x) => s + x.share, 0));
    // What was billed for this bill: utility charges dated after the period end, within the window.
    const inWin = billed.map((x, i) => ({ ...x, i })).filter((x) => owner_of[x.i] === b);
    for (const x of inWin) usedBilled.add(x.i);
    const lines = [];
    for (const s of split.filter((x) => !x.vacant)) {
      const got = inWin.filter((x) => sameUnit(x.unit, s.unit) && (!x.tenant || sameParty(x.tenant, s.tenant)));
      const amt = got.length ? r2(got.reduce((t, x) => t + x.amount, 0)) : null;
      const allowed = u.cap_per_unit !== undefined ? Math.min(s.share, u.cap_per_unit) : s.share;
      let code = 'ok';
      if (amt === null) code = billedRows ? 'not_billed' : 'no_billing_file';
      else if (got.length > 1 && got.every((x) => Math.abs(x.amount - got[0].amount) < 0.005)) code = 'duplicate_charge';
      else if (amt - allowed > tol) code = 'overbilled'; else if (allowed - amt > tol) code = 'underbilled';
      lines.push({ unit: s.unit, tenant: s.tenant, days: s.days, ratio: s.ratio, share: s.share, allowed: r2(allowed), billed: amt, difference: amt === null ? null : r2(amt - allowed), code });
    }
    for (const x of inWin) {
      const occupied = split.some((s) => !s.vacant && sameUnit(s.unit, x.unit) && (!x.tenant || sameParty(x.tenant, s.tenant)));
      if (!occupied) lines.push({ unit: x.unit, tenant: x.tenant, days: 0, ratio: 0, share: 0, allowed: 0, billed: x.amount, difference: x.amount, code: 'billed_while_vacant' });
    }
    const totalBilled = r2(inWin.reduce((s, x) => s + x.amount, 0));
    if (billedRows && totalBilled - (b.amount - owner) > tol) findings.push({ code: 'over_recovery', detail: `Residents were billed ${totalBilled} for a ${b.key} bill whose residents' share is ${r2(b.amount - owner)} (bill ${b.amount} less common area ${common} and vacant days ${r2(owner - common)}); ${r2(totalBilled - (b.amount - owner))} more than their share.`, amount: r2(totalBilled - (b.amount - owner)) });
    periods.push({ utility: b.key, from: b.from, to: b.to, amount: b.amount, common_area: common, recoverable, residents_share: r2(b.amount - owner), owner_share: owner, billed: billedRows ? totalBilled : null, recovery_pct: billedRows ? r2((totalBilled / b.amount) * 100) : null, findings, lines });
    for (const l of lines) {
      const k = l.unit; const t = units.get(k) || { unit: l.unit, tenants: new Set(), allowed: 0, billed: 0, findings: [] };
      if (l.tenant) t.tenants.add(l.tenant); t.allowed = r2(t.allowed + l.allowed); t.billed = r2(t.billed + (l.billed || 0));
      if (!['ok', 'no_billing_file'].includes(l.code)) t.findings.push({ code: l.code, detail: `${b.key} ${b.from.slice(0, 7)}: ${l.code.replace(/_/g, ' ')}${l.billed !== null ? ` (billed ${l.billed}, split ${l.allowed})` : ` (split ${l.allowed})`}.`, amount: l.difference });
      units.set(k, t);
    }
  }
  const orphan = billed.filter((x, i) => !usedBilled.has(i)).map((x) => ({ unit: x.unit, tenant: x.tenant, date: x.date, amount: x.amount }));
  const items = [...units.values()].map((t) => ({ unit: t.unit, tenant: [...t.tenants].join(', '), allowed: t.allowed, billed: billedRows ? t.billed : null, difference: billedRows ? r2(t.billed - t.allowed) : null, status: t.findings.length ? 'issue' : billedRows ? 'ok' : 'review', findings: t.findings }))
    .sort((a, b) => (a.status === 'issue' ? 0 : 1) - (b.status === 'issue' ? 0 : 1) || String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true }));
  const over = r2(items.reduce((s, i) => s + Math.max(0, i.difference || 0), 0));
  const spikes = periods.filter((p) => p.findings.some((f) => f.code === 'bill_spike'));
  const summary = `${periods.length} bill(s), ${r2(periods.reduce((s, p) => s + p.amount, 0))} in total: residents' share ${r2(periods.reduce((s, p) => s + p.residents_share, 0))}, owner's share ${r2(periods.reduce((s, p) => s + p.owner_share, 0))} (common area and vacant days).${billedRows ? ` Billed ${r2(periods.reduce((s, p) => s + (p.billed || 0), 0))}; ${items.filter((i) => i.status === 'issue').length} unit(s) differ, ${over} overbilled.` : ' No billing file, so nothing billed is compared.'}${spikes.length ? ` ${spikes.length} bill(s) spike: ${spikes.map((p) => `${p.utility} ${p.from.slice(0, 7)}`).join(', ')}.` : ''}${periods.some((p) => p.findings.some((f) => f.code === 'over_recovery')) ? ' Over-recovery on at least one bill.' : ''}${unknown.length ? ` ${unknown.length} bill(s) skipped.` : ''}`;
  return { summary, overbilled_total: over, periods, skipped_bills: unknown, unmatched_charges: orphan, items };
}
