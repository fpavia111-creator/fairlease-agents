// Property management system migration check: the old system's rent roll against the new one's at cutover. Pure functions.
import { r2, str, groupRentRoll, unitKey, sameParty, foldText } from 'keystone-core';

const D = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const FIELDS = ['tenant', 'rent', 'deposit', 'balance', 'market_rent', 'sqft', 'lease_start', 'lease_end', 'move_in', 'occupancy'];
export const MIGRATION_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    cutover: D,
    tolerance: { type: 'number', minimum: 0, maximum: 100 },
    fields: { type: 'array', minItems: 1, maxItems: FIELDS.length, items: { type: 'string', enum: FIELDS } },
    unit_map: { type: 'object', maxProperties: 50000, additionalProperties: { type: 'string', minLength: 1, maxLength: 60 } },
    ignore_units: { type: 'array', maxItems: 20000, items: { type: 'string', minLength: 1, maxLength: 60 } },
  },
});

const fold = (s) => foldText(str(s)).toLowerCase();
const tail = (u) => { const m = str(u).match(/(\d+[a-z]?)\s*$/i); return m ? m[1].toLowerCase().replace(/^0+(?=\d)/, '') : null; };
const MONEY = ['rent', 'deposit', 'balance', 'market_rent'];
const LABEL = { tenant: 'tenant', rent: 'rent', deposit: 'deposit', balance: 'balance', market_rent: 'market rent', sqft: 'area', lease_start: 'lease start', lease_end: 'lease end', move_in: 'move-in', occupancy: 'occupancy' };

/** Pairs old units with new ones: unit map and learned aliases first, then the same unit, then the same trailing number when it is unique on both sides. */
export function matchUnits(oldUnits, newUnits, { unitMap = {}, learned = {} } = {}) {
  const pairs = []; const usedNew = new Set();
  const map = new Map(Object.entries({ ...unitMap, ...learned }).map(([o, n]) => [unitKey(o), unitKey(n)]));
  const byKey = new Map(); for (const n of newUnits) { const k = unitKey(n.unit); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(n); }
  const choose = (cands, o) => cands.filter((n) => !usedNew.has(n)).sort((a, b) => (fold(b.property) === fold(o.property)) - (fold(a.property) === fold(o.property)))[0];
  const left = [];
  for (const o of oldUnits) {
    const mk = map.get(unitKey(o.unit)); let n = null; let how = 'same unit';
    if (mk) { n = choose(byKey.get(mk) || [], o); how = 'unit map'; }
    if (!n) { n = choose(byKey.get(unitKey(o.unit)) || [], o); how = 'same unit'; }
    if (n) { usedNew.add(n); pairs.push({ old: o, new: n, how }); } else left.push(o);
  }
  // Trailing number ("B-201" and "201"), only when exactly one candidate remains on each side.
  const restNew = newUnits.filter((n) => !usedNew.has(n));
  const count = (xs, t) => xs.filter((x) => tail(x.unit) === t).length;
  const unmatched = [];
  for (const o of left) {
    const t = tail(o.unit); const c = t ? restNew.filter((n) => !usedNew.has(n) && tail(n.unit) === t) : [];
    if (t && c.length === 1 && count(left, t) === 1) { usedNew.add(c[0]); pairs.push({ old: o, new: c[0], how: 'same number' }); } else unmatched.push(o);
  }
  return { pairs, missing: unmatched, extra: newUnits.filter((n) => !usedNew.has(n)) };
}

const occ = (u) => (u.vacant ? 'vacant' : u.on_notice ? 'notice' : 'occupied');

export function checkMigration({ before, after, policy = {}, learned = {} }) {
  const tol = policy.tolerance ?? 0.01; const fields = policy.fields || FIELDS;
  const ignore = new Set((policy.ignore_units || []).map(unitKey));
  const A = groupRentRoll(before).filter((u) => !ignore.has(unitKey(u.unit)));
  const B = groupRentRoll(after).filter((u) => !ignore.has(unitKey(u.unit)));
  const { pairs, missing, extra } = matchUnits(A, B, { unitMap: policy.unit_map, learned });
  const items = [];
  for (const p of pairs) {
    const o = p.old; const n = p.new; const findings = []; const add = (code, detail, extra2 = {}) => findings.push({ code, detail, ...extra2 });
    if (p.how === 'same number') add('matched_by_number', `Old unit "${o.unit}" was paired with new unit "${n.unit}" by its number. Confirm, then teach it as a unit alias.`);
    for (const f of fields) {
      if (f === 'tenant') { if ((o.tenant || n.tenant) && !(o.tenant && n.tenant && sameParty(o.tenant, n.tenant))) add('tenant_differs', `Tenant "${o.tenant || 'blank'}" became "${n.tenant || 'blank'}".`); continue; }
      if (f === 'occupancy') { if (occ(o) !== occ(n)) add('occupancy_differs', `Was ${occ(o)}, now ${occ(n)}.`); continue; }
      const a = o[f]; const b = n[f];
      if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === '')) continue;
      if (MONEY.includes(f) || f === 'sqft') {
        const x = a ?? 0; const y = b ?? 0;
        if (Math.abs(x - y) > (f === 'sqft' ? 0.5 : tol)) add(`${f}_differs`, `${LABEL[f][0].toUpperCase()}${LABEL[f].slice(1)} ${a ?? 'blank'} became ${b ?? 'blank'}${a !== null && b !== null ? ` (${y - x > 0 ? '+' : ''}${r2(y - x)})` : ''}.`, { amount: r2(y - x) });
      } else if (a !== b) add(f === 'move_in' ? 'move_in_differs' : 'lease_dates_differ', `${LABEL[f][0].toUpperCase()}${LABEL[f].slice(1)} ${a || 'blank'} became ${b || 'blank'}.`);
    }
    const codes = findings.map((x) => x.code);
    const status = codes.some((c) => c !== 'matched_by_number') ? 'differs' : codes.length ? 'review' : 'ok';
    items.push({ unit: o.unit, new_unit: n.unit, property: o.property || n.property || null, tenant: o.tenant || n.tenant, matched_by: p.how, status, amount: r2((n.balance ?? 0) - (o.balance ?? 0)), findings, old: pick(o), new: pick(n) });
  }
  for (const o of missing) items.push({ unit: o.unit, new_unit: null, property: o.property || null, tenant: o.tenant, matched_by: null, status: 'missing', amount: o.balance ?? 0, findings: [{ code: 'missing_in_new', detail: `In the old system (${occ(o)}${o.tenant ? `, ${o.tenant}` : ''}${o.balance ? `, balance ${o.balance}` : ''}) but not in the new one.` }], old: pick(o), new: null });
  for (const n of extra) items.push({ unit: n.unit, new_unit: n.unit, property: n.property || null, tenant: n.tenant, matched_by: null, status: 'extra', amount: n.balance ?? 0, findings: [{ code: 'extra_in_new', detail: `In the new system (${occ(n)}${n.tenant ? `, ${n.tenant}` : ''}) but not in the old one.` }], old: null, new: pick(n) });
  const order = { missing: 0, extra: 1, differs: 2, review: 3, ok: 4 };
  items.sort((a, b) => order[a.status] - order[b.status] || String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true }));
  const sum = (xs, f) => r2(xs.reduce((s, u) => s + (u[f] || 0), 0));
  const totals = [
    { item: 'Units', expected: A.length, actual: B.length },
    { item: 'Occupied units', expected: A.filter((u) => !u.vacant).length, actual: B.filter((u) => !u.vacant).length },
    ...['rent', 'deposit', 'balance', 'market_rent', 'sqft'].map((f) => ({ item: LABEL[f][0].toUpperCase() + LABEL[f].slice(1), expected: sum(A, f), actual: sum(B, f) })),
  ].map((t) => ({ ...t, difference: r2(t.actual - t.expected), ties: Math.abs(t.actual - t.expected) <= tol }));
  const n = (s) => items.filter((i) => i.status === s).length;
  const untied = totals.filter((t) => !t.ties);
  const summary = `${A.length} unit(s) in the old system, ${B.length} in the new${policy.cutover ? ` at cutover ${policy.cutover}` : ''}: ${n('ok')} match, ${n('differs')} differ, ${n('review')} paired by number only, ${n('missing')} missing from the new system, ${n('extra')} only in the new system. ${untied.length ? `Totals that do not tie: ${untied.map((t) => `${t.item.toLowerCase()} ${t.expected} vs ${t.actual}`).join('; ')}.` : 'All totals tie.'}`;
  return { summary, cutover: policy.cutover || null, totals, items };
}

function pick(u) { return { unit: u.unit, tenant: u.tenant, status: occ(u), rent: u.rent, deposit: u.deposit, balance: u.balance, market_rent: u.market_rent, sqft: u.sqft, lease_start: u.lease_start, lease_end: u.lease_end, move_in: u.move_in }; }

/** Punch list for the implementation team. */
export function punchListText(r, a = {}) {
  const open = r.items.filter((i) => i.status !== 'ok');
  const rows = open.map((i) => `| ${i.unit}${i.new_unit && i.new_unit !== i.unit ? ` → ${i.new_unit}` : ''} | ${i.status} | ${i.findings.map((f) => f.detail).join(' ')} |`).join('\n') || '| | | Nothing open |';
  const tot = r.totals.filter((t) => !t.ties).map((t) => `| ${t.item} | ${t.expected} | ${t.actual} | ${t.difference} |`).join('\n');
  return `**To:** ${a.to || '[TO CONFIRM: implementation or conversion team]'}

# Migration punch list${r.cutover ? `: cutover ${r.cutover}` : ''}

${r.summary}

| Unit | Status | What to check |
|---|---|---|
${rows}
${tot ? `\n## Totals that do not tie\n\n| Total | Old system | New system | Difference |\n|---|---:|---:|---:|\n${tot}\n` : ''}
Please confirm each line is corrected in the new system or explained${a.by ? ` by ${a.by}` : ''}. Go-live sign-off stays with ${a.owner || '[TO CONFIRM: who signs off]'}.

${a.from || '[TO CONFIRM: your name and contact]'}
`;
}
