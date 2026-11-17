// Seller's rent roll against the trailing-twelve-month income statement (T-12). Pure functions.
import { r2, str, groupRentRoll, foldText, monthlyByAccount } from 'keystone-core';

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
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
/** T-12 rows (wide month columns or long period/amount rows) as { account, name, months: {YYYY-MM: amount} }. */
export const readT12 = (rows) => monthlyByAccount(rows);

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
    if (!u.vacant && (u.rent === null || u.rent === 0)) add('occupied_without_rent', `Listed as occupied by ${u.tenant || 'a tenant'} with no rent.`);
    if (!u.vacant && u.rent && u.market_rent && ((u.rent - u.market_rent) / u.market_rent) * 100 > aboveMkt) add('rent_above_market', `Rent ${u.rent} is ${r2(((u.rent - u.market_rent) / u.market_rent) * 100)}% above the roll's own market rent ${u.market_rent}; check it is sustainable.`, { severity: 'note' });
    if (/applicant|future|pending|rented/i.test(`${u.tenant} ${u.status}`) && u.vacant && u.rent) add('future_lease_not_occupied', `Vacant today with a future resident (${u.tenant || u.status}) at ${u.rent}; not counted as occupied.`, { severity: 'note' });
    if (f.length) push('rent_roll', String(u.unit), `${u.unit} ${u.tenant}`.trim(), f, { amount: u.rent });
  }
  const dupKeys = units.map((u) => str(u.unit).toLowerCase()); const dups = [...new Set(dupKeys.filter((k, i) => dupKeys.indexOf(k) !== i))];
  // T-12.
  const accts = monthlyByAccount(t12Rows, { natural: (x) => (startsWithAny(x, expP) ? 'debit' : 'credit') }); const months = [...new Set(accts.flatMap((a) => Object.keys(a.months)))].sort();
  const last = months[months.length - 1] || null;
  const isInc = (a) => startsWithAny(a.account, incP); const isExp = (a) => startsWithAny(a.account, expP);
  const isRent = (a) => (policy.rent_accounts ? policy.rent_accounts.includes(a.account) : isInc(a) && RENT_NAME.test(foldText(a.name)) && !NOT_RENT.test(a.name));
  const tot = (pred, m) => r2(accts.filter(pred).reduce((s, a) => s + (m ? a.months[m] || 0 : Object.values(a.months).reduce((t, v) => t + (v || 0), 0)), 0));
  const income = tot(isInc); const expenses = tot(isExp); const rentT12 = tot(isRent); const rentLast = last ? tot(isRent, last) : null;
  const t12f = [];
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
      if (filled.length >= 9) { const gaps = vals.filter(([, v]) => v === null || v === undefined || v === 0).map(([m]) => m); if (gaps.length && gaps.length <= 3 && !/turn|capital|capex|legal|bad debt/i.test(a.name)) f.push({ code: 'month_blank', detail: `No amount in ${gaps.join(', ')} for an account with ${filled.length} other months; an accrual may be missing.`, months: gaps }); }
    }
    if (isInc(a) && filled.some(([, v]) => v < 0) && isRent(a)) f.push({ code: 'negative_rent_month', detail: `Negative rent in ${filled.filter(([, v]) => v < 0).map(([m]) => m).join(', ')}.` });
    if (f.length) push('t12', a.account, `${a.account} ${a.name}`.trim(), f, { amount: r2(Object.values(a.months).reduce((t, v) => t + (v || 0), 0)) });
  }
  // Rent roll against the T-12.
  const rec = []; const gap = rentLast === null ? null : r2(sched - rentLast); const gapPct = rentLast ? r2((gap / sched) * 100) : null;
  if (rentLast !== null && sched && gapPct > gapTol) rec.push({ code: 'roll_above_collections', detail: `The rent roll schedules ${sched} a month for ${occupied.length} occupied unit(s); the T-12 shows ${rentLast} of rent income for ${last}, ${gap} (${gapPct}%) less. Ask for the ${last} receipts and the delinquency report.`, amount: gap });
  else if (rentLast !== null && sched && gapPct < -gapTol) rec.push({ code: 'collections_above_roll', detail: `The T-12 shows ${rentLast} of rent income for ${last}, ${-gap} more than the ${sched} the rent roll schedules; units may have left since, or the month includes back rent or prepayments.`, amount: gap, severity: 'note' });
  if (rentT12 && sched) { const ann = r2(sched * 12); rec.push({ code: 'annualized_vs_t12', detail: `Rent roll annualized: ${ann}; T-12 rent income: ${rentT12} (${Math.abs(r2(((ann - rentT12) / rentT12) * 100))}% ${ann >= rentT12 ? 'above' : 'below'}).`, severity: 'note', amount: r2(ann - rentT12) }); }
  if (dups.length) rec.push({ code: 'duplicate_units', detail: `Units listed more than once: ${dups.join(', ')}.` });
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
