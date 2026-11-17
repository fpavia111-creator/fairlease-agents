// Leasing funnel from guest cards and lead exports: speed to respond, follow-ups, conversion and cost by source. Pure functions.
// Mica never screens, approves or denies anyone; it reads dates and statuses only.
import { r2, num, str, isoDate, addDays, daysBetween, foldText, partyKey } from 'keystone-core';

const D = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
export const LEAD_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    respond_within_days: { type: 'integer', minimum: 0, maximum: 14 },
    follow_up_days: { type: 'integer', minimum: 1, maximum: 60 },
    stale_days: { type: 'integer', minimum: 1, maximum: 365 },
    approved_days: { type: 'integer', minimum: 1, maximum: 60 },
    duplicate_days: { type: 'integer', minimum: 0, maximum: 365 },
    spend: { type: 'object', maxProperties: 100, additionalProperties: { type: 'number', minimum: 0 } },
    source_aliases: { type: 'object', maxProperties: 500, additionalProperties: { type: 'string', minLength: 1, maxLength: 100 } },
    from: D, to: D,
  },
});

const fold = (s) => foldText(str(s)).toLowerCase();
const LOST = /(lost|inactive|closed|denied|declined|cancel|dead|archiv|not interested|perdid|verloren|abgesagt|perdu|annul|perso|chiuso|失注|キャンセル|流失|已关闭|이탈|취소)/;
const NOREASON = /^(|none|n\/a|na|-|unknown|other)$/;
const normPhone = (v) => str(v).replace(/\D/g, '').slice(-10);
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : r2((s[m - 1] + s[m]) / 2); };

export function sourceName(raw, policy = {}, learned = {}) {
  const s = str(raw) || 'Unknown'; const f = fold(s);
  for (const [a, c] of Object.entries({ ...(policy.source_aliases || {}), ...learned })) if (fold(a) === f) return c;
  return s;
}

export function checkLeads({ leads, policy = {}, asOf, learned = {} }) {
  const within = policy.respond_within_days ?? 1; const follow = policy.follow_up_days ?? 3; const stale = policy.stale_days ?? 30; const apprDays = policy.approved_days ?? 7; const dupDays = policy.duplicate_days ?? 30;
  const rows = leads.map((l) => ({ id: str(l.lead_id), name: str(l.name), email: str(l.email).trim().toLowerCase(), phone: normPhone(l.phone), property: str(l.property), source: sourceName(l.source, policy, learned), raw_source: str(l.source), unit_type: str(l.unit_type), created: isoDate(l.created), first_response: isoDate(l.first_response), toured: isoDate(l.toured), applied: isoDate(l.applied), approved: isoDate(l.approved), leased: isoDate(l.leased), status: str(l.status), lost_reason: str(l.lost_reason) }))
    .filter((l) => l.id && (!policy.from || !l.created || l.created >= policy.from) && (!policy.to || !l.created || l.created <= policy.to))
    .sort((a, b) => String(a.created).localeCompare(String(b.created)) || a.id.localeCompare(b.id));
  // Earlier leads by email, phone and name, so a duplicate is found without comparing every pair (large exports).
  const seen = { email: new Map(), phone: new Map(), name: new Map() };
  const keysOf = (l) => [['email', l.email || null], ['phone', l.phone && l.phone.length >= 7 ? l.phone : null], ['name', l.name ? partyKey(l.name) || null : null]];
  const priorOf = (l, i) => {
    if (!l.created) return null; const from = addDays(l.created, -dupDays); let best = null;
    for (const [kind, k] of keysOf(l)) {
      const list = k && seen[kind].get(k); if (!list) continue;
      let lo = 0, hi = list.length; while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].row.created < from) lo = m + 1; else hi = m; }
      if (lo < list.length && list[lo].i < i && (!best || list[lo].i < best.i)) best = list[lo];
    }
    return best ? best.row : null;
  };
  const remember = (l, i) => { if (!l.created) return; for (const [kind, k] of keysOf(l)) if (k) { if (!seen[kind].has(k)) seen[kind].set(k, []); seen[kind].get(k).push({ i, row: l }); } };
  const items = [];
  for (const [i, l] of rows.entries()) {
    const findings = []; const add = (code, detail) => findings.push({ code, detail });
    const lost = LOST.test(fold(l.status)); const open = !l.leased && !lost;
    l.open = open; l.lost = lost;
    if (!l.created) add('created_unknown', 'No date the lead came in.');
    const steps = [['first response', l.first_response], ['tour', l.toured], ['application', l.applied], ['approval', l.approved], ['lease', l.leased]];
    const early = l.created ? steps.filter(([, d]) => d && d < l.created).map(([n]) => n) : [];
    if (early.length) add('dates_out_of_order', `${early.join(', ')} dated before the lead came in (${l.created}).`);
    if (l.leased && l.applied && l.leased < l.applied) add('dates_out_of_order', `Lease ${l.leased} is before the application ${l.applied}.`);
    if (l.created && l.first_response) { l.response_days = daysBetween(l.created, l.first_response); if (l.response_days > within) add('slow_response', `First response ${l.first_response}, ${l.response_days} day(s) after the lead came in (${l.created}); your target is ${within}.`); }
    else if (l.created && !l.first_response && open && addDays(l.created, within) < asOf) add('no_response', `Came in ${l.created} (${daysBetween(l.created, asOf)} days ago) and no response is recorded.`);
    // Duplicates: same email, phone or name within duplicate_days of an earlier lead.
    const prior = priorOf(l, i); remember(l, i);
    if (prior) { l.duplicate_of = prior.id; add('duplicate', `Same person as lead ${prior.id} (${prior.source}, ${prior.created}); counted once in the source table.`); }
    const last = [l.created, l.first_response, l.toured, l.applied, l.approved].filter(Boolean).sort().at(-1);
    if (open && l.approved && !l.leased && addDays(l.approved, apprDays) < asOf) add('approved_not_leased', `Approved ${l.approved}, ${daysBetween(l.approved, asOf)} days ago, and no lease signed.`);
    else if (open && l.created && addDays(l.created, stale) < asOf && !prior) add('stale_open', `Open ${daysBetween(l.created, asOf)} days; follow up or close it with a reason.`);
    else if (open && last && l.first_response && addDays(last, follow) < asOf && !prior) add('follow_up_due', `Last step ${last}${l.toured ? ` (toured ${l.toured})` : ''}; nothing since, ${daysBetween(last, asOf)} days.`);
    if (lost && NOREASON.test(fold(l.lost_reason))) add('lost_reason_missing', 'Closed as lost with no reason recorded.');
    if (!findings.length) continue;
    const pri = { no_response: 0, approved_not_leased: 1, follow_up_due: 2, slow_response: 3, stale_open: 4, duplicate: 5 };
    const top = Math.min(...findings.map((f) => pri[f.code] ?? 6));
    items.push({ id: l.id, name: l.name, email: l.email || null, property: l.property || null, source: l.source, created: l.created, last_step: last || null, stage: l.leased ? 'leased' : lost ? 'lost' : l.approved ? 'approved' : l.applied ? 'applied' : l.toured ? 'toured' : l.first_response ? 'contacted' : 'new', status: open && top <= 2 ? 'action' : 'review', priority: top, findings });
  }
  items.sort((a, b) => (a.status === b.status ? 0 : a.status === 'action' ? -1 : 1) || a.priority - b.priority || String(a.created).localeCompare(String(b.created)));
  // Funnel by source, counting each person once.
  const uniq = rows.filter((l) => !l.duplicate_of); const bySrc = new Map();
  for (const l of uniq) { if (!bySrc.has(l.source)) bySrc.set(l.source, []); bySrc.get(l.source).push(l); }
  const spend = policy.spend || {};
  const sources = [...bySrc.entries()].map(([source, ls]) => {
    const judged = ls.filter((l) => l.response_days !== undefined || (l.created && addDays(l.created, within) < asOf));
    const onTime = judged.filter((l) => l.response_days !== undefined && l.response_days <= within).length;
    const leases = ls.filter((l) => l.leased).length; const cost = Object.entries(spend).find(([k]) => fold(k) === fold(source));
    return { source, count: ls.length, on_time_pct: judged.length ? r2((onTime / judged.length) * 100) : null, response_days: median(ls.filter((l) => l.response_days !== undefined).map((l) => l.response_days)), tours: ls.filter((l) => l.toured).length, applications: ls.filter((l) => l.applied).length, leases, conversion_pct: ls.length ? r2((leases / ls.length) * 100) : null, spend: cost ? cost[1] : null, cost_per_lease: cost && leases ? r2(cost[1] / leases) : null };
  }).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
  for (const [k, v] of Object.entries(spend)) if (!sources.some((s) => fold(s.source) === fold(k)) && v > 0) sources.push({ source: k, count: 0, on_time_pct: null, response_days: null, tours: 0, applications: 0, leases: 0, conversion_pct: null, spend: v, cost_per_lease: null, note: 'spend with no leads' });
  const reasons = {}; for (const l of uniq.filter((x) => x.lost)) { const k = str(l.lost_reason) || 'No reason recorded'; reasons[k] = (reasons[k] || 0) + 1; }
  const lost_reasons = Object.entries(reasons).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
  const n = (code) => items.filter((i) => i.findings.some((f) => f.code === code)).length;
  const totalLeases = uniq.filter((l) => l.leased).length;
  const judgedAll = uniq.filter((l) => l.response_days !== undefined || (l.created && addDays(l.created, within) < asOf));
  const onTimeAll = judgedAll.filter((l) => l.response_days !== undefined && l.response_days <= within).length;
  const summary = `${uniq.length} lead(s)${rows.length > uniq.length ? ` (${rows.length - uniq.length} duplicate(s) set aside)` : ''}: ${uniq.filter((l) => l.toured).length} toured, ${uniq.filter((l) => l.applied).length} applied, ${totalLeases} leased (${uniq.length ? r2((totalLeases / uniq.length) * 100) : 0}%). ${judgedAll.length ? r2((onTimeAll / judgedAll.length) * 100) : 0}% answered within ${within} day(s). To act on: ${n('no_response')} with no response, ${n('approved_not_leased')} approved with no lease, ${n('follow_up_due')} follow-up(s) due. ${n('stale_open')} stale open lead(s).${sources.some((s) => s.note) ? ` ${sources.filter((s) => s.note).map((s) => s.source).join(', ')}: spend with no leads.` : ''}`;
  return { summary, as_of: asOf, sources, lost_reasons, items };
}

/** Follow-up message to a prospect, for a person to review and send. */
export function followUpText(it, a = {}) {
  const next = it.stage === 'approved' ? 'Your application is approved. The next step is signing your lease; [TO CONFIRM: how and when to sign].' : it.stage === 'toured' || it.stage === 'applied' ? 'If you have any questions after your visit, we are happy to help. [TO CONFIRM: application link or next step].' : 'We would be glad to show you the home. [TO CONFIRM: tour times or booking link].';
  return `**To:** ${a.to || it.email || '[TO CONFIRM: prospect email or phone]'}

Hello ${it.name || '[TO CONFIRM: name]'},

Thank you for your interest in ${a.property || it.property || '[TO CONFIRM: property]'}. ${next}

${a.offer || ''}${a.offer ? '\n\n' : ''}${a.from || '[TO CONFIRM: your name, phone and office hours]'}

[TO CONFIRM: opt-out line if this goes by text]
`;
}
