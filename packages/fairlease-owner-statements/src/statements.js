// Owner statements checked before they go out. Pure functions.
import { r2, num, str, isoDate, periodKey, partyKey, foldText } from 'fairlease-core';

export const STATEMENT_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    reserves: { type: 'object', additionalProperties: { type: 'number', minimum: 0 } },
    default_reserve: { type: 'number', minimum: 0 },
    distribution_min: { type: 'number', minimum: 0 },
    tolerance: { type: 'number', minimum: 0, maximum: 100 },
    fee_in_expenses: { type: 'boolean' },
    fee_pct: { type: 'number', minimum: 0, maximum: 100 },
    period: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
  },
});

const KS = new Map();
const k = (s) => { const raw = str(s); let v = KS.get(raw); if (v === undefined) { v = foldText(raw).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); if (KS.size >= 100000) KS.clear(); KS.set(raw, v); } return v; };

const monthsApart = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
const nextMonth = (p) => { const y = Number(p.slice(0, 4)); const m = Number(p.slice(5, 7)); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };
const IS_DRAW = /owner draw|owner distribution|distribution|owner payment|owner contribution|contribution|capital call|ausschuttung|entnahme|einlage|distribution au proprietaire|apport|distribucion|aportacion|distribuicao|aporte|distribuzione|apporto|分配|出資|拠出|分红|注资|배당|출자/;

export function checkStatements({ rows, ledgerRows = null, policy = {} }) {
  const tol = policy.tolerance ?? 1; const feeIn = !!policy.fee_in_expenses; const dmin = policy.distribution_min ?? 0;
  const stmts = (rows || []).map((r) => ({ owner: str(r.owner), property: str(r.property), period: periodKey(r.period), begin: num(r.beginning_balance), income: num(r.income) ?? 0, expenses: num(r.expenses) ?? 0, fee: num(r.management_fee) ?? 0, draw: num(r.owner_draw) ?? 0, reserve: num(r.reserve), end: num(r.ending_balance) })).filter((s) => s.owner && s.period);
  const key = (s) => `${k(s.owner)}|${k(s.property)}`;
  const byKey = new Map(); for (const s of stmts) { if (!byKey.has(key(s))) byKey.set(key(s), []); byKey.get(key(s)).push(s); }
  const latest = policy.period || [...new Set(stmts.map((s) => s.period))].sort().pop();
  const reserveFor = (s) => { const r = policy.reserves || {}; const hit = Object.keys(r).find((p) => k(p) === k(s.property)); return hit !== undefined ? r[hit] : policy.default_reserve ?? s.reserve ?? 0; };
  const led = ledgerRows ? ledgerRows.map((r) => ({ owner: str(r.owner), property: str(r.property), period: isoDate(r.date) ? isoDate(r.date).slice(0, 7) : periodKey(r.period), type: str(r.type), income: num(r.income), expense: num(r.expense), amount: num(r.amount), text: `${str(r.type)} ${str(r.description)} ${str(r.account)}` })) : null;
  const ledIdx = new Map(); for (const l of led || []) { const pk = partyKey(l.owner); if (!pk) continue; const key2 = `${l.period}\u0000${pk}`; if (!ledIdx.has(key2)) ledIdx.set(key2, []); ledIdx.get(key2).push(l); }
  const items = [];
  for (const list of byKey.values()) {
    list.sort((a, b) => a.period.localeCompare(b.period));
    list.forEach((s, idx) => {
      const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
      const twice = list.filter((x) => x.period === s.period).length;
      if (twice > 1) add('duplicate_statement', `${twice} statements for ${s.period} in the file; keep one.`);
      let prev = list[idx - 1]; if (prev && prev.period === s.period) prev = null;
      if (prev && monthsApart(prev.period, s.period) > 1) {
        const gap = monthsApart(prev.period, s.period) - 1; let lastGap = prev.period; for (let n = gap; n > 0; n--) lastGap = nextMonth(lastGap);
        add('period_missing', `No statement for ${nextMonth(prev.period)}${gap > 1 ? ` to ${lastGap}` : ''} between ${prev.period} and this one, so the beginning balance is not checked against an earlier ending.`); prev = null;
      }
      // Some exports show money out as negative numbers. If the statement only adds up that way round, read it that way.
      if (s.expenses < 0 || s.fee < 0) {
        const fits = (e, f) => s.begin !== null && s.end !== null && Math.abs(r2(s.begin + s.income - e - (feeIn ? 0 : f) - s.draw) - s.end) <= tol;
        if (!fits(s.expenses, s.fee)) { s.expenses = Math.abs(s.expenses); s.fee = Math.abs(s.fee); }
      }
      const calc = s.begin === null ? null : r2(s.begin + s.income - s.expenses - (feeIn ? 0 : s.fee) - s.draw);
      if (calc !== null && s.end !== null && Math.abs(calc - s.end) > tol) add('math_error', `Beginning ${s.begin} + income ${s.income} − expenses ${s.expenses}${feeIn ? '' : ` − fee ${s.fee}`} − distribution ${s.draw} = ${calc}, but the statement shows ${s.end} (${r2(s.end - calc)}).`, { amount: r2(s.end - calc) });
      if (prev && prev.end !== null && s.begin !== null && Math.abs(prev.end - s.begin) > tol) add('beginning_differs', `Beginning ${s.begin} differs from ${prev.period}'s ending ${prev.end} (${r2(s.begin - prev.end)}).`, { amount: r2(s.begin - prev.end) });
      const reserve = reserveFor(s);
      if (s.end !== null && s.end < -tol) add('negative_balance', `Ending balance ${s.end}: the owner owes ${r2(-s.end + reserve)} to bring the account back to the ${reserve} reserve.`, { amount: r2(-s.end + reserve) });
      else if (s.end !== null && s.end + tol < reserve) add(s.draw > 0 ? 'distribution_below_reserve' : 'reserve_short', s.draw > 0 ? `Distributed ${s.draw} and left ${s.end}, below the ${reserve} reserve.` : `Ending ${s.end} is below the ${reserve} reserve.`, { amount: r2(reserve - s.end) });
      if (s.end !== null && s.draw <= 0 && s.end - reserve >= Math.max(dmin, tol) && dmin > 0) add('cash_not_distributed', `${r2(s.end - reserve)} above the reserve and no distribution this period.`, { severity: 'note' });
      if (policy.fee_pct !== undefined && s.income > 0 && s.fee) { const want = r2((s.income * policy.fee_pct) / 100); if (Math.abs(want - s.fee) > tol) add('fee_rate_differs', `Management fee ${s.fee} is ${r2((s.fee / s.income) * 100)}% of income ${s.income}; your rate is ${policy.fee_pct}% (${want}). A minimum fee or fees on other items can explain it.`, { amount: r2(s.fee - want) }); }
      if (s.draw < 0) add('owner_contribution', `Owner contributed ${-s.draw}.`, { severity: 'note' });
      if (led) {
        const pk = partyKey(s.owner); const mine = (pk ? ledIdx.get(`${s.period}\u0000${pk}`) || [] : []).filter((l) => !l.property || k(l.property) === k(s.property));
        if (mine.length) {
          const isFee = (l) => /management fee|mgmt fee|verwaltung|honoraires|honorarios|administra|gestione|管理/i.test(l.text);
          // Money to and from the owner is neither income nor an expense of the property.
          const isDraw = (l) => IS_DRAW.test(foldText(l.text).toLowerCase());
          const draws = mine.filter(isDraw); const ops = mine.filter((l) => !isDraw(l));
          const net = r2(draws.reduce((t, l) => t + (l.expense ?? (l.amount < 0 ? -l.amount : 0)) - (l.income ?? (l.amount > 0 ? l.amount : 0)), 0));
          if (draws.length && Math.abs(net - s.draw) > tol) add('distribution_differs', `Owner ledger shows ${net} paid to the owner in ${s.period} (distributions less contributions); the statement shows ${s.draw}.`, { amount: r2(s.draw - net) });
          const inc = r2(ops.reduce((t, l) => t + (l.income ?? (l.amount > 0 ? l.amount : 0)), 0));
          const exp = r2(ops.filter((l) => feeIn || !isFee(l)).reduce((t, l) => t + (l.expense ?? (l.amount < 0 ? -l.amount : 0)), 0));
          const fee = r2(ops.filter(isFee).reduce((t, l) => t + (l.expense ?? (l.amount < 0 ? -l.amount : 0)), 0));
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
  const summary = `${cur.length} statement(s) for ${latest}, ${items.length} in all: ${cur.filter((i) => i.status === 'issue').length} to fix before sending (${cur.filter((i) => i.findings.some((f) => f.code === 'math_error')).length} math, ${cur.filter((i) => i.findings.some((f) => f.code === 'beginning_differs')).length} beginning balance, ${cur.filter((i) => i.findings.some((f) => f.code === 'negative_balance')).length} negative, ${cur.filter((i) => i.findings.some((f) => ['income_differs', 'expenses_differ', 'fee_differs', 'distribution_differs'].includes(f.code))).length} not matching the ledger). Earlier periods: ${items.filter((i) => !i.current && i.status === 'issue').length} with issues.`;
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
