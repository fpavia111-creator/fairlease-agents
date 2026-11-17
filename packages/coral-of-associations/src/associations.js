// HOA and condo association checks: owner accounts against the assessment and collection policy, and violations against
// the notice, cure and hearing steps. Pure functions. Coral echoes the steps the policy names; it decides nothing.
import { r2, num, str, isoDate, addDays, daysBetween, foldText, partyKey } from 'keystone-core';

const YM = { type: 'string', pattern: '^\\d{4}-\\d{2}$' };
export const ASSOCIATION_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['assessment'],
  properties: {
    association: { type: 'string', maxLength: 200 },
    assessment: { type: 'object', additionalProperties: false, required: ['amount'], properties: {
      amount: { type: 'number', minimum: 0 },
      per_unit: { type: 'object', maxProperties: 20000, additionalProperties: { type: 'number', minimum: 0 } },
      frequency: { type: 'string', enum: ['monthly', 'quarterly', 'annual'] },
      due_day: { type: 'integer', minimum: 1, maximum: 28 },
      words: { type: 'array', maxItems: 40, items: { type: 'string', minLength: 2, maxLength: 60 } },
    } },
    periods_from: YM,
    grace_days: { type: 'integer', minimum: 0, maximum: 90 },
    late_fee: { type: 'object', additionalProperties: false, properties: {
      flat: { type: 'number', minimum: 0 }, pct: { type: 'number', minimum: 0, maximum: 100 },
      words: { type: 'array', maxItems: 40, items: { type: 'string', minLength: 2, maxLength: 60 } },
    } },
    collection_steps: { type: 'array', maxItems: 12, items: { type: 'object', additionalProperties: false, required: ['days', 'step'], properties: { days: { type: 'integer', minimum: 1, maximum: 3650 }, step: { type: 'string', minLength: 2, maxLength: 200 } } } },
    violations: { type: 'object', additionalProperties: false, properties: {
      notice_within_days: { type: 'integer', minimum: 0, maximum: 90 },
      cure_days: { type: 'integer', minimum: 1, maximum: 365 },
      hearing_before_fine: { type: 'boolean' },
      stale_days: { type: 'integer', minimum: 1, maximum: 3650 },
      repeat_days: { type: 'integer', minimum: 1, maximum: 3650 },
    } },
    tolerance: { type: 'number', minimum: 0, maximum: 100 },
  },
});

const DUES_WORDS = ['assessment', 'assessments', 'dues', 'hoa', 'hoa dues', 'condo fee', 'common charges', 'maintenance fee', 'hausgeld', 'wohngeld', 'charges de copropriete', 'appel de fonds', 'cuota', 'cuotas', 'cuota de comunidad', 'condominio', 'taxa condominial', 'spese condominiali', 'rata condominiale', '管理費', '修繕積立金', '物业费', '管理费', '관리비'];
const LATE_WORDS = ['late', 'late fee', 'late charge', 'mahngebuhr', 'saumniszuschlag', 'penalite de retard', 'penalidad', 'recargo', 'multa por atraso', 'mora', 'penale', '延滞金', '滞纳金', '연체료'];
const fold = (s) => foldText(str(s)).toLowerCase();
const hasWord = (text, words) => { const t = ` ${fold(text).replace(/[^\p{L}\p{N}]+/gu, ' ')} `; return words.some((w) => { const f = fold(w); return /[぀-鿿가-힯]/.test(f) ? t.includes(f) : t.includes(` ${f} `); }); };

/** Due dates of the assessment periods from a YYYY-MM month up to asOf. */
export function dueDates(fromYm, asOf, frequency = 'monthly', dueDay = 1) {
  const step = { monthly: 1, quarterly: 3, annual: 12 }[frequency] || 1; const out = [];
  let [y, m] = fromYm.split('-').map(Number);
  for (let guard = 0; guard < 600; guard += 1) {
    const d = `${y}-${String(m).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
    if (d > asOf) break; out.push(d);
    m += step; while (m > 12) { m -= 12; y += 1; }
  }
  return out;
}

/** Applies payments to charges oldest first; returns each charge with paid_on (date fully paid) and open remainder. */
export function applyPayments(charges, payments) {
  const cs = charges.map((c) => ({ ...c, open: c.amount, paid_on: null })).sort((a, b) => a.date.localeCompare(b.date));
  let credit = 0;
  for (const p of [...payments].sort((a, b) => a.date.localeCompare(b.date))) {
    let left = p.amount + credit; credit = 0;
    for (const c of cs) { if (left <= 0.004) break; if (c.open <= 0.004) continue; const x = Math.min(c.open, left); c.open = r2(c.open - x); left = r2(left - x); if (c.open <= 0.004) c.paid_on = p.date; }
    credit = left;
  }
  return { charges: cs, credit: r2(credit) };
}

function checkAccount(acct, policy, asOf, fromYm) {
  const a = policy.assessment; const tol = policy.tolerance ?? 0.01; const grace = policy.grace_days ?? 15;
  const dues = a.words && a.words.length ? a.words : DUES_WORDS; const lateWords = policy.late_fee && policy.late_fee.words && policy.late_fee.words.length ? policy.late_fee.words : LATE_WORDS;
  const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
  const charges = []; const payments = []; let lastBalance = null;
  for (const r of acct.rows) {
    const d = isoDate(r.date); if (!d) continue;
    const c = num(r.charge); const p = num(r.payment); const type = str(r.type);
    const kind = hasWord(type, lateWords) ? 'late_fee' : hasWord(type, dues) ? 'assessment' : 'other';
    if (c !== null && Math.abs(c) > 0.004) { if (c > 0) charges.push({ date: d, amount: c, type, kind }); else payments.push({ date: d, amount: -c }); }
    if (p !== null && Math.abs(p) > 0.004) { if (p > 0) payments.push({ date: d, amount: p }); else charges.push({ date: d, amount: -p, type: type || 'returned payment', kind: 'other' }); }
    if (num(r.balance) !== null) lastBalance = num(r.balance);
  }
  const expected = a.per_unit && acct.unit && a.per_unit[acct.unit] !== undefined ? a.per_unit[acct.unit] : a.amount;
  const freq = a.frequency || 'monthly'; const span = { monthly: 7, quarterly: 4, annual: 4 }[freq];
  const periodOf = (d) => (freq === 'monthly' ? d.slice(0, 7) : freq === 'annual' ? d.slice(0, 4) : `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`);
  const applied = applyPayments(charges, payments);
  const lateFeeFor = (base) => r2((policy.late_fee?.flat || 0) + (base * (policy.late_fee?.pct || 0)) / 100);
  const periods = [];
  const dues_ = dueDates(fromYm, asOf, freq, a.due_day || 1);
  for (const [idx, due] of dues_.entries()) {
    const pk = periodOf(due);
    const got = applied.charges.filter((c) => c.kind === 'assessment' && periodOf(c.date) === pk && c.date >= addDays(due, -span - 25));
    const amount = r2(got.reduce((s, c) => s + c.amount, 0));
    if (!got.length) { add('missing_assessment', `No assessment charged for ${pk} (expected ${expected}, due ${due}).`, { amount: expected }); periods.push({ period: pk, due, charged: 0, expected }); continue; }
    if (Math.abs(amount - expected) > tol) add('wrong_amount', `${pk} assessment charged ${amount}; your policy sets ${expected}${a.per_unit && a.per_unit[acct.unit] !== undefined ? ` for unit ${acct.unit}` : ''}.`, { amount: r2(amount - expected) });
    const lateDay = addDays(due, grace);
    const paidOn = got.every((c) => c.paid_on) ? got.map((c) => c.paid_on).sort().at(-1) : null;
    const late = paidOn ? paidOn > lateDay : asOf > lateDay;
    const nextLate = dues_[idx + 1] ? addDays(dues_[idx + 1], grace) : '9999-12-31';
    const fees = applied.charges.filter((c) => c.kind === 'late_fee' && c.date >= lateDay && c.date < nextLate && !c.used);
    const fee = fees[0] || null; if (fee) fee.used = true;
    const policyFee = policy.late_fee ? lateFeeFor(expected) : null;
    if (late && policy.late_fee && policyFee > 0 && !fee) add('late_fee_missing', `${pk} assessment ${paidOn ? `paid ${paidOn}` : 'still unpaid'} after the ${grace}-day grace period (${lateDay}); no late fee charged. Your policy's fee is ${policyFee}.`, { amount: policyFee });
    if (!late && fee) add('late_fee_not_due', `Late fee ${fee.amount} on ${fee.date}, but the ${pk} assessment was paid ${paidOn} within the grace period (${lateDay}).`, { amount: fee.amount });
    if (late && fee && policyFee !== null && Math.abs(fee.amount - policyFee) > tol) add('late_fee_amount', `Late fee for ${pk} is ${fee.amount}; your policy works out ${policyFee}.`, { amount: r2(fee.amount - policyFee) });
    periods.push({ period: pk, due, charged: amount, expected, paid_on: paidOn });
  }
  for (const f of applied.charges.filter((c) => c.kind === 'late_fee' && !c.used)) {
    const assessmentLate = periods.some((p) => p.due < f.date && (!p.paid_on || p.paid_on > addDays(p.due, grace)));
    if (!assessmentLate) add('late_fee_not_due', `Late fee ${f.amount} on ${f.date} matches no late assessment.`, { amount: f.amount });
  }
  const charged = r2(charges.reduce((s, c) => s + c.amount, 0)); const paid = r2(payments.reduce((s, p) => s + p.amount, 0));
  const balance = r2(charged - paid);
  if (lastBalance !== null && Math.abs(lastBalance - balance) > Math.max(tol, 0.01)) add('balance_differs', `The ledger's last balance is ${lastBalance}; its charges less payments come to ${balance}.`, { amount: r2(lastBalance - balance) });
  const open = applied.charges.filter((c) => c.open > 0.004);
  const oldest = open.length ? open[0].date : null;
  const days = oldest ? Math.max(0, daysBetween(oldest, asOf)) : 0;
  const pastDue = r2(open.filter((c) => addDays(c.date, grace) < asOf).reduce((s, c) => s + c.open, 0));
  const steps = [...(policy.collection_steps || [])].sort((x, y) => x.days - y.days);
  const current = pastDue > tol ? steps.filter((s) => s.days <= days).at(-1) : null;
  const next = pastDue > tol ? steps.find((s) => s.days > days) : null;
  if (pastDue > tol) add('past_due', `${pastDue} past due; oldest unpaid charge ${oldest} (${days} days).${current ? ` Your policy's step at ${current.days} days: ${current.step}.` : ''}${next ? ` Next at ${next.days} days: ${next.step}.` : ''} A person decides.`, { amount: pastDue });
  if (balance < -tol) add('credit_balance', `Credit balance of ${-balance} (paid ahead or overpaid).`, { amount: balance });
  const issueCodes = ['missing_assessment', 'wrong_amount', 'late_fee_missing', 'late_fee_not_due', 'late_fee_amount', 'balance_differs'];
  const status = pastDue > tol ? 'delinquent' : findings.some((f) => issueCodes.includes(f.code)) ? 'issue' : balance < -tol ? 'credit' : 'ok';
  return { kind: 'account', id: acct.account || acct.unit || acct.owner, account: acct.account || null, unit: acct.unit || null, owner: acct.owner, amount: balance, balance, past_due: pastDue, days, oldest_unpaid: oldest, expected_assessment: expected, charged, paid, step: current ? current.step : null, next_step: next ? next.step : null, status, findings, periods };
}

function checkViolation(v, priorOf, policy, asOf) {
  const vp = policy.violations || {}; const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
  const opened = isoDate(v.opened); const n1 = isoDate(v.notice_1); const n2 = isoDate(v.notice_2); const hearing = isoDate(v.hearing); const closedOn = isoDate(v.closed);
  const fine = num(v.fine) || 0; const st = fold(v.status);
  const closed = !!closedOn || /^(closed|cured|resolved|complete|completed|cerrado|resuelto|geschlossen|erledigt|clos|ferme|fechado|chiuso|完了|已关闭|종결)/.test(st);
  const end = closedOn || asOf; const age = opened ? daysBetween(opened, end) : null;
  if (!opened) add('opened_unknown', 'No date the violation was opened or observed.');
  if (opened && !n1 && !closed && vp.notice_within_days !== undefined && daysBetween(opened, asOf) > vp.notice_within_days) add('first_notice_late', `Opened ${opened}; no first notice recorded and your policy sends one within ${vp.notice_within_days} days.`);
  if (n1 && n2 && n2 < n1) add('dates_out_of_order', `Second notice ${n2} is before the first notice ${n1}.`);
  if (n1 && !n2 && !closed && !hearing && vp.cure_days && addDays(n1, vp.cure_days) < asOf) add('second_notice_due', `First notice ${n1}; the ${vp.cure_days}-day cure period ended ${addDays(n1, vp.cure_days)} with no second notice, hearing or closure recorded.`);
  if (fine > 0 && vp.hearing_before_fine && (!hearing || hearing > asOf)) add('fine_without_hearing', `Fine of ${fine} recorded ${hearing ? `before the hearing on ${hearing}` : 'with no hearing date'}; your policy holds a hearing before a fine.`, { amount: fine });
  if (!closed && age !== null && vp.stale_days && age > vp.stale_days) add('stale', `Open ${age} days (your policy flags after ${vp.stale_days}).`);
  if (opened && vp.repeat_days) {
    const prior = priorOf(v);
    if (prior.length) add('repeat', `Same rule at this unit ${prior.length} time(s) in the ${vp.repeat_days} days before: ${prior.slice(-5).map((o) => `${o.violation_id} (${isoDate(o.opened)})`).join(', ')}${prior.length > 5 ? ` and ${prior.length - 5} earlier` : ''}.`);
  }
  const action = ['first_notice_late', 'second_notice_due', 'fine_without_hearing', 'stale', 'dates_out_of_order', 'opened_unknown'];
  const status = findings.some((f) => action.includes(f.code)) ? 'action' : closed ? 'closed' : 'open';
  return { kind: 'violation', id: str(v.violation_id), violation_id: str(v.violation_id), unit: str(v.unit) || null, owner: str(v.owner), type: str(v.type), opened, notice_1: n1, notice_2: n2, hearing, closed: closedOn || (closed ? 'yes' : null), amount: fine, days: age, status, findings };
}

export function checkAssociation({ ledger = null, violations = null, policy, asOf }) {
  if (!ledger && !violations) throw new Error('give an owner ledger, a violations log, or both');
  const items = [];
  if (ledger) {
    const accts = new Map();
    for (const r of ledger) {
      const k = str(r.account) || (str(r.unit) ? `unit:${fold(r.unit)}` : `owner:${partyKey(r.owner)}`);
      if (!accts.has(k)) accts.set(k, { account: str(r.account), unit: str(r.unit), owner: str(r.owner), rows: [] });
      const a = accts.get(k); a.rows.push(r); if (!a.unit && str(r.unit)) a.unit = str(r.unit); if (!a.owner && str(r.owner)) a.owner = str(r.owner);
    }
    const dates = ledger.map((r) => isoDate(r.date)).filter(Boolean).sort();
    const fromYm = policy.periods_from || (dates[0] || asOf).slice(0, 7);
    for (const a of accts.values()) items.push(checkAccount(a, policy, asOf, fromYm));
  }
  if (violations) {
    // Repeats are looked for among violations at the same unit for the same rule, grouped once (large logs).
    const key = (v) => `${fold(v.unit)}\u0000${fold(v.type)}`; const groups = new Map();
    for (const v of violations) { const k = key(v); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(v); }
    // Each group sorted by the date opened once; the earlier ones within repeat_days are a window, not a scan.
    const days = (policy.violations || {}).repeat_days; const opened = new Map(violations.map((v) => [v, isoDate(v.opened)]));
    for (const g of groups.values()) g.sort((x, y) => String(opened.get(x) || '').localeCompare(String(opened.get(y) || '')));
    const priorOf = (v) => {
      const o = opened.get(v); if (!o || !days || !fold(v.type)) return [];
      const g = groups.get(key(v)); const from = addDays(o, -days); const out = [];
      let lo = 0, hi = g.length; while (lo < hi) { const m = (lo + hi) >> 1; if ((opened.get(g[m]) || '') < from) lo = m + 1; else hi = m; }
      for (let i = lo; i < g.length && (opened.get(g[i]) || '') < o; i++) if (g[i] !== v && opened.get(g[i])) out.push(g[i]);
      return out;
    };
    for (const v of violations) items.push(checkViolation(v, priorOf, policy, asOf));
  }
  const order = { delinquent: 0, action: 1, issue: 2, open: 3, credit: 4, ok: 5, closed: 6 };
  items.sort((x, y) => order[x.status] - order[y.status] || (y.days ?? 0) - (x.days ?? 0) || String(x.unit).localeCompare(String(y.unit), undefined, { numeric: true }));
  const accounts = items.filter((i) => i.kind === 'account'); const vio = items.filter((i) => i.kind === 'violation');
  const n = (list, s) => list.filter((i) => i.status === s).length;
  const summary = `${policy.association ? `${policy.association}: ` : ''}${ledger ? `${accounts.length} owner account(s): ${n(accounts, 'delinquent')} delinquent (${r2(accounts.reduce((s, i) => s + i.past_due, 0))} past due), ${n(accounts, 'issue')} with assessment or late fee issues, ${n(accounts, 'credit')} in credit.` : 'No owner ledger.'}${violations ? ` ${vio.length} violation(s): ${n(vio, 'action')} need a step, ${n(vio, 'open')} open, ${n(vio, 'closed')} closed.` : ''}`;
  return { summary, as_of: asOf, items };
}

/** Owner notice: a statement-of-account reminder, or a violation notice. */
export function noticeText(it, a = {}) {
  const assoc = a.association || '[TO CONFIRM: association name]';
  const sign = a.from || '[TO CONFIRM: manager name and contact]';
  const fmt = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (it.kind === 'account') {
    const rows = it.periods.filter((p) => !p.paid_on).map((p) => `| ${p.period} | ${p.due} | ${fmt(p.charged)} |`).join('\n') || '| | | |';
    return `**To:** ${a.to || '[TO CONFIRM: owner email or mailing address]'}

# Statement of account: payment reminder

${assoc}
Owner: ${it.owner}
Unit: ${it.unit || '[TO CONFIRM]'}${it.account ? `\nAccount: ${it.account}` : ''}
Statement date: ${a.as_of}

Our records show ${fmt(it.past_due)} past due on your account, the oldest charge from ${it.oldest_unpaid}. Current balance: ${fmt(it.balance)}.

| Period | Due | Assessment |
|---|---|---:|
${rows}

Please pay by ${a.pay_by || '[TO CONFIRM: date]'} to ${a.pay_to || '[TO CONFIRM: payment address or portal]'}. If you have already paid, or think this statement is wrong, please contact us so we can check it.${a.plan_offer ? `\n\n${a.plan_offer}` : ''}

${sign}
`;
  }
  return `**To:** ${a.to || '[TO CONFIRM: owner email or mailing address]'}

# Notice of rule violation${it.notice_1 ? ' (follow-up)' : ''}

${assoc}
Owner: ${it.owner || '[TO CONFIRM: owner name]'}
Unit: ${it.unit || '[TO CONFIRM]'}
Case: ${it.violation_id}

On ${it.opened || '[TO CONFIRM: date]'} we observed: ${it.type || '[TO CONFIRM: what was observed]'}.${it.notice_1 ? ` A first notice was sent on ${it.notice_1}.` : ''}

Rule: ${a.rule || '[TO CONFIRM: section of the governing documents]'}

Please correct this by ${a.cure_by || '[TO CONFIRM: date]'}.${a.hearing ? ` You may attend a hearing on ${a.hearing}.` : ' [TO CONFIRM: hearing opportunity, if your documents provide one]'}

Photos are available on request. If this has been corrected, please let us know so we can close the case.

${sign}
`;
}
