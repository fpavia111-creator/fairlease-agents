// Capital projects against budget, commitments, schedule and reserve balances. Pure functions.
import { r2, num, str, isoDate, daysBetween, foldText } from 'keystone-core';

export const CAPEX_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    tolerance_pct: { type: 'number', minimum: 0, maximum: 100 },
    ahead_pct: { type: 'number', minimum: 0, maximum: 100 },
    stalled_days: { type: 'integer', minimum: 1, maximum: 730 },
    capitalize_min: { type: 'number', minimum: 0 },
    committed_includes_spent: { type: 'boolean' },
    reserves: { type: 'object', additionalProperties: { type: 'number' } },
  },
});

const DONE = /^(complete|completed|done|closed|finished|abgeschlossen|fertig|erledigt|terminé|termine|clos|achevé|completado|terminado|cerrado|concluído|concluido|finalizado|completato|concluso|chiuso|完了|竣工|已完成|完成|完工|关闭|완료|준공)$/i;
// A status that starts with a done word ("Complete - punch list", "Closed out") is done; "Complete by March" is not.
const DONE_START = /^(complete|completed|done|closed|finished)\b(?!\s*(by|in|on|est|date|due)\b)/i;
const ON_HOLD = /^(on hold|hold|paused|deferred|postponed|suspended|pausiert|zurückgestellt|en attente|suspendu|en espera|pausado|suspendido|em espera|sospeso|in attesa|保留|暂停|搁置|보류)\b/i;
const CANCELLED = /^(cancel+ed|void|storniert|abgesagt|annulé|cancelado|anulado|annullato|中止|取消|已取消|취소)$/i;
const fund = (s) => str(s) || 'unassigned';

export function checkCapex({ rows, policy = {}, asOf }) {
  const tol = policy.tolerance_pct ?? 5; const ahead = policy.ahead_pct ?? 25; const stalledDays = policy.stalled_days ?? 60;
  const byKey = new Map();
  for (const r of rows || []) {
    const name = str(r.project); if (!name) continue; const k = `${foldText(str(r.property)).toLowerCase()}|${str(r.project_id) || foldText(name).toLowerCase()}`;
    const e = byKey.get(k) || { project: name, project_id: str(r.project_id), property: str(r.property), category: str(r.category), status: '', funding: '', start: null, finish: null, budget: null, budgets: [], committed: 0, spent: 0, rows: 0 };
    e.rows++; for (const f of ['category', 'status', 'funding']) if (!e[f] && str(r[f])) e[f] = str(r[f]);
    if (!e.start && isoDate(r.start)) e.start = isoDate(r.start); if (!e.finish && isoDate(r.finish)) e.finish = isoDate(r.finish);
    if (num(r.budget) !== null) { e.budget = r2((e.budget || 0) + num(r.budget)); e.budgets.push(num(r.budget)); } e.committed = r2(e.committed + (num(r.committed) || 0)); e.spent = r2(e.spent + (num(r.spent) || 0));
    byKey.set(k, e);
  }
  const items = []; const needs = {}; const unbudgeted = {};
  for (const p of byKey.values()) {
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const st = p.status.trim(); const done = DONE.test(st) || DONE_START.test(st); const cancelled = CANCELLED.test(st); const held = !done && !cancelled && ON_HOLD.test(st); const idle = cancelled || held;
    const forecast = policy.committed_includes_spent ? r2(Math.max(p.spent, p.committed)) : r2(p.spent + p.committed); const remaining = p.budget === null ? null : r2(p.budget - p.spent);
    if (p.budget === null || p.budget === 0) add('no_budget', `No approved budget, ${p.spent} spent and ${p.committed} committed.`);
    else {
      const over = r2(p.spent - p.budget); const rawPct = (over / p.budget) * 100; const overPct = r2(rawPct);
      if (over > 0 && rawPct > tol) add('over_budget', `Spent ${p.spent} against a budget of ${p.budget}: ${over} (${overPct}%) over.`, { amount: over });
      else if (!done && forecast - p.budget > 0 && ((forecast - p.budget) / p.budget) * 100 > tol) add('forecast_over', `${policy.committed_includes_spent ? `Committed ${p.committed} (spending included)` : `Spent ${p.spent} plus open commitments ${p.committed}`} is ${forecast}, ${r2(forecast - p.budget)} (${r2(((forecast - p.budget) / p.budget) * 100)}%) over the ${p.budget} budget.`, { amount: r2(forecast - p.budget) });
      if (!done && !idle && p.start && p.finish && p.start < asOf && p.finish > asOf && p.spent > 0) {
        const timePct = (daysBetween(p.start, asOf) / Math.max(1, daysBetween(p.start, p.finish))) * 100; const spentPct = (p.spent / p.budget) * 100;
        if (spentPct - timePct > ahead) add('spending_ahead', `${r2(spentPct)}% of the budget spent with ${r2(timePct)}% of the schedule gone.`, { severity: 'soon' });
      }
    }
    if (held) add('on_hold', `Status is "${p.status}": not checked against its dates, and its remaining budget still counts against the reserve.`, { severity: 'note' });
    if (p.budgets.length > 1 && new Set(p.budgets).size === 1 && p.budgets[0] > 0) add('budget_repeated', `The budget ${p.budgets[0]} appears on ${p.budgets.length} lines and was added up to ${p.budget}. If your export repeats the project budget on every line, keep it on one line only.`, { severity: 'note' });
    if (!done && !idle && p.finish && p.finish < asOf) add('past_finish', `Planned finish ${p.finish} passed ${daysBetween(p.finish, asOf)} days ago and the status is "${p.status || 'blank'}".`);
    if (!done && !idle && p.start && daysBetween(p.start, asOf) > stalledDays && p.spent === 0 && p.committed === 0) add('not_started', `Planned start ${p.start}, ${daysBetween(p.start, asOf)} days ago, with nothing spent or committed.`);
    if (done && p.committed > 0) add('open_commitments_after_completion', `Marked "${p.status}" with ${p.committed} still committed; close or release the commitments.`, { amount: p.committed });
    if (policy.capitalize_min !== undefined && p.budget !== null && Math.max(p.budget, p.spent) < policy.capitalize_min) add('below_capitalization_threshold', `Budget and spend are below your capitalization threshold of ${policy.capitalize_min}; your accountant may treat this as an expense.`, { severity: 'note' });
    if (!done && !cancelled && (p.budget === null || p.budget === 0)) unbudgeted[fund(p.funding)] = (unbudgeted[fund(p.funding)] || 0) + 1;
    if (!done && !cancelled && remaining !== null && remaining > 0) needs[fund(p.funding)] = r2((needs[fund(p.funding)] || 0) + remaining);
    const hard = findings.filter((f) => !f.severity);
    items.push({ project: p.project, project_id: p.project_id, property: p.property, category: p.category, status: p.status, funding: fund(p.funding), start: p.start, finish: p.finish, budget: p.budget, committed: p.committed, spent: p.spent, forecast, remaining, state: hard.length ? 'issue' : findings.some((f) => f.severity === 'soon') ? 'watch' : 'ok', findings });
  }
  const reserves = []; const res = policy.reserves || {};
  for (const f of new Set([...Object.keys(needs), ...Object.keys(res), ...Object.keys(unbudgeted)])) {
    const balance = res[f] ?? null; const need = needs[f] || 0; const nb = unbudgeted[f] ? ` ${unbudgeted[f]} open project(s) with no budget are not counted.` : '';
    reserves.push({ funding: f, balance, remaining_budgets: need, short: balance === null ? null : r2(Math.max(0, need - balance)), detail: (balance === null ? `Remaining budgets of ${need} have no reserve balance in your policy.` : need > balance ? `Remaining budgets ${need} exceed the ${f} balance ${balance} by ${r2(need - balance)}.` : `Balance ${balance} covers remaining budgets ${need}.`) + nb });
  }
  const rank = { issue: 0, watch: 1, ok: 2 };
  items.sort((a, b) => rank[a.state] - rank[b.state] || String(a.project_id || a.project).localeCompare(String(b.project_id || b.project), undefined, { numeric: true }));
  const t = (k) => r2(items.reduce((s, i) => s + (i[k] || 0), 0));
  const short = reserves.filter((r) => r.short > 0);
  const summary = `${items.length} project(s) as of ${asOf}: budget ${t('budget')}, spent ${t('spent')}, committed ${t('committed')}. ${items.filter((i) => i.state === 'issue').length} need attention (${items.filter((i) => i.findings.some((f) => f.code === 'over_budget')).length} over budget, ${items.filter((i) => i.findings.some((f) => f.code === 'forecast_over')).length} heading over, ${items.filter((i) => i.findings.some((f) => f.code === 'past_finish')).length} past their finish date).${short.length ? ` Reserve short: ${short.map((r) => `${r.funding} by ${r.short}`).join('; ')}.` : ''}`;
  return { summary, as_of: asOf, reserves, items };
}

/** Budget change request to the owner for one project. */
export function changeRequestText(it, a = {}) {
  const over = it.findings.filter((f) => ['over_budget', 'forecast_over', 'no_budget'].includes(f.code));
  return `**To:** ${a.to || '[TO CONFIRM: owner or asset manager]'}

# Budget change request: ${it.project}${it.project_id ? ` (${it.project_id})` : ''}

Property: ${it.property || '[TO CONFIRM: property]'}
Funding: ${it.funding}

| | Amount |
|---|---:|
| Approved budget | ${it.budget ?? '[none]'} |
| Spent to date | ${it.spent} |
| Open commitments | ${it.committed} |
| Spent plus committed | ${it.forecast} |
| Requested new budget | ${a.new_budget ?? '[TO CONFIRM: amount]'} |

${over.map((f) => `- ${f.detail}`).join('\n')}

Reason: ${a.reason || '[TO CONFIRM: why the cost changed, with bids or change orders attached]'}

Please approve or decline in writing${a.reply_by ? ` by ${a.reply_by}` : ''}. No further commitments will be made on this project above the approved budget until then.

${a.from || '[TO CONFIRM: name and contact]'}
`;
}
