// Unit turns: days, cost, chargeable items and rent lost. Pure functions.
import { r2, num, str, isoDate, daysBetween, unitKey, foldText } from 'keystone-core';

export const TURN_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    target_days: { type: 'integer', minimum: 1, maximum: 120 },
    ready_to_lease_days: { type: 'integer', minimum: 1, maximum: 365 },
    budget: { type: 'object', additionalProperties: { type: 'number', minimum: 0 } },
    default_budget: { type: 'number', minimum: 0 },
    unit_bedrooms: { type: 'object', additionalProperties: { type: 'integer', minimum: 0, maximum: 20 } },
  },
});
const yes = (v) => /^(y|yes|true|1|ja|oui|sí|si|sim|はい|是|예|x|tenant|resident|charge|chargeable|charge tenant|bill tenant|mieter|locataire|inquilino)$/i.test(str(v));
const no = (v) => /^(n|no|false|0|nein|non|não|nao|いいえ|否|아니오|owner|landlord|normal wear|wear and tear|not chargeable|none)$/i.test(str(v));
const partial = (v) => /^(partial|part|teilweise|partiel|parcial|parziale|一部|部分|일부)$/i.test(str(v));

export function checkTurns({ rows, policy = {}, asOf }) {
  const target = policy.target_days ?? 7; const r2l = policy.ready_to_lease_days ?? 14;
  const groups = new Map(); const lastTurn = new Map();
  const bedsOf = new Map(Object.entries(policy.unit_bedrooms || {}).map(([u, b]) => [unitKey(u), b]));
  for (const r of rows) {
    const out = isoDate(r.move_out); const place = `${foldText(str(r.property))}|${unitKey(r.unit)}`;
    // A cost line with no dates at all belongs to the turn above it for the same unit.
    const undated = !out && !isoDate(r.ready) && !isoDate(r.move_in);
    const k = undated && lastTurn.has(place) ? lastTurn.get(place) : `${place}|${out || ''}`;
    if (out) lastTurn.set(place, k);
    const g = groups.get(k) || { property: str(r.property), unit: str(r.unit), move_out: out, ready: null, move_in: null, rent: null, lines: [] };
    g.ready = g.ready || isoDate(r.ready); g.move_in = g.move_in || isoDate(r.move_in); if (g.rent === null) g.rent = num(r.rent);
    if (str(r.category) || num(r.cost) !== null) g.lines.push({ category: str(r.category) || 'other', vendor: str(r.vendor), cost: num(r.cost), chargeable: yes(r.chargeable) ? 'yes' : partial(r.chargeable) ? 'partial' : no(r.chargeable) ? 'no' : 'unknown' });
    groups.set(k, g);
  }
  const items = [];
  for (const g of groups.values()) {
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    if (!g.move_out) { add('move_out_missing', 'No move-out date; days cannot be counted.'); }
    const readyEnd = g.ready && g.ready <= asOf ? g.ready : null;
    const badReady = !!(g.move_out && g.ready && g.ready < g.move_out); const badMoveIn = !!(g.move_out && g.move_in && g.move_in < g.move_out);
    if (badReady || badMoveIn) add('dates_out_of_order', `${[badReady ? `ready ${g.ready}` : '', badMoveIn ? `move-in ${g.move_in}` : ''].filter(Boolean).join(' and ')} before the move-out on ${g.move_out}; one of the dates is wrong, so those days are not counted.`);
    const daysToReady = g.move_out && !badReady && g.move_out <= asOf ? daysBetween(g.move_out, readyEnd || asOf) : null;
    const leasedOn = g.move_in && g.move_in <= asOf ? g.move_in : null;
    const daysVacant = g.move_out && !badMoveIn && g.move_out <= asOf ? daysBetween(g.move_out, g.move_in || asOf) : null;
    const cost = r2(g.lines.reduce((s, l) => s + (l.cost || 0), 0));
    const chargeable = r2(g.lines.filter((l) => l.chargeable === 'yes').reduce((s, l) => s + (l.cost || 0), 0));
    const beds = bedsOf.get(unitKey(g.unit));
    const byBeds = beds !== undefined && policy.budget && policy.budget[String(beds)] !== undefined;
    const budget = byBeds ? policy.budget[String(beds)] : policy.default_budget ?? null;
    const lost = g.rent !== null && daysVacant !== null ? r2((g.rent * 12 / 365) * daysVacant) : null;
    if (daysToReady !== null && daysToReady > target) add(readyEnd ? 'over_target' : 'open_over_target', `${readyEnd ? 'Made ready in' : 'Still not ready after'} ${daysToReady} days; your target is ${target}.`);
    if (budget !== null && cost > budget) add('over_budget', byBeds ? `Turn cost ${cost} is over the ${budget} budget for a ${beds}-bedroom unit.` : `Turn cost ${cost} is over your default budget of ${budget}.`, { amount: r2(cost - budget) });
    const noCost = g.lines.filter((l) => l.cost === null); if (noCost.length) add('cost_missing', `No cost yet for: ${noCost.map((l) => l.category).join(', ')}.`, { severity: 'note' });
    const noVendor = g.lines.filter((l) => !l.vendor && l.cost !== null); if (noVendor.length) add('vendor_missing', `No vendor for: ${noVendor.map((l) => l.category).join(', ')}.`, { severity: 'note' });
    const unknown = g.lines.filter((l) => l.chargeable === 'unknown'); if (unknown.length) add('chargeable_unknown', `Not marked whether the tenant is charged: ${unknown.map((l) => l.category).join(', ')}.`);
    const part = g.lines.filter((l) => l.chargeable === 'partial'); if (part.length) add('chargeable_partial', `Partly chargeable, amount to set: ${part.map((l) => `${l.category} ${l.cost}`).join(', ')}.`, { severity: 'note' });
    if (readyEnd && !g.move_in && daysBetween(readyEnd, asOf) > r2l) add('ready_not_leased', `Ready since ${readyEnd} (${daysBetween(readyEnd, asOf)} days) with no move-in.`);
    if (chargeable > 0) add('tenant_chargeable', `${chargeable} marked chargeable to the former tenant; it belongs on the deposit statement.`, { severity: 'note', amount: chargeable });
    const stage = leasedOn ? 'moved_in' : g.move_in ? 'leased' : readyEnd ? 'ready' : 'in_progress';
    const issue = findings.some((f) => f.severity !== 'note');
    items.push({ property: g.property, unit: g.unit, move_out: g.move_out, ready: g.ready, move_in: g.move_in, stage, days_to_ready: daysToReady, days_vacant: daysVacant, cost, budget, chargeable, rent_lost: lost, status: issue ? 'issue' : 'ok', findings, lines: g.lines });
  }
  const order = { in_progress: 0, ready: 1, leased: 2, moved_in: 3 };
  items.sort((a, b) => (a.status === 'issue' ? 0 : 1) - (b.status === 'issue' ? 0 : 1) || order[a.stage] - order[b.stage] || String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true }));
  const done = items.filter((i) => i.ready && i.ready <= asOf && i.days_to_ready !== null);
  const avg = done.length ? r2(done.reduce((s, i) => s + i.days_to_ready, 0) / done.length) : null;
  const byCat = {}; for (const i of items) for (const l of i.lines) byCat[l.category] = r2((byCat[l.category] || 0) + (l.cost || 0));
  const summary = `${items.length} turn(s) as of ${asOf}: ${items.filter((i) => i.stage === 'in_progress').length} in progress, ${items.filter((i) => i.stage === 'ready').length} ready and not leased. Average ${avg ?? '-'} days to ready (target ${target}). Cost ${r2(items.reduce((s, i) => s + i.cost, 0))}, of which ${r2(items.reduce((s, i) => s + i.chargeable, 0))} chargeable to former tenants; rent lost while vacant ${r2(items.reduce((s, i) => s + (i.rent_lost || 0), 0))}. ${items.filter((i) => i.status === 'issue').length} turn(s) need attention.`;
  return { summary, as_of: asOf, average_days_to_ready: avg, cost_by_category: byCat, items };
}
