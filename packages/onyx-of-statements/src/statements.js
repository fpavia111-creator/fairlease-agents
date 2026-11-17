// Owner statements checked before they go out. Pure functions.
import { r2, num, str, isoDate, periodKey, sameParty, foldText } from 'keystone-core';

export const STATEMENT_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    reserves: { type: 'object', additionalProperties: { type: 'number', minimum: 0 } },
    default_reserve: { type: 'number', minimum: 0 },
    distribution_min: { type: 'number', minimum: 0 },
    tolerance: { type: 'number', minimum: 0, maximum: 100 },
    fee_in_expenses: { type: 'boolean' },
    period: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
  },
});

const k = (s) => foldText(str(s)).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function checkStatements({ rows, ledgerRows = null, policy = {} }) {
  const tol = policy.tolerance ?? 1; const feeIn = !!policy.fee_in_expenses; const dmin = policy.distribution_min ?? 0;
  const stmts = (rows || []).map((r) => ({ owner: str(r.owner), property: str(r.property), period: periodKey(r.period), begin: num(r.beginning_balance), income: num(r.income) ?? 0, expenses: num(r.expenses) ?? 0, fee: num(r.management_fee) ?? 0, draw: num(r.owner_draw) ?? 0, reserve: num(r.reserve), end: num(r.ending_balance) })).filter((s) => s.owner && s.period);
  const key = (s) => `${k(s.owner)}|${k(s.property)}`;
  const byKey = new Map(); for (const s of stmts) { if (!byKey.has(key(s))) byKey.set(key(s), []); byKey.get(key(s)).push(s); }
  const latest = policy.period || [...new Set(stmts.map((s) => s.period))].sort().pop();
  const reserveFor = (s) => { const r = policy.reserves || {}; const hit = Object.keys(r).find((p) => k(p) === k(s.property)); return hit !== undefined ? r[hit] : policy.default_reserve ?? s.reserve ?? 0; };
  const led = ledgerRows ? ledgerRows.map((r) => ({ owner: str(r.owner), property: str(r.property), period: isoDate(r.date) ? isoDate(r.date).slice(0, 7) : periodKey(r.period), type: str(r.type), income: num(r.income), expense: num(r.expense), amount: num(r.amount), text: `${str(r.type)} ${str(r.description)} ${str(r.account)}` })) : null;
  const items = [];
  for (const list of byKey.values()) {
    list.sort((a, b) => a.period.localeCompare(b.period));
    list.forEach((s, idx) => {
      const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
      const prev = list[idx - 1];
      const calc = s.begin === null ? null : r2(s.begin + s.income - s.expenses - (feeIn ? 0 : s.fee) - s.draw);
      if (calc !== null && s.end !== null && Math.abs(calc - s.end) > tol) add('math_error', `Beginning ${s.begin} + income ${s.income} − expenses ${s.expenses}${feeIn ? '' : ` − fee ${s.fee}`} − distribution ${s.draw} = ${calc}, but the statement shows ${s.end} (${r2(s.end - calc)}).`, { amount: r2(s.end - calc) });
      if (prev && prev.end !== null && s.begin !== null && Math.abs(prev.end - s.begin) > tol) add('beginning_differs', `Beginning ${s.begin} differs from ${prev.period}'s ending ${prev.end} (${r2(s.begin - prev.end)}).`, { amount: r2(s.begin - prev.end) });
      const reserve = reserveFor(s);
      if (s.end !== null && s.end < -tol) add('negative_balance', `Ending balance ${s.end}: the owner owes ${r2(-s.end + reserve)} to bring the account back to the ${reserve} reserve.`, { amount: r2(-s.end + reserve) });
      else if (s.end !== null && s.end + tol < reserve) add(s.draw > 0 ? 'distribution_below_reserve' : 'reserve_short', s.draw > 0 ? `Distributed ${s.draw} and left ${s.end}, below the ${reserve} reserve.` : `Ending ${s.end} is below the ${reserve} reserve.`, { amount: r2(reserve - s.end) });
      if (s.end !== null && s.draw <= 0 && s.end - reserve >= Math.max(dmin, tol) && dmin > 0) add('cash_not_distributed', `${r2(s.end - reserve)} above the reserve and no distribution this period.`, { severity: 'note' });
      if (s.draw < 0) add('owner_contribution', `Owner contributed ${-s.draw}.`, { severity: 'note' });
      if (led) {
        const mine = led.filter((l) => l.period === s.period && sameParty(l.owner, s.owner) && (!l.property || k(l.property) === k(s.property)));
        if (mine.length) {
          const isFee = (l) => /management fee|mgmt fee|verwaltung|honoraires|honorarios|administra|gestione|管理/i.test(l.text);
          const inc = r2(mine.reduce((t, l) => t + (l.income ?? (l.amount > 0 ? l.amount : 0)), 0));
          const exp = r2(mine.filter((l) => feeIn || !isFee(l)).reduce((t, l) => t + (l.expense ?? (l.amount < 0 ? -l.amount : 0)), 0));
          const fee = r2(mine.filter(isFee).reduce((t, l) => t + (l.expense ?? (l.amount < 0 ? -l.amount : 0)), 0));
          if (Math.abs(inc - s.income) > tol) add('income_differs', `Owner ledger income for ${s.period} is ${inc}; the statement shows ${s.income} (${r2(s.income - inc)}).`, { amount: r2(s.income - inc) });
          if (Math.abs(exp - s.expenses) > tol) add('expenses_differ', `Owner ledger expenses for ${s.period} are ${exp}; the statement shows ${s.expenses} (${r2(s.expenses - exp)}).`, { amount: r2(s.expenses - exp) });
          if (!feeIn && fee && Math.abs(fee - s.fee) > tol) add('fee_differs', `Owner ledger management fee for ${s.period} is ${fee}; the statement shows ${s.fee}.`, { amount: r2(s.fee - fee) });
        } else if (s.period === latest) add('no_ledger_detail', `No owner ledger lines for ${s.period}; totals not checked.`, { severity: 'note' });
      }
      const hard = findings.filter((f) => !f.severity);
      items.push({ owner: s.owner, property: s.property, period: s.period, beginning: s.begin, income: s.income, expenses: s.expenses, fee: s.fee, distribution: s.draw, reserve, ending: s.end, current: s.period === latest, status: hard.length ? 'issue' : findings.length ? 'note' : 'ok', findings });
    });
  }
  const rank = { issue: 0, note: 1, ok: 2 };
  items.sort((a, b) => (b.current - a.current) || rank[a.status] - rank[b.status] || a.owner.localeCompare(b.owner) || b.period.localeCompare(a.period));
  const cur = items.filter((i) => i.current);
  const summary = `${cur.length} statement(s) for ${latest}, ${items.length} in all: ${cur.filter((i) => i.status === 'issue').length} to fix before sending (${cur.filter((i) => i.findings.some((f) => f.code === 'math_error')).length} math, ${cur.filter((i) => i.findings.some((f) => f.code === 'beginning_differs')).length} beginning balance, ${cur.filter((i) => i.findings.some((f) => f.code === 'negative_balance')).length} negative, ${cur.filter((i) => i.findings.some((f) => /_differs?$/.test(f.code) && f.code !== 'beginning_differs')).length} not matching the ledger). Earlier periods: ${items.filter((i) => !i.current && i.status === 'issue').length} with issues.`;
  return { summary, period: latest, items };
}

/** Request to an owner to fund a negative balance or bring the reserve back up. */
export function contributionText(it, a = {}) {
  const f = it.findings.find((x) => ['negative_balance', 'reserve_short', 'distribution_below_reserve'].includes(x.code));
  return `**To:** ${a.to || `${it.owner} [TO CONFIRM: owner email]`}

# Owner contribution request: ${it.property}, ${it.period}

Your ${it.period} statement for ${it.property} ends at ${it.ending}. ${f ? f.detail : ''}

Amount requested: ${a.amount ?? f?.amount ?? '[TO CONFIRM: amount]'}
${a.reason ? `\nReason: ${a.reason}\n` : '\n[TO CONFIRM: what the shortfall paid for, for example repairs or a slow month]\n'}
Please send the funds by ${a.due || '[TO CONFIRM: date, as your management agreement allows]'} to ${a.pay_to || '[TO CONFIRM: payment instructions; confirm by phone before you share bank details]'}.

${a.from || '[TO CONFIRM: manager name and contact]'}
`;
}
