// Rewrite an English fixture the way an export from another market writes it
// (used by intl-check.mjs). Values and units are kept; only the way they are written changes.
import { parseCsvRows, findHeaderRow, normHeader, namesFor, conceptOf } from '../../packages/fairlease-core/src/index.js';

// How each market writes a file. Dates: d = day-first with the separator, y = year-first.
export const MARKETS = {
  de: { enc: 'windows-1252', sep: ';', dec: ',', grp: '.', date: (y, m, d) => `${d}.${m}.${y}`, unitInName: true },
  fr: { enc: 'utf-8-bom', sep: ';', dec: ',', grp: ' ', date: (y, m, d) => `${d}/${m}/${y}`, dmy: true },
  es: { enc: 'utf-8', sep: ';', dec: ',', grp: '.', date: (y, m, d) => `${d}/${m}/${y}`, dmy: true, unitInName: true },
  pt: { enc: 'utf-8', sep: ';', dec: ',', grp: '.', date: (y, m, d) => `${d}/${m}/${y}`, dmy: true },
  it: { enc: 'utf-8', sep: ';', dec: ',', grp: '.', date: (y, m, d) => `${d}/${m}/${y}`, dmy: true, unitInName: true },
  ja: { enc: 'shift_jis', sep: ',', dec: '.', grp: ',', date: (y, m, d) => `${y}/${m}/${d}` },
  zh: { enc: 'gbk', sep: ',', dec: '.', grp: ',', date: (y, m, d) => `${y}-${m}-${d}`, unitInName: true },
  ko: { enc: 'euc-kr', sep: ',', dec: '.', grp: ',', date: (y, m, d) => `${y}.${m}.${d}` },
};

const walk = (v, out = []) => { if (typeof v === 'string') { if (/\.csv$/i.test(v)) out.push(v); } else if (Array.isArray(v)) v.forEach((x) => walk(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach((x) => walk(x, out)); return out; };
export const argFiles = (args) => Object.entries(args || {}).flatMap(([a, v]) => walk(v).map((f) => [a, f]));

function fmtNumber(s, mk, decimals) {
  const n = Number(s); if (!Number.isFinite(n)) return s;
  const neg = n < 0; const fixed = Math.abs(n).toFixed(decimals);
  const [i, f] = fixed.split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, mk.grp);
  return (neg ? '-' : '') + grouped + (f ? mk.dec + f : '');
}
function fmtDate(s, mk) {
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})( \d{1,2}:\d{2})?$/.exec(String(s).trim()); // the English fixtures write US dates too
  if (us) return mk.date(us[3], us[1].padStart(2, '0'), us[2].padStart(2, '0')) + (us[4] || '');
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2})?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(String(s).trim());
  if (!m || m[5]) return s; // keep zoned timestamps exactly
  return mk.date(m[1], m[2], m[3]) + (m[4] ? ` ${m[4]}` : '');
}
const quote = (v, sep) => { const s = String(v ?? ''); return /["\r\n]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Rewrite one CSV for a language. Returns { text, translated, columns }. */
/** True when the headers match one of the named vendor layouts (AppFolio, Yardi...). Those exports keep their own English headers in every market, so they are not rewritten. */
export function vendorLayout(headers, def) {
  const has = (h) => headers.some((x) => normHeader(x) === normHeader(h));
  return (def.profiles || []).some((p) => (p.signature || []).length && p.signature.every((h) => (Array.isArray(h) ? h.some(has) : has(h))) && !(p.absent || []).some(has));
}

// Month names as a local export writes them over month columns ("Jan 2026" -> "Jan. 2026", "1月 2026").
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTHS = {
  de: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
};
function monthHeader(h, lang) {
  const m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(String(h).trim()); if (!m) return null;
  const i = MON.indexOf(m[1].toLowerCase()); if (i < 0) return null;
  if (MONTHS[lang]) return `${MONTHS[lang][i]} ${m[2]}`;
  if (lang === 'ko') return `${m[2]}년 ${i + 1}월`;
  return `${m[2]}年${i + 1}月`;
}
const US_AMOUNT = /^-?(\d{1,3}(,\d{3})+|\d+)\.\d+$|^-?\d{1,3}(,\d{3})+$/;

/** Rewrite one CSV for a language. Returns { text, translated, columns }, or { vendor: true } for a named vendor layout. */
export function localise(csvText, def, lang, missing = null) {
  const mk = MARKETS[lang]; const matrix = parseCsvRows(csvText).filter((r) => r.some((c) => String(c ?? '').trim() !== '')); if (!matrix.length) return null;
  const hi = findHeaderRow(matrix, def); const headers = matrix[hi].map((h) => String(h ?? '').trim()); const fields = def.fields || {};
  if (vendorLayout(headers, def)) return { vendor: true };
  const english = new Set(); for (const [f, fd] of Object.entries(fields)) { english.add(normHeader(f)); for (const a of (fd && fd.aliases) || []) english.add(normHeader(a)); }
  // Same order as the adapter: a field's own name first, then its aliases, one column per field.
  const owner = new Map(); const taken = new Set();
  for (const [f] of Object.entries(fields)) { const h = headers.findIndex((x) => normHeader(x) === normHeader(f)); if (h >= 0 && !owner.has(h)) { owner.set(h, f); taken.add(f); } }
  for (const [f, fd] of Object.entries(fields)) { if (taken.has(f)) continue; for (const a of (fd && fd.aliases) || []) { const h = headers.findIndex((x, i) => !owner.has(i) && normHeader(x) === normHeader(a)); if (h >= 0) { owner.set(h, f); taken.add(f); break; } } }
  const used = new Set(); const plan = []; let translated = 0;
  headers.forEach((h, i) => {
    const f = owner.get(i) || null; const fd = f ? fields[f] || {} : {}; let name = h;
    if (f) {
      const word = namesFor(conceptOf(f, fd), lang).find((w) => !english.has(normHeader(w)) && !used.has(normHeader(w)));
      if (word) { name = word; used.add(normHeader(word)); translated++; } else if (missing) missing.set(f, (missing.get(f) || 0) + 1);
    } else { const mh = monthHeader(h, lang); if (mh) name = mh; }
    plan.push({ name, fd, typed: !!f });
  });
  const cell = (p, raw) => {
    const s = String(raw ?? '').trim(); if (s === '') return '';
    const type = p.fd.type;
    if (type === 'date' || type === 'datetime') return fmtDate(s, mk);
    if ((type === 'money' || type === 'number') && /^-?\d+(\.\d+)?$/.test(s.replace(/,/g, ''))) {
      const plain = s.replace(/,/g, '');
      return fmtNumber(plain, mk, type === 'money' ? 2 : (plain.split('.')[1] || '').length);
    }
    // A column the agent does not name (months of a wide report) still carries amounts.
    if (!p.typed && US_AMOUNT.test(s)) { const plain = s.replace(/,/g, ''); return fmtNumber(plain, mk, (plain.split('.')[1] || '').length); }
    return s;
  };
  const lines = [];
  for (let r = 0; r < hi; r++) lines.push(matrix[r].map((v) => quote(v, mk.sep)).join(mk.sep)); // title block above the header
  lines.push(plan.map((p) => quote(p.name, mk.sep)).join(mk.sep));
  for (const row of matrix.slice(hi + 1)) lines.push(plan.map((p, i) => quote(cell(p, row[i]), mk.sep)).join(mk.sep));
  return { text: lines.join('\r\n') + '\r\n', translated, columns: headers.length };
}
