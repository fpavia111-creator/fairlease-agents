// Unit inspections: move-out against move-in item by item, periodic inspections on schedule, poor items followed by a work order. Pure functions.
import { num, str, isoDate, addDays, daysBetween, sameUnit, foldText, groupRentRoll } from 'keystone-core';

export const INSPECTION_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['interval_days'],
  properties: {
    interval_days: { type: 'integer', minimum: 30, maximum: 1100 },
    due_soon_days: { type: 'integer', minimum: 0, maximum: 120 },
    followup_days: { type: 'integer', minimum: 0, maximum: 120 },
    poor_at: { type: 'number', minimum: 1, maximum: 4 },
    scale_max: { type: 'number', minimum: 2, maximum: 100 },
    require_photo: { type: 'boolean' },
    skip_vacant: { type: 'boolean' },
    notice_hours: { type: 'integer', minimum: 0, maximum: 720 },
  },
});

// Condition words in nine languages, scored 1 (damaged) to 5 (new). Longest match wins.
const WORDS = [
  [5, ['excellent', 'like new', 'new', 'sehr gut', 'neu', 'neuf', 'excelente', 'nuevo', 'novo', 'ottimo', 'nuovo', '新品', '優', '全新', '优', '우수', '신품']],
  [4, ['good', 'ok', 'clean', 'gut', 'sauber', 'bon', 'propre', 'bien', 'bueno', 'limpio', 'bom', 'limpo', 'buono', 'pulito', '良', '良好', '好', '양호', '깨끗']],
  [3, ['fair', 'average', 'worn', 'befriedigend', 'mittel', 'abgenutzt', 'moyen', 'usé', 'regular', 'desgastado', 'razoável', 'gasto', 'discreto', 'usurato', '普通', '可', '一般', '磨损', '보통', '마모']],
  [2, ['poor', 'dirty', 'needs repair', 'needs cleaning', 'stained', 'schlecht', 'verschmutzt', 'reparaturbedürftig', 'mauvais', 'sale', 'à réparer', 'malo', 'sucio', 'necesita reparación', 'ruim', 'sujo', 'precisa de reparo', 'scarso', 'sporco', 'da riparare', '不良', '汚れ', '要修理', '差', '脏', '需维修', '불량', '오염', '수리 필요']],
  [1, ['damaged', 'broken', 'missing', 'not working', 'beschädigt', 'defekt', 'fehlt', 'endommagé', 'cassé', 'manquant', 'dañado', 'roto', 'falta', 'danificado', 'quebrado', 'faltando', 'danneggiato', 'rotto', 'mancante', '破損', '欠品', '故障', '损坏', '缺失', '坏', '파손', '분실', '고장']],
].flatMap(([s, ws]) => ws.map((w) => [w, s])).sort((a, b) => b[0].length - a[0].length);

/** Condition as a 1–5 score from a word or a number on scale_max; null when unrated. */
export function conditionScore(v, scaleMax = 5) {
  const t = foldText(str(v)).toLowerCase().trim(); if (!t) return null;
  const frac = str(v).trim().match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+)$/);
  const n = frac ? num(frac[1]) : /^[\d.,\s]+$/.test(t) ? num(v) : null; const max = frac ? num(frac[2]) : scaleMax;
  if (n !== null && max > 1) return Math.round((1 + ((Math.min(Math.max(n, 1), max) - 1) * 4) / (max - 1)) * 10) / 10;
  if (/(^|\s)(not|nicht|kein|pas|ne|no|não|nao|non)\s/.test(t) && !/not working/.test(t)) return null; // negated wording: a person reads it
  const exact = WORDS.find(([w]) => foldText(w).toLowerCase() === t); if (exact) return exact[1];
  const hit = WORDS.find(([w]) => (/^[a-zà-ÿ ]+$/.test(w) ? new RegExp(`(^|[^a-z])${foldText(w).toLowerCase()}([^a-z]|$)`).test(t) : t.includes(w)));
  return hit ? hit[1] : null;
}

const MOVE_IN = /move[- ]?in|einzug|entrée|entree|ingreso|vistoria de entrada|entrada|ingresso|入居|入住|입주/i;
const MOVE_OUT = /move[- ]?out|auszug|sortie|salida|saída|saida|uscita|退去|退房|退租|퇴거/i;
export const inspectionKind = (t) => (MOVE_OUT.test(str(t)) ? 'move_out' : MOVE_IN.test(str(t)) ? 'move_in' : 'periodic');
const itemKey = (r) => `${foldText(str(r.area)).toLowerCase().trim()}|${foldText(str(r.item)).toLowerCase().trim()}`;
const label = (r) => [str(r.area), str(r.item)].filter(Boolean).join(': ');

/** Rows grouped into inspections (unit, date, kind). */
export function groupInspections(rows, scaleMax = 5) {
  const m = new Map();
  for (const r of rows || []) {
    const d = isoDate(r.inspected_at); const unit = str(r.unit); if (!d || !unit) continue;
    const kind = inspectionKind(r.inspection_type); const k = `${unit.toLowerCase()}|${d}|${kind}`;
    if (!m.has(k)) m.set(k, { unit, date: d, kind, type: str(r.inspection_type), inspector: str(r.inspector), items: [] });
    m.get(k).items.push({ key: itemKey(r), label: label(r), condition: str(r.condition), score: conditionScore(r.condition, scaleMax), notes: str(r.notes), photo: str(r.photo) });
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function checkInspections({ rows, policy, rentRoll = null, workOrders = null, asOf }) {
  const scaleMax = policy.scale_max ?? 5; const poorAt = policy.poor_at ?? 2; const follow = policy.followup_days ?? 14; const soon = policy.due_soon_days ?? 30;
  const insp = groupInspections(rows, scaleMax); const roll = rentRoll ? groupRentRoll(rentRoll) : null;
  const units = new Map(); const key = (u) => str(u).toLowerCase().replace(/^(unit|apt|suite|#)\s*/i, '');
  if (roll) for (const r of roll) units.set(key(r.unit), { unit: r.unit, tenant: r.tenant, vacant: r.vacant });
  for (const i of insp) if (!units.has(key(i.unit))) units.set(key(i.unit), { unit: i.unit, tenant: '', vacant: null });
  const wos = (workOrders || []).map((w) => ({ unit: str(w.unit), created: isoDate(w.created), id: str(w.work_order), text: `${str(w.description)} ${str(w.category)}` })).filter((w) => w.created);
  const items = [];
  for (const u of units.values()) {
    const mine = insp.filter((i) => sameUnit(i.unit, u.unit)); const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const last = mine[mine.length - 1] || null; const lastAny = last ? last.date : null;
    // Periodic schedule: occupied units (or all units when no rent roll is given).
    let nextDue = null; let daysToDue = null;
    // Without a rent roll, a unit whose latest inspection is a move-out is taken as between residents.
    const between = u.vacant === null && last && last.kind === 'move_out';
    const scheduled = !((u.vacant || between) && policy.skip_vacant !== false);
    if (scheduled) {
      const lastOcc = [...mine].reverse().find((i) => i.kind !== 'move_out') || null;
      if (!lastOcc) { if (roll) add('never_inspected', 'No inspection on file for this unit.'); }
      else { nextDue = addDays(lastOcc.date, policy.interval_days); daysToDue = daysBetween(asOf, nextDue);
        if (daysToDue < 0) add('inspection_overdue', `Last inspection ${lastOcc.date} (${lastOcc.kind.replace('_', '-')}); the ${policy.interval_days}-day interval ran out ${nextDue}, ${-daysToDue} days ago.`);
        else if (daysToDue <= soon) add('inspection_due_soon', `Next inspection due ${nextDue} (${daysToDue} days).`, { severity: 'soon' }); }
    }
    // Move-out against the latest move-in before it.
    const worse = [];
    for (const out of mine.filter((i) => i.kind === 'move_out')) {
      const base = mine.filter((i) => i.kind === 'move_in' && i.date < out.date).pop();
      if (!base) { add('no_move_in_baseline', `Move-out inspection ${out.date} has no move-in inspection before it to compare with; condition changes cannot be shown.`); continue; }
      const before = new Map(base.items.map((x) => [x.key, x]));
      for (const x of out.items) {
        const b = before.get(x.key); if (!b || b.score === null || x.score === null || x.score >= b.score) continue;
        worse.push({ moved_out: out.date, moved_in: base.date, item: x.label, before: b.condition, after: x.condition, drop: Math.round((b.score - x.score) * 10) / 10, notes: x.notes, photo: x.photo });
      }
      const notIn = out.items.filter((x) => !before.has(x.key) && x.score !== null && x.score <= poorAt);
      if (notIn.length) add('not_in_move_in', `Rated poor at move-out ${out.date} but not on the move-in inspection: ${notIn.map((x) => x.label).join('; ')}.`, { severity: 'note' });
    }
    if (worse.length) add('worse_at_move_out', `Worse at move-out than at move-in: ${worse.map((w) => `${w.item} ${w.before} → ${w.after}`).join('; ')}. A person decides what is damage and what is normal wear.`, { count: worse.length });
    const noPhoto = worse.filter((w) => !w.photo);
    if (noPhoto.length && policy.require_photo !== false) add('no_photo', `No photo for a condition change: ${noPhoto.map((w) => w.item).join('; ')}.`);
    // Poor items in the latest inspection, and whether a work order followed.
    const poor = last ? last.items.filter((x) => x.score !== null && x.score <= poorAt) : [];
    if (poor.length) {
      if (!workOrders) add('poor_items', `Rated poor on ${last.date}: ${poor.map((x) => `${x.label} (${x.condition})`).join('; ')}.`, { severity: 'note' });
      else {
        const after = wos.filter((w) => sameUnit(w.unit, u.unit) && w.created >= last.date);
        const age = daysBetween(last.date, asOf);
        if (!after.length && age > follow) add('poor_no_work_order', `Rated poor on ${last.date} (${poor.map((x) => `${x.label}: ${x.condition}`).join('; ')}) and no work order opened for the unit since, ${age} days later.`);
        else if (!after.length) add('poor_follow_up_due', `Rated poor on ${last.date}: ${poor.map((x) => x.label).join('; ')}. No work order yet; ${follow - age} day(s) left of your ${follow}-day follow-up.`, { severity: 'soon' });
      }
    }
    const unrated = last ? last.items.filter((x) => x.score === null && x.condition) : [];
    if (unrated.length) add('unrated', `Condition not understood for: ${unrated.map((x) => `${x.label} "${x.condition}"`).join('; ')}.`, { severity: 'note' });
    const hard = findings.filter((f) => !f.severity);
    items.push({ unit: u.unit, tenant: u.tenant, vacant: u.vacant, inspections: mine.length, last_inspection: lastAny, last_kind: last ? last.kind : null, next_due: nextDue, days_to_due: daysToDue, worse, poor: poor.map((x) => ({ item: x.label, condition: x.condition })), status: hard.length ? 'issue' : findings.some((f) => f.severity === 'soon') ? 'due_soon' : 'ok', findings });
  }
  const rank = { issue: 0, due_soon: 1, ok: 2 };
  items.sort((a, b) => rank[a.status] - rank[b.status] || String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true }));
  const c = (code) => items.filter((i) => i.findings.some((f) => f.code === code)).length;
  const summary = `${items.length} unit(s), ${insp.length} inspection(s) on file as of ${asOf}: ${c('inspection_overdue')} overdue for the ${policy.interval_days}-day inspection${roll ? `, ${c('never_inspected')} never inspected` : ''}, ${c('inspection_due_soon')} due within ${soon} days; ${c('worse_at_move_out')} move-out(s) with items worse than at move-in (${items.reduce((s, i) => s + i.worse.length, 0)} item(s)), ${c('no_move_in_baseline')} with no move-in to compare${workOrders ? `; ${c('poor_no_work_order')} unit(s) with poor items and no work order after ${follow} days` : ''}.`;
  return { summary, as_of: asOf, interval_days: policy.interval_days, items };
}

/** Notice of entry for a periodic inspection. */
export function noticeText(it, a = {}, policy = {}) {
  return `**To:** ${a.to || `${it.tenant || '[TO CONFIRM: resident]'}, unit ${it.unit}`}

# Notice of entry for a unit inspection

Unit: ${it.unit}
Date and time window: ${a.when || '[TO CONFIRM: date and time window]'}
Purpose: routine inspection of the unit's condition, smoke and carbon monoxide alarms, and any needed repairs.

${policy.notice_hours ? `This notice is given at least ${policy.notice_hours} hours ahead, as your company's policy sets.` : '[TO CONFIRM: notice period your lease and local rules require]'} You do not need to be home. If the time does not work, please contact us${a.reply_by ? ` by ${a.reply_by}` : ''}.

${a.from || '[TO CONFIRM: manager name and contact]'}
`;
}
