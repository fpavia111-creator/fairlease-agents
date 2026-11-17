// Property management helpers shared by the Keystone agents. Pure functions, no I/O.
//
// Nothing here is a rule of law or an accounting standard. Lease terms come from the
// buyer's own lease file (LEASES_SCHEMA); CAM pools, caps and gross-up targets come
// from the buyer's own reconciliation file (CAM_SCHEMA). Where a lease is silent, the
// agents mark the item "review" instead of guessing.
import { normalizeName, stripLegalTail } from './text.js';
import { readNumber } from './intl.js';

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const num = (v) => { if (v === null || v === undefined || v === '') return null; if (typeof v === 'number') return Number.isFinite(v) ? v : null; const n = readNumber(v); return Number.isFinite(n) ? n : null; };
/** An amount that may be written short, as insurance limits and budgets often are: "$1M", "2MM", "500K", "1 million". Null when it is not a number. */
export const shortAmount = (v) => {
  const n = num(v); if (n !== null) return n;
  const m = /^[^\d-]*(-?[\d.,]+)\s*(k|thousand|m|mm|mio|million|b|bn|billion)\.?$/i.exec(str(v)); if (!m) return null;
  const base = num(m[1]); if (base === null) return null;
  const u = m[2].toLowerCase(); return base * (u === 'k' || u === 'thousand' ? 1e3 : /^b/.test(u) ? 1e9 : 1e6);
};
export const sum = (xs) => round2(xs.reduce((s, x) => s + (Number(x) || 0), 0));
export const str = (v) => String(v ?? '').trim();
export const pct = (part, whole) => (whole ? round2((part / whole) * 100) : 0);

// ------------------------------------------------------------------- dates ----

const DAY = 86400000;
const MS = new Map();
const toMs = (v) => { if (v instanceof Date) return v.getTime(); const s = str(v); if (!s) return NaN; const hit = MS.get(s); if (hit !== undefined) return hit; const t = msOf(s); if (MS.size >= 100000) MS.clear(); MS.set(s, t); return t; };
const msOf = (s) => { const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : /^\d{4}-\d{2}$/.test(s) ? `${s}-01T00:00:00Z` : /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(' ', 'T')}Z`; return Date.parse(iso); };
export const isoDate = (v) => { const t = toMs(v); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null; };
export function daysBetween(a, b) { const x = toMs(a), y = toMs(b); return Number.isFinite(x) && Number.isFinite(y) ? Math.round((y - x) / DAY) : null; }
export function addDays(d, n) { const t = toMs(d); return Number.isFinite(t) ? new Date(t + n * DAY).toISOString().slice(0, 10) : null; }
export const inWindow = (d, from, to) => { const x = isoDate(d); return !!x && (!from || x >= isoDate(from)) && (!to || x <= isoDate(to)); };
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const monthKey = (d) => { const x = isoDate(d); return x ? x.slice(0, 7) : null; };
export const monthStart = (d) => { const k = monthKey(d); return k ? `${k}-01` : null; };
export const monthEnd = (d) => { const k = monthKey(d); if (!k) return null; const [y, m] = k.split('-').map(Number); return `${k}-${String(daysInMonth(y, m)).padStart(2, '0')}`; };

/** Add whole months; the day is clamped to the end of a shorter month (Jan 31 + 1 = Feb 28/29). */
export function addMonths(d, n) {
  const x = isoDate(d); if (!x) return null;
  let [y, m, day] = x.split('-').map(Number);
  const total = y * 12 + (m - 1) + n; y = Math.floor(total / 12); m = (total % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day, daysInMonth(y, m))).padStart(2, '0')}`;
}

/** Whole months from a to b (a lease that starts Jan 1 and ends Dec 31 is 12 months). */
export function monthsBetween(a, b) {
  const x = isoDate(a), y = isoDate(addDays(b, 1)); if (!x || !y) return null;
  const [y1, m1, d1] = x.split('-').map(Number); const [y2, m2, d2] = y.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

/** Days two inclusive ranges share. */
export function overlapDays(aFrom, aTo, bFrom, bTo) {
  const s = [isoDate(aFrom), isoDate(bFrom)].filter(Boolean).sort().at(-1);
  const e = [isoDate(aTo), isoDate(bTo)].filter(Boolean).sort()[0];
  if (!s || !e || e < s) return 0;
  return daysBetween(s, e) + 1;
}

/** Month keys from a to b inclusive ('2026-01' ... '2026-12'). */
export function monthsInRange(a, b) {
  const out = []; let k = monthKey(a); const end = monthKey(b);
  if (!k || !end) return out;
  while (k <= end && out.length < 1200) { out.push(k); k = monthKey(addMonths(`${k}-01`, 1)); }
  return out;
}

/** Monthly amount prorated by days for the part of `month` (YYYY-MM) inside [from, to]. */
export function prorateMonth(monthly, month, from, to) {
  const [y, m] = month.split('-').map(Number); const dim = daysInMonth(y, m);
  const days = overlapDays(`${month}-01`, `${month}-${String(dim).padStart(2, '0')}`, from || `${month}-01`, to || `${month}-${dim}`);
  return round2((monthly * days) / dim);
}

// --------------------------------------------------------------- matching ----

/** Key for a unit or suite: "Suite 100", "Ste. 100", "#100" and "100" give "100"; "Bldg A Unit 2" gives "a-2". */
const UNIT_KEYS = new Map();
export function unitKey(v) {
  const raw = str(v); const hit = UNIT_KEYS.get(raw); if (hit !== undefined) return hit;
  const k = unitKeyOf(raw);
  if (UNIT_KEYS.size >= 100000) UNIT_KEYS.clear(); // a bounded memo: agents compare the same few thousand units many times
  UNIT_KEYS.set(raw, k); return k;
}
function unitKeyOf(raw) {
  let t = raw.toLowerCase().normalize('NFKC');
  t = t.replace(/\b(suite|ste|unit|apt|apartment|space|spc|shop|store|rm|room|no|nr|number|#|bldg|building|bld|floor|fl|lot)\b\.?/g, ' ').replace(/[#.,]/g, ' ');
  t = t.replace(/号室|号|室|호|房/g, ' ');
  const parts = t.split(/[\s\-/]+/).filter(Boolean).map((p) => p.replace(/^0+(?=\d)/, ''));
  return parts.join('-');
}
export const sameUnit = (a, b) => !!unitKey(a) && unitKey(a) === unitKey(b);

/** Key for a tenant or owner name, without legal forms ("Acme Bagels, LLC" and "ACME BAGELS" match). */
const PARTY_KEYS = new Map();
export const partyKey = (v) => {
  const raw = str(v); const hit = PARTY_KEYS.get(raw); if (hit !== undefined) return hit;
  const k = normalizeName(stripLegalTail(raw)); if (PARTY_KEYS.size >= 100000) PARTY_KEYS.clear(); PARTY_KEYS.set(raw, k); return k;
};
export const sameParty = (a, b) => { const k = partyKey(a); return !!k && k === partyKey(b); };

/** Group rows by a key function into a Map, keeping order. */
export function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
}

/** Mask all but the last four characters of an id (tax ids, bank accounts). */
export const maskId = (v) => { const s = str(v).replace(/\s/g, ''); return s.length <= 4 ? '•'.repeat(s.length) : `${'•'.repeat(Math.min(6, s.length - 4))}${s.slice(-4)}`; };

// --------------------------------------------------------------- schemas ----

const D = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Date as YYYY-MM-DD' };
const N0 = { type: 'number', minimum: 0 };

/** JSON Schema for the leases file most Keystone agents read. Terms are the buyer's own abstract of each lease. */
export const LEASES_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['leases'],
  properties: {
    portfolio: { type: 'string' }, currency: { type: 'string', pattern: '^[A-Z]{3}$' }, as_of: D,
    properties: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' }, name: { type: 'string' }, rentable_sqft: N0, address: { type: 'string' }, state: { type: 'string' }, country: { type: 'string' } } } },
    leases: { type: 'array', minItems: 1, maxItems: 20000, items: {
      type: 'object', additionalProperties: false, required: ['lease_id', 'unit', 'tenant', 'start', 'end'],
      properties: {
        lease_id: { type: 'string', minLength: 1 }, property: { type: 'string' }, unit: { type: 'string', minLength: 1 }, tenant: { type: 'string', minLength: 1 },
        use: { type: 'string' }, type: { type: 'string', enum: ['retail', 'office', 'industrial', 'residential', 'other'] },
        sqft: N0, start: D, end: D, signed: D,
        rent: { type: 'object', additionalProperties: false, properties: {
          monthly: N0, annual: N0, annual_per_sqft: N0,
          steps: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['from'], properties: { from: D, monthly: N0, annual: N0, annual_per_sqft: N0 } } },
        } },
        escalation: { type: 'object', additionalProperties: false, required: ['type'], properties: {
          type: { type: 'string', enum: ['fixed_pct', 'fixed_amount', 'cpi', 'none'] }, pct: { type: 'number', minimum: 0, maximum: 100 }, amount: N0,
          every_months: { type: 'integer', minimum: 1, maximum: 120 }, first: D,
          cpi: { type: 'object', additionalProperties: false, properties: { index: { type: 'string' }, base_month: { type: 'string', pattern: '^\\d{4}-\\d{2}$' }, lag_months: { type: 'integer', minimum: 0, maximum: 24 }, floor_pct: { type: 'number', minimum: 0, maximum: 100 }, cap_pct: { type: 'number', minimum: 0, maximum: 100 } } },
        } },
        free_rent: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['from', 'to'], properties: { from: D, to: D, pct: { type: 'number', minimum: 0, maximum: 100 } } } },
        deposit: N0, deposit_type: { type: 'string', enum: ['cash', 'letter_of_credit', 'guaranty', 'none'] },
        cam: { type: 'object', additionalProperties: false, properties: {
          share_pct: { type: 'number', minimum: 0, maximum: 100 }, denominator_sqft: N0, base_year: { type: 'integer', minimum: 1900, maximum: 2200 }, base_amount: N0,
          excluded_pools: { type: 'array', items: { type: 'string' } }, admin_fee_pct: { type: 'number', minimum: 0, maximum: 100 }, monthly_estimate: N0, gross_up: { type: 'boolean' },
          cap: { type: 'object', additionalProperties: false, required: ['pct'], properties: { pct: { type: 'number', minimum: 0, maximum: 100 }, type: { type: 'string', enum: ['cumulative', 'compounding', 'noncumulative'] }, base_year: { type: 'integer', minimum: 1900, maximum: 2200 }, base_amount: N0 } },
        } },
        percentage_rent: { type: 'object', additionalProperties: false, required: ['rate_pct'], properties: { rate_pct: { type: 'number', minimum: 0, maximum: 100 }, breakpoint: { oneOf: [{ type: 'string', enum: ['natural'] }, N0] }, year_start_month: { type: 'integer', minimum: 1, maximum: 12 }, prorate_partial_year: { type: 'boolean' }, report_due_days: { type: 'integer', minimum: 0, maximum: 365 } } },
        options: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['type'], properties: { type: { type: 'string', enum: ['renewal', 'termination', 'expansion', 'purchase'] }, notice_months: { type: 'integer', minimum: 0, maximum: 60 }, term_months: { type: 'integer', minimum: 0, maximum: 600 }, rent: { type: 'string' }, exercised: { type: 'boolean' } } } },
        insurance: { type: 'object', additionalProperties: false, properties: { gl_per_occurrence: N0, gl_aggregate: N0, property_required: { type: 'boolean' }, additional_insured: { type: 'boolean' }, renters_liability: N0 } },
        guarantor: { type: 'string' }, notice_address: { type: 'string' }, notes: { type: 'string', maxLength: 4000 },
        source: { type: 'object', additionalProperties: { type: 'string' }, description: 'Where each term was read in the lease, e.g. {"rent": "Sec. 4.1, p. 6"}' },
      },
    } },
  },
});

/** JSON Schema for a CAM / operating expense reconciliation setup. */
export const CAM_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['property', 'year', 'rentable_sqft', 'pools'],
  properties: {
    property: { type: 'string' }, year: { type: 'integer', minimum: 1900, maximum: 2200 }, rentable_sqft: { type: 'number', exclusiveMinimum: 0 },
    occupancy_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Average occupancy for the year' }, gross_up_to_pct: { type: 'number', minimum: 0, maximum: 100 },
    admin_fee_pct: { type: 'number', minimum: 0, maximum: 100 }, admin_fee_on_pools: { type: 'array', items: { type: 'string' } },
    pools: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['name', 'accounts'], properties: {
      name: { type: 'string', minLength: 1 }, accounts: { type: 'array', items: { type: 'string' } }, variable: { type: 'boolean', description: 'Varies with occupancy, so it is grossed up' }, controllable: { type: 'boolean', description: 'Subject to a lease cap on controllable expenses' }, recoverable: { type: 'boolean' },
    } } },
    excluded_accounts: { type: 'array', items: { type: 'string' } },
    prior_years: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['year'], properties: { year: { type: 'integer' }, controllable_total: N0, tenants: { type: 'object', additionalProperties: N0 } } } },
  },
});

/** CPI-style index series supplied by the buyer: { "index name": { "2025-01": 317.6, ... } }. Never looked up online. */
export const INDEX_SCHEMA = Object.freeze({ type: 'object', additionalProperties: { type: 'object', additionalProperties: { type: 'number', exclusiveMinimum: 0 } } });

// ------------------------------------------------------------------ leases ----

/** The lease for a unit (and tenant when given) on a date, from a leases file. */
export function leaseFor(leases, { unit, tenant, lease_id, date = null } = {}) {
  const list = (leases && leases.leases) || leases || [];
  if (lease_id) { const l = list.find((x) => str(x.lease_id) === str(lease_id)); if (l) return l; }
  const cand = list.filter((l) => sameUnit(l.unit, unit) && (!tenant || sameParty(l.tenant, tenant) || !partyKey(tenant)));
  if (!date) return cand[0] || null;
  return cand.find((l) => inWindow(date, l.start, l.end)) || cand.sort((a, b) => String(b.end).localeCompare(String(a.end)))[0] || null;
}

const monthlyOf = (o, sqft) => (o.monthly !== undefined ? o.monthly : o.annual !== undefined ? o.annual / 12 : o.annual_per_sqft !== undefined && sqft ? (o.annual_per_sqft * sqft) / 12 : null);

/** The index value for a month, or the latest one before it within `lookback` months. */
export function indexValue(series, month, lookback = 0) {
  if (!series) return null;
  for (let i = 0; i <= lookback; i++) { const k = monthKey(addMonths(`${month}-01`, -i)); if (series[k] !== undefined) return { month: k, value: series[k] }; }
  return null;
}

/**
 * The rent schedule of a lease: [{ from, to, monthly, reason }]. Explicit steps win;
 * otherwise the escalation clause is applied every `every_months` from `first`
 * (default: the first anniversary). CPI escalations need the buyer's index series;
 * a period whose index month is missing gets monthly null and reason "index missing".
 */
export function rentSchedule(lease, { indexes = {}, through = null } = {}) {
  const r = lease.rent || {}; const sqft = num(lease.sqft);
  const end = isoDate(through && through < lease.end ? through : lease.end);
  const out = [];
  if (Array.isArray(r.steps) && r.steps.length) {
    const steps = [...r.steps].sort((a, b) => a.from.localeCompare(b.from));
    const base = monthlyOf(r, sqft);
    if (base !== null && steps[0].from > lease.start) out.push({ from: lease.start, monthly: round2(base), reason: 'base rent' });
    for (const s of steps) out.push({ from: s.from < lease.start ? lease.start : s.from, monthly: monthlyOf(s, sqft) === null ? null : round2(monthlyOf(s, sqft)), reason: 'rent step' });
  } else {
    let cur = monthlyOf(r, sqft);
    out.push({ from: lease.start, monthly: cur === null ? null : round2(cur), reason: 'base rent' });
    const e = lease.escalation;
    if (e && e.type !== 'none' && cur !== null) {
      const every = e.every_months || 12; let at = e.first || addMonths(lease.start, every); let n = 0;
      const series = e.type === 'cpi' ? indexes[(e.cpi && e.cpi.index) || Object.keys(indexes)[0]] : null;
      let prevIdx = e.type === 'cpi' && e.cpi && e.cpi.base_month ? indexValue(series, e.cpi.base_month) : null;
      while (at <= end && n++ < 600) {
        let next = null; let reason = '';
        if (e.type === 'fixed_pct') { next = cur * (1 + (e.pct || 0) / 100); reason = `escalation ${e.pct}%`; }
        else if (e.type === 'fixed_amount') { next = cur + (e.amount || 0); reason = `escalation +${e.amount}`; }
        else if (e.type === 'cpi') {
          const lag = (e.cpi && e.cpi.lag_months) ?? 2;
          const idx = indexValue(series, monthKey(addMonths(at, -lag)));
          if (!idx || !prevIdx) { out.push({ from: at, monthly: null, reason: 'index missing' }); cur = null; break; }
          let change = ((idx.value - prevIdx.value) / prevIdx.value) * 100;
          if (e.cpi && e.cpi.floor_pct !== undefined) change = Math.max(change, e.cpi.floor_pct);
          if (e.cpi && e.cpi.cap_pct !== undefined) change = Math.min(change, e.cpi.cap_pct);
          next = cur * (1 + change / 100); reason = `CPI ${round2(change)}% (${prevIdx.month} → ${idx.month})`; prevIdx = idx;
        }
        cur = next; out.push({ from: at, monthly: round2(cur), reason });
        at = addMonths(at, every);
      }
    }
  }
  const sorted = out.filter((s) => s.from <= end).sort((a, b) => a.from.localeCompare(b.from));
  return sorted.map((s, i) => ({ ...s, to: i + 1 < sorted.length ? addDays(sorted[i + 1].from, -1) : end }));
}

/** Scheduled monthly rent on a date (null when the lease is not in force or the schedule has a gap). */
export function rentAt(lease, date, opts = {}) {
  const d = isoDate(date); if (!d || d < lease.start || d > lease.end) return null;
  const s = rentSchedule(lease, { ...opts, through: d }).find((x) => x.from <= d && x.to >= d);
  if (!s || s.monthly === null) return null;
  const free = (lease.free_rent || []).find((f) => f.from <= d && f.to >= d);
  return free ? round2(s.monthly * (1 - (free.pct ?? 100) / 100)) : s.monthly;
}

/** Rent billable for a month (YYYY-MM): each day at its schedule rate (monthly / days in month), free rent applied. Null when a rate is unknown. */
export function rentForMonth(lease, month, opts = {}) {
  const [y, m] = month.split('-').map(Number); const dim = daysInMonth(y, m); const last = `${month}-${String(dim).padStart(2, '0')}`;
  if (lease.end < `${month}-01` || lease.start > last) return 0;
  const sched = rentSchedule(lease, { ...opts, through: last });
  let total = 0;
  for (let i = 1; i <= dim; i++) {
    const d = `${month}-${String(i).padStart(2, '0')}`;
    if (d < lease.start || d > lease.end) continue;
    const s = sched.find((x) => x.from <= d && x.to >= d);
    if (!s || s.monthly === null) return null;
    const free = (lease.free_rent || []).find((f) => f.from <= d && f.to >= d);
    total += (s.monthly / dim) * (free ? 1 - (free.pct ?? 100) / 100 : 1);
  }
  return round2(total);
}

// --------------------------------------------------------------------- CAM ----

/** Gross a variable expense up to `target` occupancy (both in %). Never grosses down. */
export function grossUp(amount, occupancyPct, targetPct) {
  if (!(occupancyPct > 0) || !(targetPct > 0) || occupancyPct >= targetPct) return round2(amount);
  return round2((amount * targetPct) / occupancyPct);
}

/**
 * The most a tenant can be charged for capped (controllable) expenses in `year` under a cap clause.
 *   cumulative     base × (1 + pct)^(years since base)                       — unused room carries forward
 *   compounding    same arithmetic as cumulative in this helper; some leases call it that
 *   noncumulative  prior year's actual capped charge × (1 + pct)             — needs prior_actual
 */
export function capLimit({ pct, type = 'cumulative', base_year, base_amount }, year, priorActual = null) {
  if (type === 'noncumulative') return priorActual === null || priorActual === undefined ? null : round2(priorActual * (1 + pct / 100));
  if (base_amount === undefined || base_year === undefined) return null;
  return round2(base_amount * (1 + pct / 100) ** Math.max(0, year - base_year));
}

/** A tenant's pro-rata share in % from the lease, or sqft / denominator. */
export function shareOf(lease, rentableSqft) {
  const c = lease.cam || {};
  if (c.share_pct !== undefined) return c.share_pct;
  const den = c.denominator_sqft || rentableSqft; const s = num(lease.sqft);
  return den && s ? round2((s / den) * 10000) / 100 : null;
}

// -------------------------------------------------------- percentage rent ----

/** Natural breakpoint: annual base rent divided by the percentage rate. */
export const naturalBreakpoint = (annualBase, ratePct) => (ratePct > 0 ? round2(annualBase / (ratePct / 100)) : null);

/** Percentage rent owed for a year of sales over the breakpoint. */
export function percentageRent(sales, breakpoint, ratePct) {
  if (breakpoint === null || breakpoint === undefined) return null;
  return round2(Math.max(0, sales - breakpoint) * (ratePct / 100));
}

// ------------------------------------------------------------- utilities ----

/**
 * Split a bill among units (RUBS: ratio utility billing). Methods: sqft, occupants,
 * units (equal, or each unit's `units` weight, e.g. a fraction of the period), or a weighted mix { sqft: 0.5, occupants: 0.5 }. Vacant units carry
 * their share (owner pays); returns cents that add up exactly to `amount`.
 */
export function rubsSplit(amount, units, method = 'sqft') {
  const weights = typeof method === 'string' ? { [method]: 1 } : method;
  const tot = {}; for (const k of Object.keys(weights)) tot[k] = units.reduce((s, u) => s + (k === 'units' ? num(u.units) ?? 1 : num(u[k]) || 0), 0);
  const raw = units.map((u) => Object.entries(weights).reduce((s, [k, w]) => s + (tot[k] ? (w * (k === 'units' ? num(u.units) ?? 1 : num(u[k]) || 0)) / tot[k] : 0), 0) / Object.values(weights).reduce((a, b) => a + b, 0));
  const cents = Math.round(amount * 100); const base = raw.map((r) => Math.floor(r * cents)); let left = cents - base.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r * cents - base[i], i]).sort((a, b) => b[0] - a[0]);
  for (let i = 0; left > 0 && i < order.length; i++, left--) base[order[i][1]]++;
  return units.map((u, i) => ({ ...u, share: base[i] / 100, ratio: round2(raw[i] * 100) }));
}

// ------------------------------------------------------------- ledgers ----

/** Charge and payment codes as words, so ledgers from different systems read the same. */
export const CHARGE_KINDS = Object.freeze({
  rent: ['rent', 'base rent', 'monthly rent', 'residential rent', 'commercial rent', 'miete', 'loyer', 'alquiler', 'aluguel', 'affitto', '家賃', '租金', '임대료', '월세'],
  cam: ['cam', 'common area', 'common area maintenance', 'opex', 'operating expense', 'nebenkosten', 'betriebskosten', 'charges', 'gastos comunes', 'condominio', 'spese condominiali', '共益費', '管理费', '관리비'],
  tax: ['real estate tax', 'property tax', 'ret', 'tax recovery', 'grundsteuer', 'taxe foncière', 'ibi', 'iptu', 'imu', '固定資産税', '房产税', '재산세'],
  insurance: ['insurance', 'ins recovery', 'versicherung', 'assurance', 'seguro', 'assicurazione', '保険', '保险', '보험'],
  utility: ['utility', 'utilities', 'water', 'sewer', 'trash', 'electric', 'gas', 'rubs', 'wasser', 'strom', 'eau', 'électricité', 'agua', 'luz', 'água', 'acqua', '水道', '光熱費', '水电', '공과금'],
  late_fee: ['late fee', 'late charge', 'late', 'nsf', 'nsf fee', 'mahngebühr', 'pénalité de retard', 'recargo', 'multa', 'mora', '延滞金', '滞纳金', '연체료'],
  deposit: ['security deposit', 'deposit', 'sd', 'kaution', 'dépôt de garantie', 'fianza', 'depósito', 'caução', 'cauzione', 'deposito cauzionale', '敷金', '保証金', '押金', '보증금'],
  percentage_rent: ['percentage rent', 'overage rent', 'umsatzmiete', 'loyer variable', 'renta variable', 'aluguel percentual'],
  parking: ['parking', 'garage', 'stellplatz', 'parking fee', 'estacionamiento', 'estacionamento', '駐車場', '停车费', '주차'],
  pet: ['pet rent', 'pet fee', 'pet'],
  credit: ['credit', 'concession', 'adjustment', 'write off', 'write-off', 'gutschrift', 'avoir', 'abono', 'crédito'],
  payment: ['payment', 'receipt', 'ach', 'check', 'cheque', 'zahlung', 'paiement', 'pago', 'pagamento', '入金', '收款', '입금'],
  other: [],
});
const KIND_INDEX = Object.entries(CHARGE_KINDS).flatMap(([k, ws]) => ws.map((w) => [normalizeName(w, { stripEntity: false }) || w.toLowerCase(), k])).sort((a, b) => b[0].length - a[0].length);

const CODE_PREFIX = [[/^(rnt|rent|brent|baserent)/, 'rent'], [/^(cam|opex|oprec|opx)/, 'cam'], [/^(ret|tax|rtax|retax)/, 'tax'], [/^(ins|insur)/, 'insurance'], [/^(late|lfee|nsf)/, 'late_fee'], [/^(util|wtr|water|swr|sewer|trash|elec|rubs)/, 'utility'], [/^(sec|sdep|dep)/, 'deposit'], [/^(pct|ovg|overage)/, 'percentage_rent'], [/^(park|prk|garage)/, 'parking'], [/^pet/, 'pet'], [/^(conc|cred|adj|wo)/, 'credit'], [/^(pmt|pay|rcpt|ach|chk)/, 'payment']];

/** Map a charge code or description to a CHARGE_KINDS key. `aliases` maps your own codes ("RNT", "CAMREC") to kinds. */
export function chargeKind(text, aliases = {}) {
  const raw = str(text); if (!raw) return 'other';
  if (CHARGE_KINDS[raw]) return raw;
  for (const [k, v] of Object.entries(aliases || {})) if (str(k).toLowerCase() === raw.toLowerCase()) return CHARGE_KINDS[v] ? v : 'other';
  // Short system codes (Yardi-style "RNTCOM", "CAMEST", "RETREC"): read by their start.
  if (/^[A-Za-z]{2,10}\d{0,3}$/.test(raw)) { const c = raw.toLowerCase(); for (const [re, k] of CODE_PREFIX) if (re.test(c)) return k; }
  const t = normalizeName(raw, { stripEntity: false }) || raw.toLowerCase();
  for (const [w, k] of KIND_INDEX) if (w && (t === w || t.startsWith(`${w} `) || t.endsWith(` ${w}`) || t.includes(` ${w} `) || (/[^\x00-\x7f]/.test(w) && t.includes(w)))) return k;
  return 'other';
}

/** Aging bucket for days past due. */
export function agingBucket(days) {
  if (days === null || days === undefined) return 'unknown';
  if (days <= 0) return 'current'; if (days <= 30) return '1-30'; if (days <= 60) return '31-60'; if (days <= 90) return '61-90'; return '90+';
}
export const AGING_BUCKETS = Object.freeze(['current', '1-30', '31-60', '61-90', '90+']);

// ------------------------------------------------------------- rent rolls ----

const VACANT = /\b(vacant|vacancy|unrented|model|down|empty|leer|leerstand|vacance|vacant|vacío|vacante|desocupad|vago|sfitt|空室|空置|공실)/i;
const NOTICE = /\bnotice|ntv|on notice|gekündigt|préavis|aviso/i;

/**
 * Group rent roll rows into one record per unit. Exports that list each charge on its
 * own row (Yardi "with lease charges") are summed by kind: rent, cam, other. A row with a
 * blank unit continues the unit above it. aliases maps your charge codes to kinds.
 */
export function groupRentRoll(rows, { aliases = {} } = {}) {
  const m = new Map(); let last = null;
  for (const r of rows) {
    let u = str(r.unit);
    if (!u && last && (str(r.charge_code) || num(r.charge_amount) !== null)) u = last;
    if (!u) continue; last = u;
    const key = `${str(r.property).toLowerCase()}|${unitKey(u)}`;
    let e = m.get(key);
    if (!e) { e = { property: str(r.property), unit: u, tenant: '', lease_id: '', status: '', sqft: null, bedrooms: '', market_rent: null, rent: null, annual_rent: null, deposit: null, lease_start: null, lease_end: null, move_in: null, move_out: null, balance: null, charges: {}, rows: 0 }; m.set(key, e); }
    e.rows++;
    for (const k of ['tenant', 'lease_id', 'status', 'bedrooms', 'property']) if (!e[k] && str(r[k])) e[k] = str(r[k]);
    for (const k of ['sqft', 'market_rent', 'rent', 'annual_rent', 'deposit', 'balance']) if (e[k] === null && num(r[k]) !== null) e[k] = num(r[k]);
    for (const k of ['lease_start', 'lease_end', 'move_in', 'move_out']) if (!e[k] && isoDate(r[k])) e[k] = isoDate(r[k]);
    if (str(r.charge_code) && num(r.charge_amount) !== null) { const kind = chargeKind(r.charge_code, aliases); e.charges[kind] = round2((e.charges[kind] || 0) + num(r.charge_amount)); }
  }
  for (const e of m.values()) {
    if (e.rent === null && e.charges.rent !== undefined) e.rent = e.charges.rent;
    if (e.rent === null && e.annual_rent !== null) e.rent = round2(e.annual_rent / 12);
    e.on_notice = NOTICE.test(e.status);
    e.vacant = (!e.on_notice && VACANT.test(e.status)) || (!e.tenant && !e.rent) || /^vacant/i.test(e.status) || /^(vacant|vacancy|leer|leerstand|vacance|vacío|vacante|vago|sfitto|空室|空置|공실)$/i.test(e.tenant);
    if (e.vacant && /^(vacant|vacancy)$/i.test(e.tenant)) e.tenant = '';
  }
  return [...m.values()];
}
