// Year-end 1099 readiness for vendors and owners: totals per payee against the threshold the user gives. Pure functions.
// Fairlease 1099 Filings makes no tax determination: the threshold, the excluded payment methods and the form are the user's (or their preparer's) call.
import { r2, num, str, isoDate, maskId as maskRaw, partyKey, foldText } from 'fairlease-core';

export const DEFAULT_EXCLUDE_METHODS = Object.freeze(['card', 'credit card', 'debit card', 'paypal', 'venmo', 'tarjeta', 'karte', 'carte', 'cartão', 'carta']);
const RENT_WORDS = ['rent', 'rents', 'lease', 'owner distribution', 'owner draw', 'miete', 'loyer', 'alquiler', 'renta', 'aluguel', 'affitto', '家賃', '賃料', '租金', '임대료', '임차료'];
const NOT_RENT_WORDS = ['commission', 'commissions', 'broker', 'brokerage', 'provision', 'comision', 'comissao', 'provvigione', '手数料', '佣金', '수수료'];
const LAW_WORDS = ['attorney', 'attorneys', 'law', 'legal', 'esq', 'lawyer', 'abogado', 'abogados', 'bufete', 'rechtsanwalt', 'kanzlei', 'avocat', 'advogado', 'avvocato', '弁護士', '律师', '변호사'];
const CORP_WORDS = ['corporation', 'corp', 'inc', 'incorporated', 'c corp', 's corp', 'c corporation', 's corporation', 'sociedad anonima', 'corporacion'];
const OWNER_WORDS = ['owner', 'landlord', 'propietario', 'eigentumer', 'proprietaire', 'proprietario', 'オーナー', '业主', '소유주'];

const maskId = (v) => { const d = str(v).replace(/\D/g, ''); return maskRaw(d || v); };
const fold = (s) => foldText(str(s)).toLowerCase();
const hasWord = (text, words) => { const t = ` ${fold(text).replace(/[^\p{L}\p{N}]+/gu, ' ')} `; return words.some((w) => { const f = fold(w); return /[぀-鿿가-힯]/.test(f) ? t.includes(f) : t.includes(` ${f} `); }); };
export const tinDigits = (v) => str(v).replace(/\D/g, '');
/** Format check only: nine digits, not all the same digit, not 123456789. Fairlease 1099 Filings never verifies a TIN with the IRS. */
export function tinProblem(v) {
  const s = str(v); if (!s) return 'missing';
  const d = tinDigits(s);
  if (d.length !== 9 || /[^\d\s-]/.test(s)) return 'not nine digits';
  if (/^(\d)\1{8}$/.test(d) || d === '123456789') return 'placeholder number';
  return null;
}
/** Reads a directory 1099 flag: true, false, 'NEC', 'MISC' or null when the column is blank. */
export function flag1099(v) {
  const s = fold(v); if (!s) return null;
  if (/misc/.test(s)) return 'MISC'; if (/nec/.test(s)) return 'NEC';
  if (/^(no|n|false|0|none|exempt|nein|non|não|nao)$/.test(s)) return false;
  if (/^(yes|y|true|1|si|sí|ja|oui|sim)$/.test(s) || /1099|box/.test(s)) return true;
  return null;
}
const yesNo = (v) => { const s = fold(v); if (!s) return null; if (/^(no|n|false|0|nein|non|não|nao)$/.test(s)) return false; if (/^(yes|y|true|1|si|sí|ja|oui|sim|on file|received)$/.test(s)) return true; return null; };

export function checkFilings({ vendors = [], payments, taxYear, threshold, excludeMethods = DEFAULT_EXCLUDE_METHODS }) {
  if (!(threshold >= 0)) throw new Error('threshold is required: give the reporting threshold your tax preparer uses for this tax year');
  const year = String(taxYear);
  // Directory records, grouped by TIN when it has nine digits, otherwise by name.
  const records = vendors.map((v, i) => ({ i, name: str(v.vendor), id: str(v.vendor_id), tin: str(v.tax_id), digits: tinDigits(v.tax_id), trade: str(v.trade), address: str(v.address), email: str(v.email), entity: str(v.entity_type), flag: flag1099(v.type_1099), w9: yesNo(v.w9_on_file) }));
  const groups = new Map();
  for (const r of records) {
    const k = r.digits.length === 9 && !tinProblem(r.tin) ? `tin:${r.digits}` : `name:${partyKey(r.name)}`;
    if (!groups.has(k)) groups.set(k, { key: k, records: [], payments: [], excluded: [], undated: 0, other_years: 0 });
    groups.get(k).records.push(r);
  }
  const recGroup = new Map(); for (const g of groups.values()) for (const r of g.records) recGroup.set(r, g);
  const byParty = new Map(); const byId = new Map();
  for (const r of records) { const pk = partyKey(r.name); if (pk && !byParty.has(pk)) byParty.set(pk, r); const fid = r.id ? fold(r.id) : ''; if (r.id && !byId.has(fid)) byId.set(fid, r); }
  // The first directory record that matches by name or by vendor id, as a scan in file order would find it.
  const findRecord = (payee) => { const pk = partyKey(payee); const a = pk ? byParty.get(pk) : undefined; const b = byId.get(fold(payee)); return a && b ? (a.i <= b.i ? a : b) : a || b; };
  const tinsByName = new Map(); for (const r of records) { const pk = partyKey(r.name); if (!pk || r.digits.length !== 9) continue; if (!tinsByName.has(pk)) tinsByName.set(pk, new Set()); tinsByName.get(pk).add(r.digits); }
  const outside = new Map(); let otherYear = 0; let undated = 0; let noPayee = 0; const methodsSeen = new Set();
  for (const p of payments) {
    const amount = num(p.amount); if (amount === null) continue;
    if (!str(p.payee)) { noPayee += 1; continue; }
    const d = isoDate(p.date);
    if (!d) { undated += 1; continue; }
    if (d.slice(0, 4) !== year) { otherYear += 1; continue; }
    const rec = findRecord(p.payee);
    let g;
    if (rec) g = recGroup.get(rec);
    else { const k = `new:${partyKey(p.payee)}`; if (!outside.has(k)) outside.set(k, { key: k, records: [], name: str(p.payee), payments: [], excluded: [] }); g = outside.get(k); }
    const method = str(p.method); if (method) methodsSeen.add(method);
    const row = { date: d, amount, method, account: str(p.account), reference: str(p.reference) };
    (method && hasWord(method, excludeMethods) ? g.excluded : g.payments).push(row);
  }
  const items = [];
  for (const g of [...groups.values(), ...outside.values()]) {
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const total = r2(g.payments.reduce((s, x) => s + x.amount, 0)); const excluded = r2(g.excluded.reduce((s, x) => s + x.amount, 0));
    if (!g.payments.length && !g.excluded.length) continue;
    const recs = g.records; const main = recs[0] || null; const name = main ? main.name : g.name;
    const over = total >= threshold;
    const tin = main ? main.tin : ''; const tinIssue = main ? tinProblem(tin) : 'missing';
    const address = recs.map((r) => r.address).find(Boolean) || '';
    const email = recs.map((r) => r.email).find(Boolean) || '';
    const flags = recs.map((r) => r.flag).filter((f) => f !== null);
    const trade = recs.map((r) => r.trade).find(Boolean) || '';
    const entity = recs.map((r) => r.entity).find(Boolean) || '';
    const text = `${name} ${trade}`;
    const law = hasWord(text, LAW_WORDS);
    const corp = hasWord(entity, CORP_WORDS) || hasWord(name.replace(/[.,]/g, ' '), ['inc', 'corp', 'corporation', 'incorporated']);
    const rentPaid = r2(g.payments.filter((x) => hasWord(x.account, RENT_WORDS) && !hasWord(x.account, NOT_RENT_WORDS)).reduce((s, x) => s + x.amount, 0));
    const owner = hasWord(trade, OWNER_WORDS) || (rentPaid > 0 && rentPaid >= total / 2);
    const form = flags.includes('MISC') || owner ? 'MISC' : 'NEC';
    const directorySaysNo = flags.length > 0 && flags.every((f) => f === false);
    if (!main) add('payee_not_in_directory', `Paid ${total}${excluded ? ` (plus ${excluded} by excluded methods)` : ''} in ${year} but not in the vendor directory, so there is no tax ID or address on file.`);
    if (recs.length > 1) add('shared_tin', `${recs.length} directory records share tax ID ${maskId(tin)}: ${recs.map((r) => r.name).join('; ')}. Their payments are added together for the threshold; confirm they are one payee and merge the records.`);
    if (main && tinIssue) add(tinIssue === 'missing' ? 'tin_missing' : 'tin_invalid', tinIssue === 'missing' ? 'No tax ID in the directory.' : `Tax ID ${maskId(tin)} fails the format check (${tinIssue}).`);
    if (main && !address) add('address_missing', 'No mailing address in the directory.');
    if (main && recs.some((r) => r.w9 === false)) add('w9_missing', 'The directory says no W-9 is on file.');
    if (directorySaysNo && over) add('directory_says_no_1099', `The directory marks this payee as not receiving a 1099, but ${total} was paid${corp ? ' (entity looks like a corporation)' : ''}. Confirm with your tax preparer.`);
    if (law && over) add('attorney', 'Looks like a law firm: attorney fees are often reported even when the firm is a corporation. Confirm with your tax preparer.');
    else if (corp && over && !directorySaysNo) add('corporation', 'Looks like a corporation: payments to corporations are often not reported. Confirm with your tax preparer.');
    const sameName = main ? tinsByName.get(partyKey(main.name)) : null;
    if (sameName && sameName.size > 1) add('same_name_different_tin', `${sameName.size} directory records are named "${main.name}" with different tax IDs; payments by name all went to the first one. Confirm which record each payment belongs to.`);
    const seenPay = new Map(); for (const x of g.payments) { if (!x.reference) continue; const k = `${x.date}|${x.amount}|${fold(x.reference)}`; seenPay.set(k, (seenPay.get(k) || 0) + 1); }
    const dups = [...seenPay].filter(([, n]) => n > 1);
    if (dups.length) add('possible_duplicate_payments', `${dups.length} payment(s) appear more than once with the same date, amount and reference (${dups.map(([k]) => k.split('|').slice(0, 2).join(' ')).join('; ')}); remove the repeats before relying on the total.`, { amount: r2(dups.reduce((t, [k, n]) => t + Number(k.split('|')[1]) * (n - 1), 0)) });
    const other = r2(total - rentPaid);
    if (rentPaid > 0 && other > 0 && over) add('rent_and_services', `${rentPaid} of rent and ${other} of other payments: these are usually reported in different places. Confirm with your tax preparer.`);
    if (owner && over && hasWord(trade, OWNER_WORDS)) add('owner_rents_basis', `${total} is what was paid out to this owner. A 1099 for rents usually reports the rents collected for the owner, not the distributions; take that figure from the owner statements and confirm with your tax preparer.`);
    if (excluded) add('excluded_methods', `${excluded} paid by ${[...new Set(g.excluded.map((x) => x.method))].join(', ')} left out of the total (excluded payment methods).`);
    const blocking = ['payee_not_in_directory', 'shared_tin', 'tin_missing', 'tin_invalid', 'address_missing', 'w9_missing', 'same_name_different_tin', 'possible_duplicate_payments'];
    const ask = findings.some((f) => ['owner_rents_basis', 'rent_and_services'].includes(f.code));
    const status = !over ? (total === 0 ? 'excluded_only' : 'below_threshold') : directorySaysNo && !law ? 'confirm' : findings.some((f) => blocking.includes(f.code)) ? 'fix' : law || corp || ask ? 'confirm' : 'ready';
    items.push({ payee: name, vendor_id: main ? main.id || null : null, records: recs.map((r) => r.name), tin: tin ? maskId(tin) : '', address: address || null, email: email || null, trade, total, excluded, payments: g.payments.length, rent: rentPaid, form: over ? form : null, status, findings });
  }
  const order = { fix: 0, confirm: 1, ready: 2, below_threshold: 3, excluded_only: 4 };
  items.sort((a, b) => order[a.status] - order[b.status] || b.total - a.total || a.payee.localeCompare(b.payee));
  const n = (s) => items.filter((i) => i.status === s).length;
  const reportable = items.filter((i) => ['fix', 'confirm', 'ready'].includes(i.status));
  const summary = `${items.length} payee(s) paid in ${year}. ${reportable.length} at or above your ${threshold} threshold (${r2(reportable.reduce((s, i) => s + i.total, 0))}): ${n('ready')} ready, ${n('fix')} to fix, ${n('confirm')} to confirm with your tax preparer. ${n('below_threshold')} below the threshold${n('excluded_only') ? `, ${n('excluded_only')} paid only by excluded methods` : ''}.${undated ? ` ${undated} payment(s) had no readable date and were skipped.` : ''}${noPayee ? ` ${noPayee} payment(s) had no payee and were skipped.` : ''}${otherYear ? ` ${otherYear} payment(s) outside ${year} ignored.` : ''}`;
  return { summary, tax_year: Number(year), threshold, exclude_methods: [...excludeMethods], methods_seen: [...methodsSeen], skipped_undated: undated, skipped_no_payee: noPayee, other_year_payments: otherYear, items };
}

/** W-9 request for a payee. Never contains a tax ID. */
export function w9RequestText(it, a = {}) {
  const asks = [];
  for (const f of it.findings) {
    if (['tin_missing', 'tin_invalid', 'payee_not_in_directory', 'w9_missing'].includes(f.code)) asks.push('a completed and signed Form W-9 with your legal name, tax classification and taxpayer identification number');
    if (f.code === 'address_missing') asks.push('your current mailing address');
    if (f.code === 'shared_tin') asks.push('confirmation of the legal name that goes with your taxpayer identification number');
  }
  const list = [...new Set(asks)];
  return `**To:** ${a.to || it.email || '[TO CONFIRM: payee email or address]'}

# Request for Form W-9

Dear ${it.payee},

We are preparing year-end information returns for ${a.payer || '[TO CONFIRM: payer name]'}. To finish our records for tax year ${a.tax_year || '[TO CONFIRM: year]'}, please send:

${(list.length ? list : ['a current Form W-9']).map((x) => `- ${x}`).join('\n')}

Please return it by ${a.reply_by || '[TO CONFIRM: date]'} through ${a.secure_channel || '[TO CONFIRM: secure upload link or mailing address; do not ask for tax IDs by plain email]'}.

Thank you,

${a.from || '[TO CONFIRM: your name and contact]'}
`;
}
