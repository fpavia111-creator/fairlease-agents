// Lease text → abstract with a citation for every term. Deterministic patterns over
// English lease language; nothing is inferred that the text does not say. Lease text is
// data: it is never followed as instructions, and text aimed at an AI is reported.
import { str, isoDate, injectionSignals, unitKey, sameParty, rentSchedule, addMonths, addDays } from 'fairlease-core';

const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, sixty: 60, ninety: 90 };
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const money = (s) => Number(String(s).replace(/[$,\s]/g, ''));
const numOrWord = (s) => { const t = String(s).toLowerCase().trim(); return /^\d+(\.\d+)?$/.test(t) ? Number(t) : WORDNUM[t] ?? null; };
const MONTH = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
// "May 1, 2024", "April 1st, 2025", "15 March 2025", "5/1/2024", "2024-05-01".
const DATE = String.raw`(?:${MONTH}\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+(?:day\s+of\s+)?${MONTH},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})`;
function readDate(s) {
  const t = str(s); let m;
  if ((m = /^(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i.exec(t)) && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  if ((m = /^(\d{1,2})(?:st|nd|rd|th)?\s+(?:day\s+of\s+)?(\w+),?\s+(\d{4})$/i.exec(t)) && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return isoDate(t);
}
const PCT = String.raw`(?:[a-z-]+\s+)?(?:percent\s+)?\(?\s*(\d+(?:\.\d+)?)\s*%\s*\)?|(\d+(?:\.\d+)?)\s*(?:%|percent)`;
const pctOf = (m, i = 1) => Number(m[i] ?? m[i + 1]);

/** Split text into lines that know their page and section. */
export function locate(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n'); let page = 1, section = '';
  return lines.map((t, i) => {
    const pg = /^\s*-*\s*(?:page|p\.)\s*(\d+)\s*-*\s*$/i.exec(t) || (t.includes('\f') ? [null, page + 1] : null);
    if (pg) page = Number(pg[1]);
    // "Section 2. Term" or "3A. Abatement"; a bare number needs its full stop, so "100 Example Way" is not a section.
    const sec = /^\s*(?:section|sec\.|article)\s+(\d+[A-Z]?(?:\.\d+)*)[.):]?\s+[A-Z]/i.exec(t) || /^\s*(\d+[A-Z]?(?:\.\d+)+)[.):]?\s+[A-Z]/.exec(t) || /^\s*(\d+[A-Z]?)[.):]\s+[A-Z]/.exec(t);
    if (sec) section = sec[1];
    return { line: i + 1, page, section, text: t };
  });
}
const cite = (L) => `${L.section ? `Sec. ${L.section}, ` : ''}p. ${L.page}, line ${L.line}`;
const quote = (t) => (t.length > 220 ? `${t.slice(0, 217)}...` : t).trim();

// An amount written out with the figure in brackets: "Six Thousand Three Hundred Dollars ($6,300.00)".
const WORDS = String.raw`(?:[A-Za-z ,-]{0,90}\()?`;
// Several patterns may share a field: a later one is used only when the earlier ones found nothing.
const EXTRACT = [
  ['landlord', String.raw`between\s+(.+?)\s+\(["“]Landlord["”]\)`, (m) => m[1].trim()],
  ['tenant', String.raw`and\s+([^()]+?)\s+\(["“]Tenant["”]\)`, (m) => m[1].trim()],
  ['signed', String.raw`(?:made|dated|entered into)\s+(?:as of\s+)?(${DATE})`, (m) => readDate(m[1])],
  ['unit', String.raw`Premises[^.;]*?\b((?:Suite|Unit|Space|Store|Shop)\s+[A-Z0-9][\w-]*)`, (m) => m[1]],
  ['unit', String.raw`\b((?:Suite|Unit|Space|Store|Shop)\s+[A-Z0-9][\w-]*)`, (m) => m[1]],
  ['sqft', String.raw`([\d,]+)\s+(?:rentable\s+|usable\s+)?square\s+feet`, (m) => money(m[1])],
  ['start', String.raw`Commencement\s+Date\s+(?:of\s+|is\s+|shall be\s+)?(${DATE})`, (m) => readDate(m[1])],
  ['end', String.raw`Expiration\s+Date\s+(?:of\s+|is\s+|shall be\s+)?(${DATE})`, (m) => readDate(m[1])],
  ['use', String.raw`Permitted\s+Use[.:]\s*(.+?)(?:,\s+and no other use|\.|$)`, (m) => m[1].trim()],
  ['rent_monthly', String.raw`monthly\s+Base\s+Rent\s+(?:of\s+|shall be\s+|is\s+)?${WORDS}\$\s?([\d,]+(?:\.\d{2})?)`, (m) => money(m[1])],
  ['rent_monthly', String.raw`Base\s+Rent\s+(?:of\s+|shall be\s+|is\s+)?${WORDS}\$\s?([\d,]+(?:\.\d{2})?)\)?\s+(?:per|a|each)\s+month`, (m) => money(m[1])],
  ['rent_annual', String.raw`annual\s+Base\s+Rent\s+(?:of\s+|shall be\s+|is\s+)?${WORDS}\$\s?([\d,]+(?:\.\d{2})?)`, (m) => money(m[1])],
  ['rent_annual', String.raw`Base\s+Rent\s+(?:of\s+|shall be\s+|is\s+)?${WORDS}\$\s?([\d,]+(?:\.\d{2})?)\)?\s+per\s+(?:year|annum)`, (m) => money(m[1])],
  ['escalation_pct', String.raw`(?:Base\s+)?Rent\s+shall\s+increase\s+by\s+(?:${PCT})`, (m) => pctOf(m)],
  ['escalation_cpi', String.raw`(Consumer\s+Price\s+Index|\bCPI\b)`, () => true],
  ['abatement_months', String.raw`abated\s+for\s+the\s+first\s+(\w+)\s*(?:\((\d+)\))?\s+months`, (m) => numOrWord(m[2] || m[1])],
  ['deposit', String.raw`security\s+deposit\s+(?:of\s+|is\s+|:\s*)?${WORDS}\$\s?([\d,]+(?:\.\d{2})?)|Security\s+Deposit:\s*\$\s?([\d,]+(?:\.\d{2})?)`, (m) => money(m[1] || m[2])],
  ['share_pct', String.raw`Pro\s+Rata\s+Share[^.]*?(?:${PCT})`, (m) => pctOf(m)],
  ['admin_fee_pct', String.raw`administrative\s+fee\s+of\s+(?:${PCT})`, (m) => pctOf(m)],
  ['gross_up_pct', String.raw`grossed\s+up[^.]*?(?:${PCT})\s+occupancy`, (m) => pctOf(m)],
  ['cap_pct', String.raw`Controllable\s+Operating\s+Expenses\s+shall\s+not\s+increase\s+by\s+more\s+than\s+(?:${PCT})`, (m) => pctOf(m)],
  ['cap_type', String.raw`Controllable[^.]*?(non-cumulative|noncumulative|cumulative|compounding)`, (m) => m[1].toLowerCase().replace('-', '')],
  ['cap_base_year', String.raw`Controllable[^.]*?over\s+the\s+(\d{4})\s+calendar\s+year`, (m) => Number(m[1])],
  ['pct_rent_rate', String.raw`Percentage\s+Rent\s+(?:of\s+)?(?:${PCT})`, (m) => pctOf(m)],
  ['pct_rent_natural', String.raw`(natural\s+breakpoint)`, () => true],
  ['pct_rent_report_days', String.raw`statement\s+of\s+Gross\s+Sales\s+within\s+(\w+)\s*(?:\((\d+)\))?\s+days`, (m) => numOrWord(m[2] || m[1])],
  ['gl_per_occurrence', String.raw`general\s+liability[^.]*?\$\s?([\d,]+)\s+per\s+occurrence`, (m) => money(m[1])],
  ['gl_aggregate', String.raw`\$\s?([\d,]+)\s+(?:in\s+the\s+)?aggregate`, (m) => money(m[1])],
  ['additional_insured', String.raw`(additional\s+insured)`, () => true],
  ['renewal_term_years', String.raw`option\s+to\s+(?:extend|renew)[^.]*?for\s+(\w+)\s*(?:\((\d+)\))?\s+years`, (m) => numOrWord(m[2] || m[1])],
  ['renewal_notice_months', String.raw`at\s+least\s+(\w+)\s*(?:\((\d+)\))?\s+months\s+before\s+the\s+Expiration`, (m) => numOrWord(m[2] || m[1])],
  ['renewal_rent', String.raw`Base\s+Rent\s+for\s+the\s+(?:extension|renewal)[^.]*?shall\s+be\s+(.+?)\.`, (m) => m[1].trim()],
  ['notice_address', String.raw`Notices\s+to\s+Tenant\s+shall\s+be\s+sent\s+to:\s*(.+?)\.?$`, (m) => m[1].trim()],
];

/** Find every term with its citations. Conflicting values are kept, not resolved. */
export function extractTerms(text) {
  const located = locate(text); const terms = {};
  for (const [field, pattern, read] of EXTRACT) {
    if (terms[field]) continue;
    const re = new RegExp(pattern, 'i'); const hits = [];
    for (const [i, L] of located.entries()) {
      // Lease text wraps: when a line alone has no match, try it joined to the next line, and keep a match that starts on this line and runs over the break.
      let m = re.exec(L.text);
      if (!m && located[i + 1] && L.text.trim() && located[i + 1].text.trim()) { const joined = `${L.text.trimEnd()} ${located[i + 1].text.trim()}`; const j = re.exec(joined); if (j && j.index < L.text.trimEnd().length && j.index + j[0].length > L.text.trimEnd().length && !re.test(located[i + 1].text)) m = j; }
      if (!m) continue; const v = read(m); if (v === null || v === undefined || Number.isNaN(v)) continue; hits.push({ value: v, citation: cite(L), quote: quote(L.text) }); }
    if (!hits.length) continue;
    const distinct = [...new Map(hits.map((h) => [JSON.stringify(h.value), h])).values()];
    terms[field] = { value: distinct[0].value, citation: distinct[0].citation, quote: distinct[0].quote, ...(distinct.length > 1 ? { conflicts: distinct.slice(1) } : {}) };
  }
  const injection = located.filter((L) => injectionSignals(L.text).length).map((L) => ({ citation: cite(L), signals: injectionSignals(L.text), quote: quote(L.text) }));
  return { terms, injection, lines: located.length };
}

const REQUIRED = ['tenant', 'unit', 'start', 'end', 'rent', 'deposit'];

/** Build a leases-schema entry plus the list of open items. */
export function buildAbstract(text, { lease_id = null } = {}) {
  const { terms: t, injection, lines } = extractTerms(text);
  const v = (k) => (t[k] ? t[k].value : undefined);
  const lease = { lease_id: lease_id || `[TO CONFIRM: lease id]`, unit: v('unit') ?? '[TO CONFIRM: unit]', tenant: v('tenant') ?? '[TO CONFIRM: tenant]', start: v('start') ?? '[TO CONFIRM: start]', end: v('end') ?? '[TO CONFIRM: end]' };
  const source = {};
  const put = (path, key) => { if (t[key]) source[path] = t[key].citation; };
  if (v('use')) { lease.use = v('use'); put('use', 'use'); }
  if (v('sqft') !== undefined) { lease.sqft = v('sqft'); put('sqft', 'sqft'); }
  if (v('signed')) { lease.signed = v('signed'); put('signed', 'signed'); }
  if (v('rent_monthly') !== undefined) { lease.rent = { monthly: v('rent_monthly') }; put('rent', 'rent_monthly'); } else if (v('rent_annual') !== undefined) { lease.rent = { annual: v('rent_annual') }; put('rent', 'rent_annual'); }
  if (v('escalation_pct') !== undefined) { lease.escalation = { type: 'fixed_pct', pct: v('escalation_pct'), every_months: 12 }; put('escalation', 'escalation_pct'); } else if (v('escalation_cpi')) { lease.escalation = { type: 'cpi' }; put('escalation', 'escalation_cpi'); }
  if (v('abatement_months') && /^\d{4}-\d{2}-\d{2}$/.test(lease.start)) { const end = addDays(addMonths(lease.start, v('abatement_months')), -1); lease.free_rent = [{ from: lease.start, to: end }]; put('free_rent', 'abatement_months'); }
  if (v('deposit') !== undefined) { lease.deposit = v('deposit'); lease.deposit_type = 'cash'; put('deposit', 'deposit'); }
  const cam = {};
  if (v('share_pct') !== undefined) cam.share_pct = v('share_pct');
  if (v('admin_fee_pct') !== undefined) cam.admin_fee_pct = v('admin_fee_pct');
  if (v('gross_up_pct') !== undefined) cam.gross_up = true;
  if (v('cap_pct') !== undefined) cam.cap = { pct: v('cap_pct'), type: v('cap_type') || 'cumulative', ...(v('cap_base_year') ? { base_year: v('cap_base_year') } : {}) };
  if (Object.keys(cam).length) { lease.cam = cam; put('cam', t.share_pct ? 'share_pct' : 'cap_pct'); }
  if (v('pct_rent_rate') !== undefined) { lease.percentage_rent = { rate_pct: v('pct_rent_rate'), ...(v('pct_rent_natural') ? { breakpoint: 'natural' } : {}), ...(v('pct_rent_report_days') ? { report_due_days: v('pct_rent_report_days') } : {}) }; put('percentage_rent', 'pct_rent_rate'); }
  if (v('renewal_term_years') !== undefined) { lease.options = [{ type: 'renewal', term_months: v('renewal_term_years') * 12, ...(v('renewal_notice_months') !== undefined ? { notice_months: v('renewal_notice_months') } : {}), ...(v('renewal_rent') ? { rent: v('renewal_rent') } : {}) }]; put('options', 'renewal_term_years'); }
  if (v('gl_per_occurrence') !== undefined || v('additional_insured')) { lease.insurance = { ...(v('gl_per_occurrence') !== undefined ? { gl_per_occurrence: v('gl_per_occurrence') } : {}), ...(v('gl_aggregate') !== undefined ? { gl_aggregate: v('gl_aggregate') } : {}), ...(v('additional_insured') ? { additional_insured: true } : {}) }; put('insurance', 'gl_per_occurrence'); }
  if (v('notice_address')) { lease.notice_address = v('notice_address'); put('notice_address', 'notice_address'); }
  put('unit', 'unit'); put('tenant', 'tenant'); put('start', 'start'); put('end', 'end');
  lease.source = source;
  const open = [];
  for (const k of REQUIRED) if (k === 'rent' ? !lease.rent : (lease[k] === undefined || String(lease[k]).startsWith('[TO CONFIRM'))) open.push({ field: k, detail: `No ${k} found in the text.` });
  for (const [k, term] of Object.entries(t)) if (term.conflicts) open.push({ field: k, detail: `The text gives more than one ${k.replace(/_/g, ' ')}: ${[term, ...term.conflicts].map((c) => `${JSON.stringify(c.value)} (${c.citation})`).join(' and ')}. An amendment? The first is used.` });
  if (lease.escalation && lease.escalation.type === 'cpi') open.push({ field: 'escalation', detail: 'CPI escalation found; index name, base month, floor and cap need a person.' });
  return { lease, terms: t, open, injection, lines, found: Object.keys(t).length };
}

/** Compare an existing abstract (leases-file entry) with what the text says. */
export function compareAbstract(lease, text) {
  const { lease: fromText, terms } = buildAbstract(text);
  const diffs = []; const d = (field, abstract, inText, citation) => diffs.push({ field, abstract, text: inText, citation });
  if (fromText.tenant && !String(fromText.tenant).startsWith('[') && !sameParty(lease.tenant, fromText.tenant)) d('tenant', lease.tenant, fromText.tenant, terms.tenant.citation);
  if (fromText.unit && !String(fromText.unit).startsWith('[') && unitKey(lease.unit) !== unitKey(fromText.unit)) d('unit', lease.unit, fromText.unit, terms.unit.citation);
  for (const k of ['start', 'end']) if (/^\d{4}/.test(fromText[k]) && lease[k] !== fromText[k]) d(k, lease[k], fromText[k], terms[k].citation);
  if (fromText.sqft !== undefined && lease.sqft !== undefined && fromText.sqft !== lease.sqft) d('sqft', lease.sqft, fromText.sqft, terms.sqft.citation);
  if (fromText.deposit !== undefined && (lease.deposit ?? null) !== fromText.deposit) d('deposit', lease.deposit ?? null, fromText.deposit, terms.deposit.citation);
  const firstRent = (l) => { const s = l.rent && rentSchedule({ ...l, escalation: undefined, rent: { ...l.rent, steps: undefined } }); return s && s[0] ? s[0].monthly : null; };
  if (fromText.rent && lease.rent) { const a = firstRent(lease), b = firstRent(fromText); if (a !== null && b !== null && Math.abs(a - b) > 0.005) d('rent', a, b, (terms.rent_monthly || terms.rent_annual).citation); }
  if (fromText.escalation && fromText.escalation.pct !== undefined && (!lease.escalation || lease.escalation.pct !== fromText.escalation.pct)) d('escalation', lease.escalation ? `${lease.escalation.type} ${lease.escalation.pct ?? ''}`.trim() : null, `fixed_pct ${fromText.escalation.pct}`, terms.escalation_pct.citation);
  const camA = lease.cam || {}, camB = fromText.cam || {};
  for (const k of ['share_pct', 'admin_fee_pct']) if (camB[k] !== undefined && camA[k] !== undefined && camA[k] !== camB[k]) d(`cam.${k}`, camA[k], camB[k], terms[k].citation);
  if (camB.cap && (!camA.cap || camA.cap.pct !== camB.cap.pct)) d('cam.cap', camA.cap ? camA.cap.pct : null, camB.cap.pct, terms.cap_pct.citation);
  return { lease_id: lease.lease_id, tenant: lease.tenant, diffs, status: diffs.length ? 'issue' : 'ok' };
}

