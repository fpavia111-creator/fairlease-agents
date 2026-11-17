// Work-order aging, repeats, likely emergencies, vendor scorecard and cost outliers. Pure functions.
import { r2, num, str, isoDate, daysBetween, unitKey, partyKey, foldText } from 'keystone-core';

export const WO_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    complete_days: { type: 'object', additionalProperties: false, properties: { emergency: { type: 'number', minimum: 0 }, high: { type: 'number', minimum: 0 }, normal: { type: 'number', minimum: 0 }, low: { type: 'number', minimum: 0 } } },
    repeat_days: { type: 'integer', minimum: 1, maximum: 730 },
    stale_days: { type: 'integer', minimum: 1, maximum: 730 },
    unassigned_days: { type: 'integer', minimum: 0, maximum: 60 },
    outlier_factor: { type: 'number', minimum: 1.5, maximum: 50 },
    emergency_words: { type: 'array', items: { type: 'string', minLength: 3 } },
  },
});
export const DEFAULT_TARGETS = Object.freeze({ emergency: 1, high: 3, normal: 7, low: 14 });
// Words that usually mean someone should look today. Filed as routine, they are worth a second look.
const EMERGENCY = ['leak', 'leaking', 'flood', 'water coming', 'no heat', 'no hot water', 'gas smell', 'smell gas', 'sparks', 'sparking', 'fire', 'burning smell', 'sewage', 'backing up', 'no power', 'carbon monoxide', 'locked out', 'broken window', 'smoke coming', 'smoke in', 'tropft', 'wasserschaden', 'keine heizung', 'gasgeruch', 'fuite', 'inondation', 'pas de chauffage', 'odeur de gaz', 'fuga', 'inundación', 'sin calefacción', 'olor a gas', 'vazamento', 'sem aquecimento', 'perdita', 'allagamento', '漏水', '水漏れ', 'ガス臭', '暖房が効かない', '漏水', '燃气味', '没有暖气', '누수', '가스 냄새', '난방이 안'];
const PRI = (v) => { const t = foldText(str(v)).toLowerCase(); if (/non urgent|not urgent|nonurgent|routine/.test(t)) return 'normal'; if (/emerg|urgent|notfall|urgence|emergencia|emergenza|緊急|紧急|긴급|critical|p1/.test(t)) return 'emergency'; if (/high|hoch|haute|alta|elevat|高|높음|p2/.test(t)) return 'high'; if (/\blow\b|niedrig|basse|baja|bassa|低|낮음|p4/.test(t)) return 'low'; return 'normal'; };
const CLOSED = /complet|closed|done|finished|resolved|erledigt|abgeschlossen|termin|clôtur|cerrad|complet|conclu|fechad|chius|完了|完成|已完成|완료/i;
const NOT_CLOSED = /incomplete|not complete|uncomplete|unresolved|not done|not finished|unfinished/i;
const isClosed = (s) => CLOSED.test(s) && !NOT_CLOSED.test(s);
// A Latin word matches as a whole word (with a plain ending such as -s, -ing, -ed or -y), so "fire" is not found in "fireplace"; other scripts match as written.
const hasWord = (text, w) => (/^[\x00-\x7f]+$/.test(w) ? new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es|ing|ed|y)?($|[^a-z0-9])`).test(text) : text.includes(w));
const CANCEL = /cancel|void|storn|annul|anulad|cancelad|annullat|取消|キャンセル|취소/i;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

export function checkWorkOrders({ rows, policy = {}, asOf }) {
  const targets = { ...DEFAULT_TARGETS, ...(policy.complete_days || {}) };
  const repeatDays = policy.repeat_days ?? 90; const stale = policy.stale_days ?? 30; const unassigned = policy.unassigned_days ?? 2; const factor = policy.outlier_factor ?? 4;
  const words = (policy.emergency_words && policy.emergency_words.length ? policy.emergency_words : EMERGENCY).map((w) => foldText(w).toLowerCase());
  const wos = rows.map((r) => ({ id: str(r.work_order), property: str(r.property), unit: str(r.unit), category: str(r.category) || 'other', description: str(r.description), priority: PRI(r.priority), priority_text: str(r.priority), status_text: str(r.status), vendor: str(r.vendor), created: isoDate(r.created), completed: isoDate(r.completed), cost: num(r.cost) }))
    .filter((w) => w.id && !CANCEL.test(w.status_text));
  const byCat = {}; for (const w of wos) if (w.completed && w.cost) (byCat[w.category] = byCat[w.category] || []).push(w.cost);
  const medByCat = Object.fromEntries(Object.entries(byCat).map(([c, xs]) => [c, xs.length >= 3 ? median(xs) : null]));
  // Common-area orders (no unit) are never repeats of each other; the same unit number in another property is another unit.
  const placeKey = (o) => (unitKey(o.unit) ? `${foldText(o.property)}\u0000${unitKey(o.unit)}` : '');
  const groupKey = (o) => (placeKey(o) ? `${placeKey(o)}\u0000${o.category}` : '');
  // Same unit and category, grouped once: comparing every order with every other order is slow on large files.
  const byUnitCat = new Map(); for (const o of wos) { const k = groupKey(o); if (!k) continue; if (!byUnitCat.has(k)) byUnitCat.set(k, []); byUnitCat.get(k).push(o); }
  const items = [];
  for (const w of wos) {
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const closed = !!w.completed || isClosed(w.status_text);
    const backwards = !!(w.created && w.completed && w.completed < w.created);
    // A closed order with no completed date cannot be aged: today is not the day it was finished.
    const age = w.created && !backwards && (w.completed || !closed) ? daysBetween(w.created, w.completed || asOf) : null; const target = targets[w.priority];
    if (!w.created) add('created_missing', 'No created date; the order cannot be aged.');
    if (backwards) add('dates_out_of_order', `Completed ${w.completed}, before it was created on ${w.created}; one of the dates is wrong, so it is not aged.`);
    if (closed && !w.completed && w.created) add('completed_date_missing', 'Marked closed with no completed date, so it cannot be checked against your target.', { severity: 'note' });
    const text = foldText(`${w.description} ${w.category}`).toLowerCase();
    const hit = words.find((x) => hasWord(text, x));
    if (hit && w.priority !== 'emergency' && !closed) add('possible_emergency', `"${w.description}" mentions "${hit}" but is filed as ${w.priority}; someone should look at it today.`);
    if (age !== null && target !== undefined && age > target) add(closed ? 'completed_late' : 'overdue', `${closed ? 'Completed' : 'Open'} ${age} day(s) after it was created; your ${w.priority} target is ${target}.`);
    if (!closed && age !== null && age > stale) add('stale', `Open for ${age} days.`);
    if (!closed && !w.vendor && age !== null && age > unassigned) add('unassigned', `No vendor or technician after ${age} days.`);
    if (closed && w.cost === null) add('cost_missing', 'Completed with no cost recorded.', { severity: 'note' });
    const med = medByCat[w.category];
    if (w.cost && med && w.cost > med * factor) add('cost_outlier', `Cost ${w.cost} is ${r2(w.cost / med)}× the ${w.category} median of ${med}; check the invoice or whether it was a replacement.`);
    const repeats = (byUnitCat.get(groupKey(w)) || []).filter((o) => o !== w && o.created && w.created && o.created < w.created && daysBetween(o.created, w.created) <= repeatDays);
    if (repeats.length) add('repeat', `${repeats.length + 1} ${w.category} orders in unit ${w.unit} within ${repeatDays} days (${[...repeats.map((o) => o.id), w.id].join(', ')}); the first fix may not have held.`);
    const issue = findings.some((f) => f.severity !== 'note');
    items.push({ work_order: w.id, property: w.property, unit: w.unit, category: w.category, description: w.description, priority: w.priority, vendor: w.vendor, created: w.created, completed: w.completed, days_open: age, target_days: target, cost: w.cost, open: !closed, status: issue ? 'issue' : 'ok', findings });
  }
  const rank = (i) => (i.findings.some((f) => f.code === 'possible_emergency') ? 0 : i.open && i.status === 'issue' ? 1 : i.status === 'issue' ? 2 : 3);
  items.sort((a, b) => rank(a) - rank(b) || (b.days_open ?? 0) - (a.days_open ?? 0));
  const vendors = {};
  for (const i of items) { if (!i.vendor) continue; const vk = partyKey(i.vendor) || i.vendor; const v = vendors[vk] || (vendors[vk] = { vendor: i.vendor, orders: 0, completed: 0, timed: 0, on_time: 0, days: 0, cost: 0, open: 0 }); v.orders++; if (i.open) v.open++; else { v.completed++; if (i.days_open !== null) { v.timed++; v.days += i.days_open; if (i.days_open <= i.target_days) v.on_time++; } v.cost = r2(v.cost + (i.cost || 0)); } }
  const scorecard = Object.values(vendors).map((v) => ({ vendor: v.vendor, count: v.orders, open: v.open, average_days: v.timed ? r2(v.days / v.timed) : null, on_time_pct: v.timed ? r2(v.on_time / v.timed * 100) : null, total: v.cost })).sort((a, b) => (a.on_time_pct ?? 101) - (b.on_time_pct ?? 101));
  const hot = new Map(); for (const i of items) { const k = placeKey(i); if (!k || !i.created || daysBetween(i.created, asOf) > repeatDays || daysBetween(i.created, asOf) < 0) continue; const h = hot.get(k) || { unit: i.unit, property: i.property, count: 0 }; h.count++; hot.set(k, h); }
  const hotspots = [...hot.values()].filter((h) => h.count >= 3).map((h) => ({ unit: h.unit, property: h.property, count: h.count }));
  const open = items.filter((i) => i.open);
  const summary = `${items.length} work order(s), ${open.length} open as of ${asOf}: ${items.filter((i) => i.findings.some((f) => f.code === 'possible_emergency')).length} possible emergency filed as routine, ${open.filter((i) => i.findings.some((f) => f.code === 'overdue')).length} open past target, ${items.filter((i) => i.findings.some((f) => f.code === 'repeat')).length} repeat(s), ${items.filter((i) => i.findings.some((f) => f.code === 'cost_outlier')).length} cost outlier(s). ${hotspots.length ? `Units with ${hotspots.map((h) => `${h.count} orders`).join(', ')} in ${repeatDays} days: ${hotspots.map((h) => h.unit).join(', ')}.` : ''}`.trim();
  return { summary, as_of: asOf, targets, vendors: scorecard, hotspots, items };
}
