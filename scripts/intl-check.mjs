#!/usr/bin/env node
// International check: every agent's eval cases, run again on its fixtures as
// they would arrive from Germany, France, Spain, Brazil, Italy, Japan, China and Korea.
//
//   node scripts/intl-check.mjs [agent ...] [--lang de,ja] [--verbose]
//
// For each language the CSV fixtures an eval case reads are rewritten the way a
// local export writes them: column names from the agent's own dictionary entry in
// that language, day-first or year-first dates, comma decimals, semicolons, and the
// usual legacy text encoding (Windows-1252, Shift_JIS, GBK, EUC-KR). Values are not translated.
// Every case that passes in English must pass the same way.
//
// A column with no word in the dictionary keeps its English name, and the report
// counts how many columns were translated, so coverage is visible. Exit code 1
// when any case passes in English and fails in another language.

import { readdirSync, readFileSync, writeFileSync, cpSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runEvals, kindsByArg } from '../packages/keystone-core/src/index.js';
import { MARKETS, localise, argFiles } from './lib/localise.mjs';
import { encodeText } from './lib/encode.mjs';

const PK = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages');
const argv = process.argv.slice(2);
const verbose = argv.includes('--verbose'); const showMissing = argv.includes('--missing'); const missing = new Map();
const li = argv.indexOf('--lang'); const langArg = li >= 0 ? argv[li + 1] : null;
const only = argv.filter((a, i) => !a.startsWith('--') && (li < 0 || i !== li + 1));
const agents = readdirSync(PK).filter((n) => n !== 'keystone-core' && existsSync(join(PK, n, 'src', 'manifest.js')) && (!only.length || only.includes(n))).sort();

const LANGS = langArg ? langArg.split(',') : Object.keys(MARKETS);

const strip = (o) => JSON.parse(JSON.stringify(o));
let regressions = 0; const summary = []; const skippedFiles = new Set(); const vendorFiles = new Set();
for (const n of agents) {
  const manifest = (await import(pathToFileURL(join(PK, n, 'src', 'manifest.js')).href)).manifest;
  const data = JSON.parse(readFileSync(join(PK, n, 'evals', 'cases.json'), 'utf8'));
  // intl-* cases already read German or Japanese files; translating those again tests nothing.
  const cases = (data.cases || data).filter((c) => !/^intl-/.test(c.id));
  const csvCases = cases.filter((c) => argFiles(c.args).length);
  if (!csvCases.length) { summary.push({ agent: n, cases: 0 }); continue; }
  const base = await runEvals(manifest, strip(csvCases), { root: join(PK, n) });
  const passedEn = new Set(base.results.filter((r) => r.pass).map((r) => r.id));
  const row = { agent: n, cases: csvCases.length, english: passedEn.size, columns: 0, translated: 0, langs: {} };
  for (const lang of LANGS) {
    const parent = mkdtempSync(join(tmpdir(), `keystone-intl-${lang}-`)); const root = join(parent, 'root');
    cpSync(join(PK, n, 'fixtures'), join(root, 'fixtures'), { recursive: true });
    const done = new Map(); const dmyKinds = new Set(); const fileOv = {};
    for (const c of csvCases) {
      const kinds = kindsByArg(manifest, c.tool);
      for (const [arg, file] of argFiles(c.args)) {
        if (done.has(file)) continue;
        const kind = kinds.get(arg); const def = kind && manifest.sources[kind];
        const src = join(PK, n, file); if (!def || !existsSync(src)) { done.set(file, null); continue; }
        // Files under fixtures/exports/ are already a foreign-language or vendor export; rewriting them again tests nothing.
        if (/(^|\/)fixtures\/exports\//.test(file)) { done.set(file, null); skippedFiles.add(`${n}/${file}`); continue; }
        const out = localise(readFileSync(src, 'utf8'), def, lang, lang === 'de' ? missing : null); if (!out) { done.set(file, null); continue; }
        if (out.vendor) { done.set(file, null); vendorFiles.add(`${n}/${file}`); continue; }
        let buf; let enc = MARKETS[lang].enc;
        try { buf = encodeText(out.text, enc); } catch { enc = 'utf-8'; buf = encodeText(out.text, enc); }
        writeFileSync(join(root, file), buf);
        done.set(file, out); if (lang === LANGS[0] || !row.columns) { /* counted below */ }
        if (MARKETS[lang].dmy) fileOv[file] = { date_order: 'dmy' };
        if (lang === 'de') { row.columns += out.columns; row.translated += out.translated; }
      }
    }
    if (Object.keys(fileOv).length) writeFileSync(join(root, 'keystone-sources.json'), JSON.stringify({ note: 'Day-first dates, as the buyer would set them once.', files: fileOv }, null, 2));
    // Only cases whose every spreadsheet input was rewritten say anything about this language.
    const rewritten = csvCases.filter((c) => argFiles(c.args).every(([, f]) => done.get(f)));
    const res = await runEvals(manifest, strip(rewritten), { root });
    const bad = res.results.filter((r) => passedEn.has(r.id) && !r.pass);
    const tested = rewritten.filter((c) => passedEn.has(c.id)).length; row.tested = tested;
    row.langs[lang] = tested ? `${res.results.filter((r) => passedEn.has(r.id) && r.pass).length}/${tested}` : '-';
    if (bad.length) { regressions += bad.length; for (const b of bad) console.log(`  FAIL ${n} [${lang}] ${b.id}: ${b.fails.slice(0, 3).join('; ')}`); }
    if (verbose) console.log(`  ${n} [${lang}] kept at ${root}`); else rmSync(parent, { recursive: true, force: true });
  }
  summary.push(row);
}
const pad = (s, w) => String(s).padEnd(w);
console.log(`\n${pad('agent', 28)}${pad('cases', 7)}${pad('columns translated', 20)}${LANGS.map((l) => pad(l, 8)).join('')}`);
let cols = 0, tr = 0, cs = 0;
for (const r of summary) { cols += r.columns || 0; tr += r.translated || 0; cs += r.cases || 0; console.log(`${pad(r.agent, 28)}${pad(r.cases, 7)}${pad(r.cases ? `${r.translated}/${r.columns}` : '-', 20)}${LANGS.map((l) => pad((r.langs && r.langs[l]) || '-', 8)).join('')}`); }
console.log(`\nNot rewritten: ${vendorFiles.size} file(s) in a named vendor layout (those exports keep English headers everywhere) and ${skippedFiles.size} file(s) under fixtures/exports/ that are already foreign-language exports.`);
console.log(`\n${agents.length} agent(s), ${cs} case(s) with spreadsheet inputs, ${tr}/${cols} column names translated (German count), ${LANGS.length} language(s). ${regressions ? `${regressions} case(s) passed in English and failed in another language.` : 'Every case that passes in English passes in every language.'}`);
if (showMissing) console.log(`\nFields with no German word: ${[...missing.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}${n > 1 ? ` x${n}` : ''}`).join(', ')}`);
process.exit(regressions ? 1 : 0);
