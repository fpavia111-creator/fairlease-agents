// Seller's rent roll against the trailing-twelve-month income statement (T-12). Pure functions.
import { r2, str, num, groupRentRoll, unitKey, foldText, monthlyByAccount } from 'keystone-core';

export const DILIGENCE_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    income_prefixes: { type: 'array', items: { type: 'string', minLength: 1 }, maxItems: 20 },
    expense_prefixes: { type: 'array', items: { type: 'string', minLength: 1 }, maxItems: 20 },
    rent_accounts: { type: 'array', items: { type: 'string', minLength: 1 }, maxItems: 50 },
    outlier_pct: { type: 'number', minimum: 1, maximum: 1000 },
    outlier_min: { type: 'number', minimum: 0 },
    gap_tolerance_pct: { type: 'number', minimum: 0, maximum: 100 },
    above_market_pct: { type: 'number', minimum: 0, maximum: 1000 },
  },
});

const RENT_NAME = /^(rent|rental|base rent|gross potential rent|apartment rent|residential rent|miete|mieteinnahmen|loyer|loyers|alquiler|ingresos por alquiler|renta|aluguel|aluguéis|receita de aluguel|canoni|affitti|canone|賃料|家賃|賃料収入|租金|租金收入|임대료|임대수입)/i;
const NOT_RENT = /late|fee|utility|reimb|parking|pet|other|concession|vacancy|loss|bad debt|säum|gebühr|frais|retard|recargo|multa|mora|遅延|滞纳|연체/i;
// Sellers' T-12s often carry names only, under INCOME and EXPENSES headings, with subtotals in between.
const SECTION = /^(?:operating\s+)?(income|revenues?|expenses?|einnahmen|erträge|aufwand|aufwendungen|kosten|revenus|produits|charges|dépenses|ingresos|gastos|receitas|despesas|ricavi|costi|spese|収入|費用|收入|支出|费用|수입|비용)\s*:?$/i;
const INC_SECTION = /income|revenue|einnahmen|ertr|revenus|produits|ingresos|receitas|ricavi|収入|收入|수입/i;
const SUBTOTAL = /^(effective gross|egi\b|sub-?total|total|net\b|noi\b|cash flow)/i;
const INCOME_NAME = /rent|income|revenue|reimburs|late fee|laundry|parking|pet fee|application|vacancy|concession|loss to lease|miete|einnahmen|ertr|loyer|revenu|alquiler|ingreso|renta|aluguel|receita|canon|affitt|ricav|賃料|家賃|収入|租金|收入|임대|수입/i;
const GPR = /gross potential|potential rent|\bgpr\b|market rent|sollmiete|loyer potentiel|renta potencial/i;
const DEDUCT = /vacancy|loss to lease|gain to lease|concession|leerstand|vacance|vacancia/i;
const numbered = (a) => /^\d/.test(str(a));
const NOT_VALUE = new Set(['account', 'account_name', 'property', 'period', 'date']);

/** T-12 rows ready to read: headings set the section, subtotals are dropped, and a line with a name but no account number is kept under its name. */
export function prepT12(rows) {
  const out = []; const section = new Map(); let cur = null;
  for (const r of rows || []) {
    const acct = str(r.account); const nm = str(r.account_name); const label = numbered(acct) ? nm : (acct || nm);
    const hasAmount = Object.entries(r).some(([k, v]) => !NOT_VALUE.has(k) && v !== null && v !== undefined && String(v).trim() !== '' && num(v) !== null);
    if (!hasAmount && SECTION.test(label)) { cur = INC_SECTION.test(label) ? 'income' : 'expense'; continue; }
    if (!numbered(acct) && SUBTOTAL.test(label)) continue;
    const account = acct || nm; if (!account) continue;
    if (!numbered(account) && !section.has(account)) section.set(account, cur || (INCOME_NAME.test(label) ? 'income' : 'expense'));
    out.push(acct ? r : { ...r, account, account_name: nm });
  }
  return { rows: out, section };
}
const NOT_CURRENT = /future|applicant|pending|past|former|previous/i;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
/** T-12 rows (wide month columns or long period/amount rows) as { account, name, months: {YYYY-MM: amount} }. */
export const readT12 = (rows) => monthlyByAccount(prepT12(rows).rows);

const startsWithAny = (a, list) => list.some((p) => a.startsWith(p));

export function checkDiligence({ rentRoll, t12Rows, policy = {}, asOf }) {
  const incP = policy.income_prefixes || ['4']; const expP = policy.expense_prefixes || ['5', '6', '7', '8'];
  const outPct = policy.outlier_pct ?? 25; const outMin = policy.outlier_min ?? 500; const gapTol = policy.gap_tolerance_pct ?? 2; const aboveMkt = policy.above_market_pct ?? 10;
  const items = []; const push = (area, subject, title, findings, extra = {}) => items.push({ area, subject, title, status: findings.some((f) => !f.severity) ? 'issue' : findings.length ? 'note' : 'ok', findings, ...extra });

  // Rent roll.
  const units = groupRentRoll(rentRoll || []);
  const occupied = units.filter((u) => !u.vacant); const sched = r2(occupied.reduce((s, u) => s + (u.rent || 0), 0));
  const market = r2(units.reduce((s, u) => s + (u.market_rent || 0), 0));
  for (const u of units) {
    const f = []; const add = (code, detail, extra = {}) => f.push({ code, detail, ...extra });
    if (!u.vacant && u.lease_end && u.lease_end < asOf && !/month|mtm/i.test(u.status)) add('expired_lease_in_roll', `Lease ended ${u.lease_end} but the unit is listed "${u.status || 'occupied'}" at ${u.rent ?? '?'}; ask for a renewal or month-to-month terms.`);
    if (!u.vacant && u.lease_start && u.lease_start > asOf && (!u.move_in || u.move_in > asOf)) add('lease_not_started', `Listed "${u.status || 'occupied'}" at ${u.rent ?? '?'}, but the lease starts ${u.lease_start}, after the rent roll date; its rent is in the scheduled total before anyone pays it.`);
    if (!u.vacant && !u.on_notice && u.move_out && u.move_out < asOf) add('moved_out_in_roll', `Move-out ${u.move_out} is before the rent roll date, but the unit is listed "${u.status || 'occupied'}" at ${u.rent ?? '?'}.`);
    if (!u.vacant && (u.rent === null || u.rent === 0)) add('occupied_without_rent', `Listed as occupied by ${u.tenant || 'a tenant'} with no rent.`);
    if (!u.vacant && u.rent && u.market_rent && ((u.rent - u.market_rent) / u.market_rent) * 100 > aboveMkt) add('rent_above_market', `Rent ${u.rent} is ${r2(((u.rent - u.market_rent) / u.market_rent) * 100)}% above the roll's own market rent ${u.market_rent}; check it is sustainable.`, { severity: 'note' });
    if (/applicant|future|pending|rented/i.test(`${u.tenant} ${u.status}`) && u.vacant && u.rent) add('future_lease_not_occupied', `Vacant today with a future resident (${u.tenant || u.status}) at ${u.rent}; not counted as occupied.`, { severity: 'note' });
    if (f.length) push('rent_roll', String(u.unit), `${u.unit} ${u.tenant}`.trim(), f, { amount: u.rent });
  }
  // A unit on two current lines (charge lines of one lease and future residents aside) is counted once here, but ask which line is right.
  const seen = new Map(); for (const r of rentRoll || []) { if (!str(r.unit) || str(r.charge_code) || num(r.charge_amount) !== null || NOT_CURRENT.test(str(r.status))) continue; const k = `${str(r.property).toLowerCase()}|${unitKey(r.unit)}`; const e = seen.get(k) || { unit: str(r.unit), n: 0 }; e.n++; seen.set(k, e); }
  const dups = [...seen.values()].filter((e) => e.n > 1).map((e) => e.unit);
  // T-12.
  const prep = prepT12(t12Rows); const byName = prep.section.size > 0;
  const isInc = (a) => (numbered(a.account) ? startsWithAny(a.account, incP) : prep.section.get(a.account) === 'income'); const isExp = (a) => (numbered(a.account) ? startsWithAny(a.account, expP) : prep.section.get(a.account) === 'expense');
  const accts = monthlyByAccount(prep.rows, { natural: (x) => (isExp({ account: x }) ? 'debit' : 'credit') }); const allMonths = [...new Set(accts.flatMap((a) => Object.keys(a.months)))].sort();
  // More than twelve month columns: the latest twelve are the T-12.
  const months = allMonths.slice(-12); if (allMonths.length > 12) for (const a of accts) for (const m of Object.keys(a.months)) if (!months.includes(m)) delete a.months[m];
  const nameOf = (a) => a.name || a.account;
  // Vacancy, loss to lease and concessions come off income whichever sign the seller's export gives them.
  const signed = (a, v) => (isInc(a) && DEDUCT.test(nameOf(a)) && v ? (/gain to lease/i.test(nameOf(a)) ? Math.abs(v) : -Math.abs(v)) : v);
  for (const a of accts) for (const m of Object.keys(a.months)) if (a.months[m] !== null) a.months[m] = signed(a, a.months[m]);
  const last = months[months.length - 1] || null;
  const baseRent = (a) => isInc(a) && (RENT_NAME.test(foldText(nameOf(a))) || GPR.test(nameOf(a))) && !NOT_RENT.test(nameOf(a));
  // When the rent line is gross potential rent, rent income is that line less vacancy, loss to lease and concessions.
  const gprAccts = policy.rent_accounts ? [] : accts.filter((a) => baseRent(a) && GPR.test(nameOf(a)));
  const netOf = gprAccts.length ? accts.filter((a) => isInc(a) && DEDUCT.test(nameOf(a))) : [];
  const isRent = (a) => (policy.rent_accounts ? policy.rent_accounts.includes(a.account) || policy.rent_accounts.includes(a.name) : baseRent(a) || netOf.includes(a));
  const tot = (pred, m) => r2(accts.filter(pred).reduce((s, a) => s + (m ? a.months[m] || 0 : Object.values(a.months).reduce((t, v) => t + (v || 0), 0)), 0));
  const income = tot(isInc); const expenses = tot(isExp); const rentT12 = tot(isRent); const rentLast = last ? tot(isRent, last) : null;
  const t12f = [];
  if (allMonths.length > 12) t12f.push({ code: 't12_extra_months', detail: `The file has ${allMonths.length} month columns (${allMonths[0]} to ${last}); the latest twelve, from ${months[0]}, are used.`, severity: 'note' });
  if (byName) t12f.push({ code: 'accounts_by_name', detail: `${prep.section.size} line(s) have no account number; they are read as income or expense from the heading they sit under, or from their name. Subtotal lines are left out.`, severity: 'note' });
  if (!accts.length) t12f.push({ code: 't12_empty', detail: 'No accounts read from the T-12.' });
  if (months.length && months.length < 12) t12f.push({ code: 't12_months_missing', detail: `The T-12 has ${months.length} month(s) (${months[0]} to ${last}), not 12.` });
  if (months.length > 1) { const [y0, m0] = months[0].split('-').map(Number); const [y1, m1] = last.split('-').map(Number); const span = (y1 - y0) * 12 + (m1 - m0) + 1; if (span > months.length) t12f.push({ code: 't12_gap', detail: `Months ${months[0]} to ${last} span ${span} months but only ${months.length} have columns.` }); }
  if (last && asOf.slice(0, 7) > last) { const [ay, am] = asOf.slice(0, 7).split('-').map(Number); const [ly, lm] = last.split('-').map(Number); const behind = (ay - ly) * 12 + (am - lm); if (behind > 1) t12f.push({ code: 't12_stale', detail: `The T-12 ends ${last}, ${behind} months before the rent roll date ${asOf}.` }); }
  if (!accts.some(isRent)) t12f.push({ code: 'rent_account_not_found', detail: `No rent income account recognised; name it in policy.rent_accounts. Income accounts start with ${incP.join(', ')}.` });
  if (t12f.length) push('t12', 'T-12', 'T-12 coverage', t12f);
  for (const a of accts) {
    if (!isInc(a) && !isExp(a)) continue;
    const vals = months.map((m) => [m, a.months[m]]); const filled = vals.filter(([, v]) => v !== null && v !== undefined && v !== 0);
    const med = median(filled.map(([, v]) => v)); const f = [];
    if (med !== null && filled.length >= 9) {
      for (const [m, v] of filled) { const dev = ((v - med) / Math.abs(med)) * 100; if (Math.abs(dev) > outPct && Math.abs(v - med) >= outMin) f.push({ code: 'month_outlier', detail: `${m}: ${v} against a typical month of ${r2(med)} (${dev > 0 ? '+' : ''}${r2(dev)}%); ask what it was.`, month: m, amount: r2(v - med) }); }
      if (filled.length >= 9) { const gaps = vals.filter(([, v]) => v === null || v === undefined || v === 0).map(([m]) => m); if (gaps.length && gaps.length <= 3 && !/turn|capital|capex|legal|bad debt/i.test(nameOf(a))) f.push({ code: 'month_blank', detail: `No amount in ${gaps.join(', ')} for an account with ${filled.length} other months; an accrual may be missing.`, months: gaps }); }
    }
    if (isInc(a) && filled.some(([, v]) => v < 0) && isRent(a) && !netOf.includes(a)) f.push({ code: 'negative_rent_month', detail: `Negative rent in ${filled.filter(([, v]) => v < 0).map(([m]) => m).join(', ')}.` });
    if (f.length) push('t12', a.account, `${a.account} ${a.name === a.account ? '' : a.name}`.trim(), f, { amount: r2(Object.values(a.months).reduce((t, v) => t + (v || 0), 0)) });
  }
  // Rent roll against the T-12.
  const rec = []; const gap = rentLast === null ? null : r2(sched - rentLast); const gapPct = rentLast !== null && sched ? r2((gap / sched) * 100) : null;
  if (rentLast !== null && sched && gapPct > gapTol) rec.push({ code: 'roll_above_collections', detail: `The rent roll schedules ${sched} a month for ${occupied.length} occupied unit(s); the T-12 shows ${rentLast} of rent income for ${last}, ${gap} (${gapPct}%) less. Ask for the ${last} receipts and the delinquency report.`, amount: gap });
  else if (rentLast !== null && sched && gapPct < -gapTol) rec.push({ code: 'collections_above_roll', detail: `The T-12 shows ${rentLast} of rent income for ${last}, ${-gap} more than the ${sched} the rent roll schedules; units may have left since, or the month includes back rent or prepayments.`, amount: gap, severity: 'note' });
  if (rentT12 && sched) { const ann = r2(sched * 12); rec.push({ code: 'annualized_vs_t12', detail: `Rent roll annualized: ${ann}; T-12 rent income: ${rentT12} (${Math.abs(r2(((ann - rentT12) / rentT12) * 100))}% ${ann >= rentT12 ? 'above' : 'below'}).`, severity: 'note', amount: r2(ann - rentT12) }); }
  if (netOf.length) rec.push({ code: 'rent_income_net_of', detail: `The T-12 carries gross potential rent (${gprAccts.map(nameOf).join(', ')}); rent income here is that less ${netOf.map(nameOf).join(', ')}.`, severity: 'note' });
  if (dups.length) rec.push({ code: 'duplicate_units', detail: `Units on more than one current line: ${dups.join(', ')}. Each is counted once here, at its first line; ask which line is right.` });
  push('reconciliation', 'reconciliation', 'Rent roll against T-12', rec, { amount: gap });
  const summary_t12 = { months: months.length, from: months[0] || null, to: last, income, expenses, noi: r2(income - expenses), rent_income: rentT12, rent_income_last_month: rentLast };
  const summary_roll = { units: units.length, occupied: occupied.length, physical_occupancy_pct: units.length ? r2((occupied.length / units.length) * 100) : null, scheduled_monthly: sched, market_monthly: market, economic_occupancy_pct: market && rentLast !== null ? r2((rentLast / market) * 100) : null };
  const rank = { issue: 0, note: 1, ok: 2 }; const areaRank = { reconciliation: 0, rent_roll: 1, t12: 2 };
  items.sort((a, b) => rank[a.status] - rank[b.status] || areaRank[a.area] - areaRank[b.area] || String(a.subject).localeCompare(String(b.subject), undefined, { numeric: true }));
  const issues = items.filter((i) => i.status === 'issue');
  const summary = `Rent roll ${asOf}: ${summary_roll.occupied} of ${summary_roll.units} units occupied (${summary_roll.physical_occupancy_pct}%), ${sched} a month scheduled. T-12 ${summary_t12.from || '?'} to ${summary_t12.to || '?'}: income ${income}, expenses ${expenses}, NOI ${summary_t12.noi}.${gap !== null ? ` Last month's rent income ${rentLast}, ${gap >= 0 ? `${gap} below` : `${-gap} above`} the roll.` : ''} ${issues.length} item(s) to ask the seller about.`;
  return { summary, as_of: asOf, rent_roll: summary_roll, t12: summary_t12, items };
}

/** Questions for the seller, one per finding that is not a note. */
export function questionsText(r, a = {}) {
  const qs = r.items.flatMap((i) => i.findings.filter((f) => !f.severity).map((f) => `- **${i.title}**: ${f.detail}`));
  return `**To:** ${a.to || '[TO CONFIRM: seller or broker]'}

# Due diligence questions${a.property ? `: ${a.property}` : ''}

Based on the rent roll dated ${r.as_of} and the T-12 from ${r.t12.from || '?'} to ${r.t12.to || '?'}:

${qs.join('\n') || '- No open questions from the files.'}

Please answer in writing and attach support${a.reply_by ? ` by ${a.reply_by}` : ''}.

${a.from || '[TO CONFIRM: name and contact]'}
`;
}
