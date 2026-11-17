// Budget against actual by account, for the month and the year to date, with the variance thresholds of your management agreement. Pure functions.
import { r2, str, monthlyByAccount } from 'keystone-core';

export const BUDGET_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    month: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
    fiscal_start_month: { type: 'integer', minimum: 1, maximum: 12 },
    threshold_pct: { type: 'number', minimum: 0, maximum: 1000 },
    threshold_amount: { type: 'number', minimum: 0 },
    basis: { type: 'string', enum: ['ptd', 'ytd', 'both'] },
    explain: { type: 'string', enum: ['unfavorable', 'both'] },
    income_prefixes: { type: 'array', items: { type: 'string', minLength: 1 }, maxItems: 20 },
    expense_prefixes: { type: 'array', items: { type: 'string', minLength: 1 }, maxItems: 20 },
    explanations: { type: 'object', additionalProperties: { type: 'string', maxLength: 2000 } },
  },
});

const months = (from, to) => { const out = []; let [y, m] = from.split('-').map(Number); const [ty, tm] = to.split('-').map(Number); while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out; };
const sumOf = (mo, keys) => r2(keys.reduce((s, k) => s + (mo[k] || 0), 0));
const has = (mo, keys) => keys.some((k) => mo[k] !== undefined && mo[k] !== null);

/**
 * budgetRows: budget by account and month (wide or long; long rows may carry `actual` too).
 * actualRows: optional actuals by account and month (wide T-12 or GL detail); when absent, `actual` on the budget rows is used.
 */
export function checkBudget({ budgetRows, actualRows = null, policy = {}, asOf }) {
  const month = policy.month || asOf.slice(0, 7); const fsm = policy.fiscal_start_month ?? 1;
  const [y, m] = month.split('-').map(Number); const fy = m >= fsm ? y : y - 1;
  const ytdKeys = months(`${fy}-${String(fsm).padStart(2, '0')}`, month); const yearKeys = months(ytdKeys[0], `${fsm === 1 ? fy : fy + 1}-${String(fsm === 1 ? 12 : fsm - 1).padStart(2, '0')}`);
  const pct = policy.threshold_pct ?? 10; const amt = policy.threshold_amount ?? 1000; const basis = policy.basis || 'both'; const explainBoth = (policy.explain || 'both') === 'both';
  const incP = policy.income_prefixes || ['4']; const expP = policy.expense_prefixes || ['5', '6', '7', '8'];
  const kind = (a) => (incP.some((p) => a.startsWith(p)) ? 'income' : expP.some((p) => a.startsWith(p)) ? 'expense' : null);
  const bud = new Map(monthlyByAccount(budgetRows, { value: 'budget' }).map((a) => [a.account, a]));
  const act = new Map(monthlyByAccount(actualRows || budgetRows, { value: actualRows ? 'amount' : 'actual', natural: (x) => (kind(x) === 'expense' ? 'debit' : 'credit') }).map((a) => [a.account, a]));
  const items = []; const expl = policy.explanations || {}; const unclassified = [];
  // A month with no actual on any account has not been closed (or is the wrong month): comparing it would report every line as under budget.
  const monthHasActuals = [...act.values()].some((a) => a.months[month] !== undefined && a.months[month] !== null && a.months[month] !== '');
  for (const acct of [...new Set([...bud.keys(), ...act.keys()])]) {
    const k = kind(acct);
    const b = bud.get(acct); const a = act.get(acct); const name = (b && b.name) || (a && a.name) || '';
    if (!k) { unclassified.push({ account: acct, name }); continue; }
    const bm = b ? b.months : {}; const am = a ? a.months : {};
    const line = { account: acct, name, kind: k, ptd_budget: sumOf(bm, [month]), ptd_actual: sumOf(am, [month]), ytd_budget: sumOf(bm, ytdKeys), ytd_actual: sumOf(am, ytdKeys), annual_budget: sumOf(bm, yearKeys) };
    line.ptd_variance = r2(line.ptd_actual - line.ptd_budget); line.ytd_variance = r2(line.ytd_actual - line.ytd_budget);
    line.ptd_variance_pct = line.ptd_budget ? r2((line.ptd_variance / Math.abs(line.ptd_budget)) * 100) : null; line.ytd_variance_pct = line.ytd_budget ? r2((line.ytd_variance / Math.abs(line.ytd_budget)) * 100) : null;
    const remaining = yearKeys.filter((x) => x > month); line.forecast = r2(line.ytd_actual + sumOf(bm, remaining));
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const fav = (v) => (k === 'income' ? v > 0 : v < 0);
    const test = (label, v, p, bAmt) => {
      if (!bAmt && !v) return;
      // Compared before rounding: 10.0001% is over a 10% threshold.
      if (Math.abs(v) <= amt || (bAmt && (Math.abs(v) / Math.abs(bAmt)) * 100 <= pct)) return;
      if (!explainBoth && fav(v)) return;
      add(`${label}_variance`, `${label === 'ptd' ? 'Month' : 'Year to date'}: ${k} ${v > 0 ? 'over' : 'under'} budget by ${Math.abs(v)}${p !== null ? ` (${Math.abs(p)}%)` : ''}: actual ${label === 'ptd' ? line.ptd_actual : line.ytd_actual}, budget ${bAmt}; ${fav(v) ? 'favorable' : 'unfavorable'}. Over your ${pct}% and ${amt} thresholds.`, { amount: v, favorable: fav(v) });
    };
    if (!b || (!has(bm, yearKeys) && line.annual_budget === 0)) { if (line.ytd_actual) add('unbudgeted', `${line.ytd_actual} ${k === 'income' ? 'received' : 'spent'} year to date on an account with no budget.`, k === 'income' ? { severity: 'note' } : {}); }
    else if (monthHasActuals) {
      if (basis !== 'ytd') test('ptd', line.ptd_variance, line.ptd_variance_pct, line.ptd_budget);
      if (basis !== 'ptd') test('ytd', line.ytd_variance, line.ytd_variance_pct, line.ytd_budget);
      if (k === 'expense' && line.annual_budget && line.forecast - line.annual_budget > amt && ((line.forecast - line.annual_budget) / line.annual_budget) * 100 > pct) add('forecast_over_annual', `Year to date ${line.ytd_actual} plus the remaining months' budget makes ${line.forecast}, ${r2(line.forecast - line.annual_budget)} over the annual budget ${line.annual_budget}.`, { amount: r2(line.forecast - line.annual_budget) });
      if (k === 'expense' && line.ytd_budget >= amt && line.ytd_actual === 0 && !has(am, ytdKeys)) add('budget_unused', `Budgeted ${line.ytd_budget} year to date and nothing recorded.`, { severity: 'note' });
    }
    const needs = findings.filter((f) => /_variance$/.test(f.code) || f.code === 'unbudgeted' && !f.severity);
    const given = str(expl[acct]);
    if (needs.length && given) { line.explanation = given; findings.push({ code: 'explained', detail: `Explanation on file: ${given}`, severity: 'note' }); }
    const hard = findings.filter((f) => !f.severity);
    line.status = hard.length && !given ? 'explain' : hard.length ? 'explained' : findings.length ? 'note' : 'ok';
    line.findings = findings; items.push(line);
  }
  const rank = { explain: 0, explained: 1, note: 2, ok: 3 };
  items.sort((a, b) => rank[a.status] - rank[b.status] || a.account.localeCompare(b.account, undefined, { numeric: true }));
  const tot = (kd, f) => r2(items.filter((i) => i.kind === kd).reduce((s, i) => s + i[f], 0));
  const noi = { ptd_budget: r2(tot('income', 'ptd_budget') - tot('expense', 'ptd_budget')), ptd_actual: r2(tot('income', 'ptd_actual') - tot('expense', 'ptd_actual')), ytd_budget: r2(tot('income', 'ytd_budget') - tot('expense', 'ytd_budget')), ytd_actual: r2(tot('income', 'ytd_actual') - tot('expense', 'ytd_actual')) };
  const left = unclassified.length ? ` ${unclassified.length} account(s) were left out because they start with neither an income prefix (${incP.join(', ')}) nor an expense prefix (${expP.join(', ')}): ${unclassified.slice(0, 5).map((u) => u.account).join(', ')}${unclassified.length > 5 ? ` and ${unclassified.length - 5} more` : ''}. Set income_prefixes and expense_prefixes in your policy.` : '';
  if (!monthHasActuals) return { summary: `No actuals for ${month} on any account, so nothing was compared: the month may not be closed, or the month or the file is wrong.${left}`, month, month_has_actuals: false, ytd_from: ytdKeys[0], thresholds: { pct, amount: amt, basis, explain: explainBoth ? 'both' : 'unfavorable' }, noi, unclassified_accounts: unclassified, items };
  const summary = `${month} (year to date from ${ytdKeys[0]}): NOI ${noi.ptd_actual} against a budget of ${noi.ptd_budget} for the month, ${noi.ytd_actual} against ${noi.ytd_budget} year to date. ${items.filter((i) => i.status === 'explain').length} account(s) need a variance explanation under your ${pct}% and ${amt} thresholds${items.some((i) => i.status === 'explained') ? `, ${items.filter((i) => i.status === 'explained').length} already explained` : ''}.${left}`;
  return { summary, month, month_has_actuals: true, ytd_from: ytdKeys[0], thresholds: { pct, amount: amt, basis, explain: explainBoth ? 'both' : 'unfavorable' }, noi, unclassified_accounts: unclassified, items };
}

/** Variance memo for the owner. */
export function memoText(r, a = {}) {
  const lines = r.items.filter((i) => i.status === 'explain' || i.status === 'explained');
  const row = (i) => `| ${i.account} ${i.name} | ${i.ptd_actual} | ${i.ptd_budget} | ${i.ptd_variance} | ${i.ytd_actual} | ${i.ytd_budget} | ${i.ytd_variance} |`;
  return `**To:** ${a.to || '[TO CONFIRM: owner]'}

# Budget variance report: ${a.property || '[TO CONFIRM: property]'}, ${r.month}

Net operating income: ${r.noi.ptd_actual} for the month against a budget of ${r.noi.ptd_budget}; ${r.noi.ytd_actual} year to date against ${r.noi.ytd_budget}.

| Account | Month actual | Month budget | Variance | YTD actual | YTD budget | Variance |
|---|---:|---:|---:|---:|---:|---:|
${lines.map(row).join('\n') || '| No variances over the thresholds | | | | | | |'}

${lines.map((i) => `**${i.account} ${i.name}.** ${i.explanation || '[TO CONFIRM: explanation of the variance]'}`).join('\n\n')}

Variances shown are those over ${r.thresholds.pct}% and ${r.thresholds.amount}.

${a.from || '[TO CONFIRM: manager name and contact]'}
`;
}
