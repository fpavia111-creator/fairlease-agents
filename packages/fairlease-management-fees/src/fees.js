// Fees charged to owners against the terms of each management agreement. Pure functions.
import { r2, num, str, isoDate, periodKey, sameParty, foldText, groupRentRoll } from 'fairlease-core';

const FEE = { type: 'object', additionalProperties: false, minProperties: 1, properties: { flat: { type: 'number', minimum: 0 }, pct_of_monthly_rent: { type: 'number', minimum: 0, maximum: 300 } } };
export const AGREEMENTS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['agreements'],
  properties: {
    tolerance: { type: 'number', minimum: 0, maximum: 100 },
    agreements: { type: 'array', minItems: 1, maxItems: 5000, items: { type: 'object', additionalProperties: false, required: ['owner'], properties: {
      owner: { type: 'string', minLength: 1 }, property: { type: 'string' },
      management_fee_pct: { type: 'number', minimum: 0, maximum: 100 }, flat_monthly: { type: 'number', minimum: 0 }, minimum_monthly: { type: 'number', minimum: 0 }, maximum_monthly: { type: 'number', minimum: 0 },
      excluded_income: { type: 'array', maxItems: 50, items: { type: 'string', minLength: 2 } },
      leasing_fee: FEE, renewal_fee: FEE, maintenance_markup_pct: { type: 'number', minimum: 0, maximum: 100 },
      other_fees: { type: 'array', maxItems: 50, items: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string', minLength: 2 }, amount: { type: 'number', minimum: 0 } } } },
    } } },
  },
});

const t = (s) => foldText(str(s)).toLowerCase();
const KIND = [
  ['management', /management fee|mgmt fee|property management|verwaltungsgebühr|verwaltervergütung|honoraires de gestion|honorarios de gestión|honorarios de administración|taxa de administração|compenso di gestione|管理手数料|管理费|관리수수료/i],
  ['leasing', /leasing fee|lease[- ]up|new lease|letting fee|tenant placement|placement fee|vermietungsgebühr|frais de location|honorarios de arrendamiento|taxa de locação|provvigione locazione|仲介手数料|租赁费|임대수수료/i],
  ['renewal', /renewal fee|lease renewal|verlängerungsgebühr|frais de renouvellement|renovación|renovação|rinnovo|更新手数料|续租费|갱신수수료/i],
  ['markup', /mark[- ]?up|surcharge|aufschlag|majoration|recargo|sobretaxa|maggiorazione|上乗せ|加价|가산/i],
];
const DEFAULT_EXCLUDED = ['security deposit', 'deposit held', 'prepaid', 'owner contribution', 'kaution', 'dépôt de garantie', 'fianza', 'caução', 'deposito cauzionale', '敷金', '押金', '보증금'];
const NOT_MAINT = /fee|tax|insurance|mortgage|loan|utility bill|utilities|water bill|electric bill|gas bill|payroll|management|distribution|reserve|steuer|versicherung|impôt|assurance|impuesto|seguro|imposto|tassa|assicurazione|税|保険|保险|세금|보험/i;

// Fees other people charge and the owner simply bears (bank, city, association, court) are costs, not fees of the manager.
const PASS_THROUGH = /\b(bank|wire|nsf|permit|hoa|homeowners?|association|condo|filing|court|recording|licen[cs]e|registration|city|county|municipal|attorney|legal)\b|bankgebühr|frais bancaires|comisión bancaria|tarifa bancária|spese bancarie|銀行手数料|银行手续费|은행 수수료/i;
const REVERSAL = /\bnsf\b|returned (payment|check|cheque|item)|reversal|reversed|chargeback|rücklastschrift|rückbuchung|impayé|rejet|devuelto|devolvido|insoluto|不渡|退票|부도/i;
const feeKind = (r) => { const s = `${r.type} ${r.description} ${r.account}`; for (const [k, re] of KIND) if (re.test(s)) return k; if (PASS_THROUGH.test(`${r.description}`)) return null; return /\bfee\b|gebühr|frais|honorario|taxa|commissione|手数料|费|수수료/i.test(s) ? 'other' : null; };

export function checkFees({ ledgerRows, agreements, rentRoll = null, period = null }) {
  const tol = agreements.tolerance ?? 1; const roll = rentRoll ? groupRentRoll(rentRoll) : [];
  const lines = (ledgerRows || []).map((r) => ({ owner: str(r.owner), property: str(r.property), period: isoDate(r.date) ? isoDate(r.date).slice(0, 7) : periodKey(r.period), date: isoDate(r.date), type: str(r.type), account: str(r.account), description: str(r.description), income: num(r.income) ?? (num(r.amount) > 0 ? num(r.amount) : 0), expense: num(r.expense) ?? (num(r.amount) < 0 ? -num(r.amount) : 0) })).filter((l) => l.owner && l.period && (!period || l.period === period));
  const agFor = (l) => agreements.agreements.find((a) => sameParty(a.owner, l.owner) && (!a.property || t(a.property) === t(l.property)));
  const groups = new Map();
  for (const l of lines) { const k = `${t(l.owner)}|${t(l.property)}|${l.period}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(l); }
  const items = []; const unknown = new Set();
  for (const g of groups.values()) {
    const { owner, property, period: p } = g[0]; const ag = agFor(g[0]);
    if (!ag) { unknown.add(`${owner} (${property})`); continue; }
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const fees = g.filter((l) => l.expense && feeKind(l)).map((l) => ({ ...l, kind: feeKind(l) }));
    const excl = [...DEFAULT_EXCLUDED, ...(ag.excluded_income || [])].map(t);
    // Money that came in and bounced was not collected: a negative receipt, or a returned-payment line in the money-out column.
    const incomeLines = g.filter((l) => l.income);
    const bounced = r2(g.filter((l) => l.expense > 0 && !l.income && !feeKind(l) && REVERSAL.test(`${l.type} ${l.description}`) && !/\bfee\b/i.test(l.description)).reduce((s, l) => s + l.expense, 0));
    const base = r2(incomeLines.filter((l) => !excl.some((w) => t(`${l.type} ${l.description} ${l.account}`).includes(w))).reduce((s, l) => s + l.income, 0) - bounced);
    const excluded = r2(incomeLines.reduce((s, l) => s + l.income, 0) - bounced - base);
    // Management fee.
    let expected = ag.flat_monthly ?? (ag.management_fee_pct !== undefined ? r2((base * ag.management_fee_pct) / 100) : null);
    if (expected !== null && ag.minimum_monthly !== undefined) expected = Math.max(expected, ag.minimum_monthly);
    if (expected !== null && ag.maximum_monthly !== undefined) expected = Math.min(expected, ag.maximum_monthly);
    const mgmt = fees.filter((f) => f.kind === 'management'); const charged = r2(mgmt.reduce((s, f) => s + f.expense, 0));
    if (mgmt.length > 1 && mgmt.every((f) => Math.abs(f.expense - mgmt[0].expense) < 0.005)) add('duplicate_fee', `Management fee of ${mgmt[0].expense} charged ${mgmt.length} times in ${p}.`, { amount: r2(charged - mgmt[0].expense) });
    const once = mgmt.length > 1 && findings.some((f) => f.code === 'duplicate_fee') ? mgmt[0].expense : charged;
    if (expected !== null && (mgmt.length || base > 0)) {
      const how = ag.flat_monthly !== undefined ? `flat ${ag.flat_monthly}` : `${ag.management_fee_pct}% of ${base} collected${excluded ? ` (excluding ${excluded} of deposits and other excluded income)` : ''}${ag.minimum_monthly !== undefined && expected === ag.minimum_monthly ? `, minimum ${ag.minimum_monthly}` : ''}`;
      if (once - expected > tol) add('management_fee_over', `Management fee charged ${once}; the agreement gives ${expected} (${how}). Over by ${r2(once - expected)}.`, { amount: r2(once - expected) });
      else if (expected - once > tol) add('management_fee_under', `Management fee charged ${once}; the agreement gives ${expected} (${how}). Under by ${r2(expected - once)}.`, { amount: r2(once - expected), severity: 'note' });
    }
    // Leasing and renewal fees.
    for (const [kind, term] of [['leasing', ag.leasing_fee], ['renewal', ag.renewal_fee]]) {
      const seenFee = new Map();
      for (const f of fees.filter((x) => x.kind === kind)) {
        const dk = `${t(f.description)}|${f.expense}`; seenFee.set(dk, (seenFee.get(dk) || 0) + 1);
        if (seenFee.get(dk) > 1) { add('duplicate_fee', `${f.description} of ${f.expense} charged again on ${f.date}; the same fee is already in ${p}.`, { amount: f.expense }); continue; }
        if (!term) { add(`${kind}_fee_not_in_agreement`, `${f.description} ${f.expense} on ${f.date}: the agreement has no ${kind} fee.`, { amount: f.expense }); continue; }
        let exp = term.flat ?? null; let how = term.flat !== undefined ? `flat ${term.flat}` : '';
        if (exp === null && term.pct_of_monthly_rent !== undefined) {
          const u = roll.find((x) => new RegExp(`(^|[^0-9a-z])${String(x.unit).replace(/[^0-9a-z]/gi, '')}([^0-9a-z]|$)`, 'i').test(f.description) && x.rent);
          if (u) { exp = r2((u.rent * term.pct_of_monthly_rent) / 100); how = `${term.pct_of_monthly_rent}% of unit ${u.unit}'s rent ${u.rent}`; }
        }
        if (exp === null) { add(`${kind}_fee_unverified`, `${f.description} ${f.expense}: the agreement sets ${term.pct_of_monthly_rent}% of monthly rent and no unit in the rent roll matches the description.`, { severity: 'note' }); continue; }
        if (f.expense - exp > tol) add(`${kind}_fee_over`, `${f.description}: charged ${f.expense}; the agreement gives ${exp} (${how}). Over by ${r2(f.expense - exp)}.`, { amount: r2(f.expense - exp) });
      }
    }
    // Maintenance markup.
    const markups = fees.filter((f) => f.kind === 'markup');
    if (markups.length) {
      const bills = r2(g.filter((l) => l.expense && !feeKind(l) && !NOT_MAINT.test(`${l.type} ${l.description}`)).reduce((s, l) => s + l.expense, 0));
      const charged2 = r2(markups.reduce((s, f) => s + f.expense, 0)); const pct = ag.maintenance_markup_pct;
      if (!pct) add('markup_not_in_agreement', `Markup of ${charged2} charged; the agreement allows none.`, { amount: charged2 });
      else { const exp = r2((bills * pct) / 100); if (charged2 - exp > tol) add('markup_over', `Markup charged ${charged2}; ${pct}% of ${bills} in maintenance bills is ${exp}. Over by ${r2(charged2 - exp)}.`, { amount: r2(charged2 - exp) }); }
    }
    // Other fees.
    for (const f of fees.filter((x) => x.kind === 'other')) {
      const ok = (ag.other_fees || []).find((o) => t(f.description).includes(t(o.name)) || t(o.name).includes(t(f.description)));
      if (!ok) add('fee_not_in_agreement', `${f.description} ${f.expense} on ${f.date} is not a fee in the agreement.`, { amount: f.expense });
      else if (ok.amount !== undefined && f.expense - ok.amount > tol) add('other_fee_over', `${f.description}: charged ${f.expense}; the agreement gives ${ok.amount}.`, { amount: r2(f.expense - ok.amount) });
    }
    const over = r2(findings.filter((f) => !f.severity && f.amount > 0).reduce((s, f) => s + f.amount, 0));
    const hard = findings.filter((f) => !f.severity);
    items.push({ owner, property, period: p, collected: r2(base + excluded), fee_base: base, expected_management_fee: expected, charged_management_fee: charged, fees_charged: r2(fees.reduce((s, f) => s + f.expense, 0)), overcharge: over, status: hard.length ? 'issue' : findings.length ? 'note' : 'ok', findings });
  }
  const rank = { issue: 0, note: 1, ok: 2 };
  items.sort((a, b) => rank[a.status] - rank[b.status] || b.overcharge - a.overcharge || a.owner.localeCompare(b.owner) || b.period.localeCompare(a.period));
  const total = r2(items.reduce((s, i) => s + i.overcharge, 0));
  const summary = `${items.length} owner-month(s) checked against their agreements: ${items.filter((i) => i.status === 'issue').length} with fees above or outside the agreement, ${total} to refund or explain in total.${unknown.size ? ` No agreement on file for: ${[...unknown].join('; ')}.` : ''}`;
  return { summary, overcharge_total: total, owners_without_agreement: [...unknown], items };
}

/** Correction note to the owner: the fees that will be credited back. */
export function creditText(it, a = {}) {
  const rows = it.findings.filter((f) => !f.severity && f.amount > 0);
  return `**To:** ${a.to || `${it.owner} [TO CONFIRM: owner email]`}

# Fee correction: ${it.property}, ${it.period}

In reviewing your ${it.period} statement against our management agreement, we found fees charged above or outside its terms:

${rows.map((f) => `- ${f.detail}`).join('\n')}

Total to be credited: ${r2(rows.reduce((s, f) => s + f.amount, 0))}. ${a.credit_on || '[TO CONFIRM: the statement the credit will appear on]'}

${a.from || '[TO CONFIRM: manager name and contact]'}
`;
}
