// Building blocks the Keystone agents share: worklist files, the
// draft → one-click request pair, refused tools, and small table helpers.
// Every agent still owns its own manifest and policy; these only remove repetition.
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { toCsv } from './csv.js';
import { sha256, safePath } from './util.js';
import { escapeHtml, htmlPage, safeMarkdown, safeFileName } from './formats.js';
import { reportWords, REPORT_TEXT } from './report-text.js';

export const MODEL_PIN = Object.freeze({ provider: 'anthropic', id: 'claude-sonnet-5-5', note: 'Declared host-model pin. The tools are deterministic and call no model.' });
export const OPEN_MARKER = /\[(TO CONFIRM|MISSING|CHECK|ATTACH)[^\]]*\]/g;

const LOCALES = { en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', pt: 'pt-BR', it: 'it-IT', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR' };
const rel = (ctx, f) => relative(ctx.root, f).split('\\').join('/');

/** Hash of several output files (name + content hash), recorded in the audit line. */
export const filesHash = (files) => sha256(files.map((f) => `${String(f).split(/[\\/]/).pop()}:${sha256(readFileSync(f))}`).join('\n'));

/** Append one row to a CSV log, writing the header the first time. */
export function appendRow(dir, name, row, columns) {
  const f = join(dir, name);
  const csv = toCsv([row], columns);
  appendFileSync(f, existsSync(f) ? csv.split('\n').slice(1).join('\n') : csv);
  return f;
}

/** A small HTML table from rows. Values are escaped. `words` (from reportWords) translates labels and status words. */
export function htmlTable(rows, columns, labels = {}, words = null) {
  if (!rows.length) return `<p class="mut">${escapeHtml(words ? words.t('none') : 'None.')}</p>`;
  const head = columns.map((c) => `<th>${escapeHtml(labels[c] || (words ? words.label(c) : c.replace(/_/g, ' ')))}</th>`).join('');
  const fmt = words ? new Intl.NumberFormat(LOCALES[words.lang] || 'en-US', { maximumFractionDigits: 2 }) : null;
  const cell = (c, v) => { if (fmt && typeof v === 'number' && Number.isFinite(v) && !/(^|_)(id|year|number|code)$/.test(c)) return fmt.format(v); const t = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v); return words && c === 'status' && REPORT_TEXT[t] ? words.t(t) : t; };
  const body = rows.map((r) => `<tr>${columns.map((c) => `<td>${escapeHtml(cell(c, r[c]))}</td>`).join('')}</tr>`).join('\n');
  return `<table><thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table>`;
}

/**
 * Write a worklist as CSV (for people to fill in; English column codes so scripts read
 * the same everywhere) and HTML (to read, in ctx.lang). title, intro, section titles and
 * limits may be strings or { en, de, ... } objects; a limit may also be a REPORT_TEXT key
 * ('files', 'lease', 'advice'). Returns { files, output_sha256, lang }.
 */
export function writeWorklist(ctx, dir, base, { title, intro = '', rows, columns, htmlColumns, labels = {}, sections = [], limits = [], lang = null }) {
  const w = reportWords(lang || ctx.lang || 'en');
  const out = ctx.outDir(dir);
  const csv = ctx.writeFile(out, `${base}.csv`, toCsv(rows, columns));
  const lim = limits.map((l) => (typeof l === 'string' && REPORT_TEXT[l] ? w.t(l) : w.tr(l)));
  const body = [
    `<h1>${escapeHtml(w.tr(title))}</h1>`,
    intro ? `<p class="mut">${escapeHtml(w.tr(intro))}</p>` : '',
    ...sections.map((s) => `<h2>${escapeHtml(w.tr(s.title))}</h2>${s.html || htmlTable(s.rows || [], s.columns || [], labels, w)}`),
    `<h2>${escapeHtml(w.t('all_rows', { n: rows.length }))}</h2>`,
    htmlTable(rows, htmlColumns || columns, labels, w),
    lim.length ? `<h2>${escapeHtml(w.t('limits'))}</h2><ul>${lim.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : '',
    w.lang !== 'en' ? `<p class="mut">${escapeHtml(w.t('translated_note'))}</p>` : '',
  ].join('\n');
  const html = ctx.writeFile(out, `${base}.html`, htmlPage({ title: w.tr(title), bodyHtml: body, footer: w.t('footer'), lang: w.lang }));
  const files = [csv, html];
  return { files, output_sha256: filesHash(files), lang: w.lang };
}

/** Tools listed so a host model can see them and see they are refused. */
export function refusedTools(list) {
  return {
    tools: list.map(({ name, category, description }) => ({ name, kind: 'action', category, description: `Listed so agents can see it is refused. ${description}`, inputSchema: { type: 'object', additionalProperties: false, properties: {} } })),
    rules: list.map(({ name, reason, description }) => ({ tool: name, decision: 'block', reason: reason || description })),
  };
}

const str = { type: 'string' };

/**
 * The draft → one-click pair.
 *
 *   <prefix>_draft_<noun>     kind 'write': writes drafts/<noun>-<id>.md marked DRAFT and returns its sha256.
 *   <prefix>_request_<verb>   kind 'action' in a one-click category: re-hashes the draft, refuses if it
 *                             changed or still has open markers (unless accept_open_issues with a note),
 *                             then appends an approved row to <noun>-requests.csv. A person acts on it.
 *
 * cfg: { prefix, noun, verb, category, outDir, title, description, args (properties), required,
 *        build(a, ctx) → { id, to, text }, requestDescription, actor }
 */
export function draftPair(cfg) {
  const { prefix, noun, verb = 'send', category = 'binding_send', outDir, actor = 'a person' } = cfg;
  const draftName = `${prefix}_draft_${noun}`, reqName = `${prefix}_request_${verb}`;
  const draftTool = {
    name: draftName, kind: 'write', title: cfg.title || `Draft a ${noun.replace(/_/g, ' ')}`,
    description: cfg.description,
    inputSchema: { type: 'object', additionalProperties: false, required: cfg.required || [], properties: { ...cfg.args, out_dir: str } },
    handler: async (a, ctx) => {
      const d = await cfg.build(a, ctx);
      const header = `> DRAFT. Not sent. Written by ${ctx.manifest ? ctx.manifest.name : prefix} on ${new Date().toISOString().slice(0, 10)} from your files. Check every figure before ${actor} uses it.\n\n`;
      const text = safeMarkdown(header + d.text);
      const dir = join(ctx.outDir(a.out_dir || outDir), 'drafts');
      const f = ctx.writeFile(dir, `${noun}-${safeFileName(d.id)}.md`, text);
      const markers = [...new Set((text.match(OPEN_MARKER) || []))];
      return { summary: `${noun.replace(/_/g, ' ')} ${d.id} drafted${d.amount !== undefined ? ` for ${d.amount}` : ''} with ${markers.length} open marker(s)${markers.length ? ` (${markers.join(', ')})` : ''}. Nothing was sent.`, id: d.id, to: d.to || null, amount: d.amount ?? null, draft: rel(ctx, f), draft_sha256: sha256(text), open_markers: markers.length, markers, file: f, ...(d.extra || {}) };
    },
  };
  const reqTool = {
    name: reqName, kind: 'action', category, title: `Approve the ${noun.replace(/_/g, ' ')} (one click)`,
    description: cfg.requestDescription || `After one named human click (even in Auto), record that the reviewed ${noun.replace(/_/g, ' ')} draft is approved in ${noun}-requests.csv. Tied to draft_sha256; refuses while open markers remain unless accept_open_issues is true with a note. ${actor[0].toUpperCase() + actor.slice(1)} acts on it; the agent never does.`,
    inputSchema: { type: 'object', additionalProperties: false, required: ['draft', 'draft_sha256'], properties: { draft: { type: 'string', description: 'Draft path returned by the draft tool' }, draft_sha256: { type: 'string', description: 'sha256 returned by the draft tool' }, to: { type: 'string', description: 'Who it goes to; must match the draft when the draft names someone' }, accept_open_issues: { type: 'boolean' }, note: str, out_dir: str } },
    handler: async (a, ctx) => {
      const f = safePath(ctx.root, a.draft);
      const text = readFileSync(f, 'utf8');
      if (sha256(text) !== a.draft_sha256) throw new Error('draft_sha256 does not match the draft on disk; review the current draft and pass its new sha256');
      const open = [...new Set(text.match(OPEN_MARKER) || [])];
      if (open.length && !(a.accept_open_issues === true && String(a.note || '').trim())) throw new Error(`the draft still has open markers (${open.join(', ')}); fix them, or pass accept_open_issues: true with a note saying why`);
      const toLine = (/^\*\*To:\*\*\s*(.+)$/m.exec(text) || [])[1];
      if (a.to && toLine && !/^\[TO CONFIRM/.test(toLine) && toLine.trim() !== String(a.to).trim()) throw new Error(`to ("${a.to}") differs from the draft's To line ("${toLine.trim()}")`);
      const id = (new RegExp(`${noun}-(.+)\\.md$`).exec(f.split(/[\\/]/).pop()) || [])[1] || '';
      const file = appendRow(ctx.outDir(a.out_dir || outDir), `${noun}-requests.csv`, { approved_at: new Date().toISOString(), id, to: a.to || toLine || '', draft: rel(ctx, f), draft_sha256: a.draft_sha256, open_markers: open.length, note: a.note || '', status: `approved - ${actor} acts on it` }, ['approved_at', 'id', 'to', 'draft', 'draft_sha256', 'open_markers', 'note', 'status']);
      return { summary: `${noun.replace(/_/g, ' ')} ${id} approved and recorded. Nothing was sent or paid by the agent.`, file: rel(ctx, file) };
    },
  };
  return { tools: [draftTool, reqTool], rules: [{ tool: draftName, decision: 'ask', reason: 'A draft is written only after a person says yes (or Auto is opted in).' }, { tool: reqName, decision: 'ask', reason: `${category}: one named human click, even in Auto.` }] };
}

/** Standard one-line limit sentences used in reports (English; reports translate the keys files, lease, advice). */
export const LIMITS = Object.freeze({
  files: REPORT_TEXT.files.en,
  lease: REPORT_TEXT.lease.en,
  advice: REPORT_TEXT.advice.en,
});

/**
 * The three read tools most Keystone agents start with, from one run function:
 *   <prefix>_check         run(a, ctx) → result with items[] and summary
 *   <prefix>_explain       one item by key, with every finding
 *   <prefix>_write_report  worklist CSV + HTML (ctx.lang)
 * cfg: { prefix, outDir, props, required, run, check: {title, description}, explain: {arg, argDoc, key(item), describe(item)},
 *        report: { base, title, intro(r), row(item), columns, htmlColumns, sections(r), limits } }
 */
export function standardTools(cfg) {
  const { prefix, outDir, props, required = [], run } = cfg;
  const schema = (extra = {}, req = []) => ({ type: 'object', additionalProperties: false, required: [...required, ...req], properties: { ...props, ...extra } });
  const tools = [
    { name: `${prefix}_check`, kind: 'read', title: cfg.check.title, description: cfg.check.description, inputSchema: schema(),
      handler: async (a, ctx) => run(a, ctx) },
  ];
  if (cfg.explain) {
    const ex = cfg.explain;
    tools.push({ name: `${prefix}_explain`, kind: 'read', title: ex.title || 'Explain one item', description: ex.description,
      inputSchema: schema({ [ex.arg]: { type: 'string', description: ex.argDoc } }, [ex.arg]),
      handler: async (a, ctx) => {
        const r = await run(a, ctx); const want = String(a[ex.arg]).trim().toLowerCase();
        const keys = (x) => [].concat(ex.key(x)).filter((k) => k !== null && k !== undefined && k !== '').map((k) => String(k).trim().toLowerCase());
        const it = r.items.find((x) => keys(x).includes(want)) || (want.length >= 3 ? r.items.find((x) => keys(x).some((k) => k.includes(want))) : null);
        if (!it) throw new Error(`${ex.arg} "${a[ex.arg]}" not found; pass one from ${prefix}_check (first few: ${r.items.slice(0, 5).map((x) => [].concat(ex.key(x))[0]).join(', ')})`);
        return { summary: ex.describe(it), item: it };
      } });
  }
  if (cfg.report) {
    const rp = cfg.report;
    tools.push({ name: `${prefix}_write_report`, kind: 'report', title: rp.toolTitle || 'Write the worklist',
      description: `${rp.description || 'Write the worklist'} as ${rp.base}.csv (one row per item, blank decision columns) and ${rp.base}.html into out_dir (default ${outDir}). The HTML follows --lang.`,
      inputSchema: schema({ out_dir: { type: 'string' } }),
      handler: async (a, ctx) => {
        const r = await run(a, ctx);
        const rows = r.items.map((i) => ({ ...rp.row(i), decision: '', decided_by: '' }));
        const columns = rp.columns ? [...rp.columns, 'decision', 'decided_by'] : Object.keys(rows[0] || { item: 0 });
        const w = writeWorklist(ctx, a.out_dir || outDir, rp.base, { title: rp.title, intro: rp.intro ? rp.intro(r) : r.summary, rows, columns, htmlColumns: rp.htmlColumns, sections: rp.sections ? rp.sections(r) : [], limits: rp.limits || ['files', 'advice'] });
        return { summary: `Worklist written (${w.lang}): ${r.summary}`, ...w, files: w.files.map((f) => rel(ctx, f)) };
      } });
  }
  return { tools, rules: tools.map((t) => ({ tool: t.name, decision: 'allow' })) };
}
