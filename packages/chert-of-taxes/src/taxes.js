// Property tax assessments, installments and the appeal deadlines you enter. Pure functions; no deadline is ever computed.
import { r2, num, str, isoDate, daysBetween, foldText } from 'keystone-core';

export const TAX_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    appeal_review_pct: { type: 'number', minimum: 0, maximum: 1000 },
    due_soon_days: { type: 'integer', minimum: 0, maximum: 180 },
    tolerance: { type: 'number', minimum: 0 },
    appeal_deadlines: { type: 'object', additionalProperties: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
  },
});

const pkey = (s) => foldText(str(s)).toLowerCase().replace(/[^a-z0-9]/g, '');

export function checkTaxes({ rows, policy = {}, asOf }) {
  const jump = policy.appeal_review_pct ?? 10; const soon = policy.due_soon_days ?? 30; const tol = policy.tolerance ?? 1;
  const groups = new Map();
  for (const r of rows || []) {
    const parcel = str(r.parcel) || str(r.property); if (!parcel) continue; const year = num(r.tax_year);
    const k = `${pkey(parcel)}|${year ?? ''}`;
    const g = groups.get(k) || { property: str(r.property), parcel, year, assessed: null, prior: null, appeal_deadline: null, notice_date: null, installments: [] };
    if (!g.property && str(r.property)) g.property = str(r.property);
    if (g.assessed === null && num(r.assessed_value) !== null) g.assessed = num(r.assessed_value);
    if (g.prior === null && num(r.prior_assessed_value) !== null) g.prior = num(r.prior_assessed_value);
    if (!g.appeal_deadline && isoDate(r.appeal_deadline)) g.appeal_deadline = isoDate(r.appeal_deadline);
    if (!g.notice_date && isoDate(r.notice_date)) g.notice_date = isoDate(r.notice_date);
    const due = isoDate(r.due_date); const amt = num(r.tax_amount);
    if (due || amt !== null) g.installments.push({ due, amount: amt, paid: num(r.paid) });
    groups.set(k, g);
  }
  // Prior assessed value from last year's row when the file has several years.
  for (const g of groups.values()) if (g.prior === null && g.year !== null) { const p = groups.get(`${pkey(g.parcel)}|${g.year - 1}`); if (p && p.assessed !== null) g.prior = p.assessed; }
  const latestYear = new Map(); for (const g of groups.values()) { const k = pkey(g.parcel); if (!latestYear.has(k) || (g.year ?? 0) > latestYear.get(k)) latestYear.set(k, g.year ?? 0); }
  const items = []; const events = [];
  for (const g of groups.values()) {
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const current = (g.year ?? 0) === latestYear.get(pkey(g.parcel));
    const deadline = (policy.appeal_deadlines || {})[g.parcel] || g.appeal_deadline || null;
    const change = g.assessed !== null && g.prior ? r2(((g.assessed - g.prior) / g.prior) * 100) : null;
    if (current) {
      if (change !== null && change > jump) {
        add('assessment_jump', `Assessed value ${g.assessed} is up ${change}% from ${g.prior}; review whether to appeal.`, { amount: r2(g.assessed - g.prior) });
        if (!deadline) add('appeal_deadline_unknown', 'No appeal deadline entered. Chert does not work deadlines out; copy it from the assessment notice or your tax advisor.');
      }
      if (deadline) {
        const left = daysBetween(asOf, deadline);
        if (left >= 0 && left <= soon) add('appeal_deadline_soon', `Appeal deadline you entered: ${deadline} (${left} days).`, { severity: 'soon' });
        else if (left < 0 && change !== null && change > jump) add('appeal_deadline_passed', `Appeal deadline you entered, ${deadline}, passed ${-left} days ago.`, { severity: 'note' });
        if (left >= 0) events.push({ date: deadline, summary: `Tax appeal deadline ${g.parcel}${g.property ? ` (${g.property})` : ''}`, description: `Deadline as entered in your file or policy${change !== null ? `; assessed value ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}%` : ''}. Confirm with the assessment notice.` });
      }
    }
    let billed = 0; let paidTotal = 0;
    for (const i of g.installments) {
      billed += i.amount || 0; paidTotal += i.paid || 0;
      if (!i.due || i.amount === null) continue;
      const left = daysBetween(asOf, i.due); const owed = r2(i.amount - (i.paid || 0));
      if (owed > tol && left < 0) add(i.paid ? 'installment_short' : 'installment_overdue', `Installment due ${i.due}: ${i.amount}${i.paid ? `, paid ${i.paid}` : ', nothing paid'}; ${owed} outstanding ${-left} days after the due date.`, { amount: owed });
      else if (owed > tol && left <= soon) add('installment_due_soon', `Installment of ${owed} due ${i.due} (${left} days).`, { severity: 'soon', amount: owed });
      else if (owed < -tol) add('installment_overpaid', `Installment due ${i.due}: ${i.amount}, paid ${i.paid}; ${-owed} more than billed.`, { amount: owed });
      if (owed > tol && left >= 0) events.push({ date: i.due, summary: `Property tax due ${g.parcel}: ${owed}`, description: `Installment of ${i.amount} for ${g.year ?? 'the tax year'}${g.property ? `, ${g.property}` : ''}. Confirm the amount on the bill.` });
    }
    const hard = findings.filter((f) => !f.severity);
    items.push({ property: g.property, parcel: g.parcel, year: g.year, assessed: g.assessed, prior: g.prior, change_pct: change, appeal_deadline: deadline, billed: r2(billed), paid: r2(paidTotal), outstanding: r2(billed - paidTotal), status: hard.length ? 'issue' : findings.some((f) => f.severity === 'soon') ? 'due_soon' : 'ok', findings });
  }
  const rank = { issue: 0, due_soon: 1, ok: 2 };
  items.sort((a, b) => rank[a.status] - rank[b.status] || String(a.parcel).localeCompare(String(b.parcel)) || (b.year ?? 0) - (a.year ?? 0));
  events.sort((a, b) => a.date.localeCompare(b.date));
  const c = (code) => items.filter((i) => i.findings.some((f) => f.code === code)).length;
  const overdue = r2(items.reduce((s, i) => s + i.findings.filter((f) => /^installment_(overdue|short)$/.test(f.code)).reduce((t, f) => t + f.amount, 0), 0));
  const summary = `${items.length} parcel-year(s) as of ${asOf}: billed ${r2(items.reduce((s, i) => s + i.billed, 0))}, paid ${r2(items.reduce((s, i) => s + i.paid, 0))}. ${c('assessment_jump')} assessment(s) up more than ${jump}% (${c('appeal_deadline_unknown')} with no appeal deadline entered), ${c('appeal_deadline_soon')} appeal deadline(s) within ${soon} days, ${overdue} past due on ${c('installment_overdue') + c('installment_short')} parcel(s), ${c('installment_due_soon')} with an installment due within ${soon} days.`;
  return { summary, as_of: asOf, events, items };
}
