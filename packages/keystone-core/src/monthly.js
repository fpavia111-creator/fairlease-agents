// Monthly amounts per account from a report with a column per month (a T-12, a budget)
// or one row per account and month (a GL or budget export).
import { periodKey, readNumber } from './intl.js';
import { isoDate, num, str, round2 } from './property.js';

const KNOWN = new Set(['property', 'account', 'account_name', 'date', 'period', 'description', 'vendor', 'debit', 'credit', 'amount', 'reference', 'budget', 'actual']);
const TOTAL_COL = /total|ytd|summe|gesamt|cumul|acumulado|totale|合計|合计|합계/i;

/**
 * Rows as [{ account, name, months: { 'YYYY-MM': amount|null } }].
 * value: the field to read on long rows ('amount' by default; falls back to credit − debit,
 * or debit − credit for accounts where natural(account) is 'debit', such as expenses).
 */
export function monthlyByAccount(rows, { value = 'amount', natural = () => 'credit' } = {}) {
  const acc = new Map();
  const get = (r) => { const a = str(r.account); if (!a || /^(total|net|noi)\b/i.test(a) || /^(total|net)\b/i.test(str(r.account_name))) return null; if (!acc.has(a)) acc.set(a, { account: a, name: str(r.account_name), months: {} }); const e = acc.get(a); if (!e.name && str(r.account_name)) e.name = str(r.account_name); return e; };
  for (const r of rows || []) {
    const e = get(r); if (!e) continue;
    const p = periodKey(r.period) || (isoDate(r.date) ? isoDate(r.date).slice(0, 7) : null);
    if (p) { const dc = (num(r.credit) || 0) - (num(r.debit) || 0); const v = num(r[value]) ?? (value === 'amount' && (num(r.credit) !== null || num(r.debit) !== null) ? (natural(e.account) === 'debit' ? -dc : dc) : null); if (v !== null) e.months[p] = round2((e.months[p] || 0) + v); else if (!(p in e.months)) e.months[p] = null; continue; }
    for (const [k, v] of Object.entries(r)) {
      if (KNOWN.has(k) || TOTAL_COL.test(k)) continue;
      const m = periodKey(k); if (!m) continue;
      const blank = v === null || v === undefined || String(v).trim() === '';
      const n = blank ? null : typeof v === 'number' ? v : readNumber(v);
      if (n !== null) e.months[m] = round2((e.months[m] || 0) + n); else if (!(m in e.months)) e.months[m] = null;
    }
  }
  return [...acc.values()];
}
