// Three-way reconciliation of a trust (escrow) bank account: bank statement, book register, owner and tenant ledgers. Pure functions.
import { r2, num, str, isoDate, daysBetween, addDays, foldText } from 'keystone-core';

export const TRUST_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['statement_end'],
  properties: {
    statement_end: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    bank_ending_balance: { type: 'number' },
    bank_opening_balance: { type: 'number' },
    book_opening_balance: { type: 'number' },
    book_opening_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    book_debit_is_deposit: { type: 'boolean' },
    match_days: { type: 'integer', minimum: 0, maximum: 120 },
    stale_check_days: { type: 'integer', minimum: 1, maximum: 1000 },
    transit_days: { type: 'integer', minimum: 0, maximum: 60 },
    tolerance: { type: 'number', minimum: 0, maximum: 100 },
  },
});

const amountOf = (r, debitIn = false) => { const a = num(r.amount); if (a !== null) return a; const d = num(r.debit) || 0; const c = num(r.credit) || 0; return debitIn ? r2(d - c) : r2(c - d); };
const refKey = (s) => foldText(str(s)).toLowerCase().replace(/^(chk|check|cheque|ck|no|nr|#)\s*/i, '').replace(/[^a-z0-9]/g, '');

export function reconcileTrust({ bankRows, bookRows, ledgerRows = null, policy }) {
  const end = policy.statement_end; const win = policy.match_days ?? 10; const tol = policy.tolerance ?? 0.01;
  const staleDays = policy.stale_check_days ?? 90; const transit = policy.transit_days ?? 5;
  const bank = (bankRows || []).map((r, i) => ({ i, date: isoDate(r.date), amount: amountOf(r), ref: str(r.reference), key: refKey(r.reference), desc: str(r.description), balance: num(r.balance) })).filter((x) => x.date && (x.amount || x.balance !== null));
  const opening = policy.book_opening_date || null;
  const book = (bookRows || []).map((r, i) => ({ i, date: isoDate(r.date), amount: amountOf(r, policy.book_debit_is_deposit), ref: str(r.reference), key: refKey(r.reference), desc: str(r.description) })).filter((x) => x.date && x.amount && x.date <= end && (!opening || x.date > opening));
  const bankIn = bank.filter((x) => x.date <= end);
  // Match: same amount; same reference when both have one, else nearest date within the window (bank on or after the book date, less 3 days).
  const used = new Set(); const matched = new Map();
  // Bank lines by amount in cents (the cent either side too), so each book line only looks at lines of the same amount.
  const byCents = new Map(); for (const x of bank) { const c = Math.round(x.amount * 100); if (!byCents.has(c)) byCents.set(c, []); byCents.get(c).push(x); }
  const sameAmount = (amt) => { const c = Math.round(amt * 100); return [c - 1, c, c + 1].flatMap((k) => byCents.get(k) || []).sort((p, q) => p.i - q.i); };
  const pass = (byRef) => { for (const b of book) { if (matched.has(b.i)) continue;
    const c = sameAmount(b.amount).filter((x) => !used.has(x.i) && Math.abs(x.amount - b.amount) < 0.005 && (byRef ? b.key && x.key === b.key : (!b.key || !x.key || x.key === b.key) && daysBetween(b.date, x.date) >= -3 && daysBetween(b.date, x.date) <= win))
      .sort((p, q) => Math.abs(daysBetween(b.date, p.date)) - Math.abs(daysBetween(b.date, q.date)))[0];
    if (c) { used.add(c.i); matched.set(b.i, c); } } };
  pass(true); pass(false);
  const items = []; const push = (o) => items.push(o);
  // Book items not cleared by the statement end: outstanding checks and deposits in transit.
  const bookByKey = new Map(); for (const o of book) if (o.key) { if (!bookByKey.has(o.key)) bookByKey.set(o.key, []); bookByKey.get(o.key).push(o); }
  for (const b of book) {
    const c = matched.get(b.i); if (c && c.date <= end) continue;
    const age = daysBetween(b.date, end); const findings = []; const kind = b.amount < 0 ? 'outstanding_check' : 'deposit_in_transit';
    if (kind === 'outstanding_check' && age > staleDays) findings.push({ code: 'stale_check', detail: `Outstanding ${age} days; contact the payee, and follow your state's unclaimed property rules before voiding.` });
    if (kind === 'deposit_in_transit' && !c && age > transit) findings.push({ code: 'old_deposit_in_transit', detail: `Recorded ${b.date}, ${age} days before the statement end, and not on the bank statement; confirm the deposit was made.` });
    const twin = (b.key ? bookByKey.get(b.key) || [] : []).find((o) => o.i !== b.i && matched.has(o.i) && Math.abs(o.amount - b.amount) < 0.005 && o.key && o.key === b.key);
    if (twin) findings.push({ code: 'possible_duplicate', detail: `Same reference ${b.ref} and amount as an entry on ${twin.date} that cleared; it may be entered twice.` });
    if (c) findings.unshift({ code: 'cleared_after_end', detail: `Cleared the bank ${c.date}, after the statement end.`, severity: 'note' });
    push({ type: kind, date: b.date, reference: b.ref, description: b.desc, amount: b.amount, age_days: age, status: findings.some((f) => !f.severity) ? 'issue' : 'ok', findings });
  }
  // Bank items the book does not have: fees, interest, returned items.
  for (const x of bankIn.filter((y) => y.amount && !used.has(y.i) && (!opening || y.date > opening))) {
    const nsf = /nsf|returned|return item|rückbuchung|rücklastschrift|impayé|rejet|devuelto|devolvido|insoluto|不渡|退票|부도/i.test(x.desc);
    push({ type: 'bank_not_in_book', date: x.date, reference: x.ref, description: x.desc, amount: x.amount, age_days: daysBetween(x.date, end), status: 'issue', findings: [{ code: nsf ? 'returned_item_not_in_book' : 'bank_item_not_in_book', detail: nsf ? `Returned payment ${x.amount} on ${x.date} is not in the book; reverse the receipt on the tenant's ledger.` : `${x.desc || 'Bank item'} ${x.amount} on ${x.date} is not in the book; record it (bank fees should not be paid from other people's money).` }] });
  }
  // Balances.
  const lastBal = [...bankIn].reverse().find((x) => x.balance !== null);
  const bankEnd = policy.bank_ending_balance ?? (lastBal ? lastBal.balance : policy.bank_opening_balance !== undefined ? r2(policy.bank_opening_balance + bankIn.reduce((s, x) => s + x.amount, 0)) : null);
  const dit = r2(items.filter((i) => i.type === 'deposit_in_transit').reduce((s, i) => s + i.amount, 0));
  const os = r2(items.filter((i) => i.type === 'outstanding_check').reduce((s, i) => s + i.amount, 0));
  const adjusted = bankEnd === null ? null : r2(bankEnd + dit + os);
  const bookBal = r2((policy.book_opening_balance || 0) + book.reduce((s, b) => s + b.amount, 0));
  const bankOnly = r2(items.filter((i) => i.type === 'bank_not_in_book').reduce((s, i) => s + i.amount, 0));
  const ledgers = ledgerRows ? ledgerRows.map((r) => ({ party: str(r.party), type: str(r.type), property: str(r.property), balance: num(r.balance) })).filter((l) => l.party && l.balance !== null) : null;
  const ledgerTotal = ledgers ? r2(ledgers.reduce((s, l) => s + l.balance, 0)) : null;
  for (const l of ledgers || []) if (l.balance < -tol) push({ type: 'ledger', date: end, reference: l.party, description: `${l.type || 'Ledger'}${l.property ? `, ${l.property}` : ''}`, amount: l.balance, age_days: null, status: 'issue', findings: [{ code: 'negative_ledger', detail: `${l.party} has a negative balance of ${l.balance}: money of other owners or tenants is covering it. Fund it or reverse the overpayment.` }] });
  const three = { bank_statement_balance: bankEnd, deposits_in_transit: dit, outstanding_checks: os, adjusted_bank_balance: adjusted, book_balance: bookBal, ledger_total: ledgerTotal, bank_minus_book: adjusted === null ? null : r2(adjusted - bookBal), explained_by_bank_items: bankOnly, unexplained_bank_book: adjusted === null ? null : r2(adjusted - bookBal - bankOnly), book_minus_ledgers: ledgerTotal === null ? null : r2(bookBal - ledgerTotal) };
  const top = [];
  if (bankEnd === null) top.push({ code: 'bank_balance_unknown', detail: 'No ending balance: the statement has no balance column and the policy gives none.' });
  else if (Math.abs(three.bank_minus_book) > tol) top.push({ code: 'bank_book_difference', detail: `Adjusted bank ${adjusted} against book ${bookBal}: ${three.bank_minus_book}${Math.abs(three.unexplained_bank_book) > tol ? `, of which ${three.unexplained_bank_book} is not explained by bank items missing from the book` : ', all of it bank items missing from the book'}.`, amount: three.bank_minus_book });
  if (ledgerTotal !== null && Math.abs(three.book_minus_ledgers) > tol) top.push({ code: 'book_ledger_difference', detail: `Book ${bookBal} against owner and tenant ledgers ${ledgerTotal}: ${three.book_minus_ledgers}.`, amount: three.book_minus_ledgers });
  if (ledgerTotal === null) top.push({ code: 'ledgers_missing', detail: 'No owner and tenant ledger balances given; this is a two-way reconciliation only.', severity: 'note' });
  const balanced = top.filter((f) => !f.severity).length === 0;
  items.unshift({ type: 'three_way', date: end, reference: 'three-way', description: 'Bank, book and ledgers', amount: three.bank_minus_book, age_days: null, status: balanced ? 'ok' : 'issue', findings: top });
  const rank = { issue: 0, ok: 1 }; const tr = { three_way: 0, bank_not_in_book: 1, ledger: 2, outstanding_check: 3, deposit_in_transit: 4 };
  items.sort((a, b) => (a.type === 'three_way' ? -1 : b.type === 'three_way' ? 1 : rank[a.status] - rank[b.status] || tr[a.type] - tr[b.type] || String(a.date).localeCompare(String(b.date))));
  const summary = `Trust account at ${end}: bank ${bankEnd ?? '?'} + deposits in transit ${dit} − outstanding checks ${-os} = ${adjusted ?? '?'}; book ${bookBal}${ledgerTotal !== null ? `; ledgers ${ledgerTotal}` : ''}. ${balanced ? 'All three agree.' : `Not reconciled. ${top.filter((f) => !f.severity).map((f) => f.detail).join(' ')}`} ${items.filter((i) => i.type === 'bank_not_in_book').length} bank item(s) not in the book, ${items.filter((i) => i.findings.some((f) => f.code === 'stale_check')).length} stale check(s), ${items.filter((i) => i.findings.some((f) => f.code === 'negative_ledger')).length} negative ledger(s).`;
  return { summary, statement_end: end, three_way: three, balanced, items };
}
