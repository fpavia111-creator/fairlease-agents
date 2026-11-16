import { defineManifest, MODEL_PIN, VENDOR_FIELDS, VENDOR_PROFILES, PAYMENT_FIELDS, standardTools, draftPair, refusedTools, isoDate } from 'keystone-core';
import { readFileSync } from 'node:fs';
import { checkVendors, requestText, REQUIREMENTS_SCHEMA } from './vendors.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/opal';
const props = {
  vendors: { type: 'string', description: 'Vendor directory (CSV, Excel or JSON): name, trade, tax ID, insurance and licence expiry dates, email. AppFolio vendor directory and Buildium vendor exports are recognised' },
  requirements: { type: 'string', description: 'Requirements JSON (requirements schema): what every vendor needs (gl, wc, auto, license, tax_id, w9), what each trade adds, exemptions per vendor, warn_days' },
  payments: { type: 'string', description: 'Optional vendor payments (payee, date, amount, check or reference) to find payments made while out of compliance' },
  as_of: { type: 'string', description: 'Date to judge expiry against, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => { const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD'); return checkVendors({ rows: ctx.records(a.vendors, 'vendors'), req: ctx.readJson(a.requirements, 'requirements'), payments: a.payments ? ctx.records(a.payments, 'payments') : null, asOf }); };
const std = standardTools({
  prefix: 'opal', outDir: OUT, props, required: ['vendors', 'requirements'], run,
  check: { title: 'Check vendor compliance', description: 'Every vendor against your requirements: liability, workers\' comp and auto insurance and licence (expired, expiring within warn_days, or missing), tax ID and tax form. With payments, lists money paid to a vendor while out of compliance. Tax IDs are masked.' },
  explain: { arg: 'vendor', argDoc: 'Vendor name from opal_check', key: (i) => [i.vendor], title: 'Explain one vendor', description: 'Show one vendor\'s expiry dates and findings.',
    describe: (i) => `${i.vendor} (${i.trade || 'no trade'}): ${i.status.replace(/_/g, ' ')}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'opal-vendors', description: 'Write the vendor compliance worklist',
    title: { en: 'Vendor compliance', de: 'Nachweise der Dienstleister', fr: 'Conformité des prestataires', es: 'Cumplimiento de proveedores', pt: 'Conformidade de fornecedores', it: 'Conformità dei fornitori', ja: '業者の書類確認', zh: '供应商合规', ko: '업체 서류 점검' },
    row: (i) => ({ vendor: i.vendor, category: i.trade, expires: [i.gl_expires, i.wc_expires, i.license_expires].filter(Boolean).sort()[0] || '', amount: i.paid_while_noncompliant, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['vendor', 'category', 'expires', 'amount', 'status', 'findings', 'reasons'],
    htmlColumns: ['vendor', 'category', 'expires', 'amount', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Opal checks dates and fields in your files against the requirements you set. It does not read certificates or confirm coverage with an insurer.', de: 'Opal prüft Daten und Felder Ihrer Dateien gegen Ihre Vorgaben. Es liest keine Versicherungsnachweise und bestätigt keinen Versicherungsschutz.', fr: 'Opal vérifie les dates et champs de vos fichiers par rapport à vos exigences. Il ne lit pas les attestations et ne confirme pas la couverture auprès d’un assureur.', es: 'Opal revisa fechas y campos de sus archivos según sus requisitos. No lee certificados ni confirma coberturas con la aseguradora.', pt: 'O Opal confere datas e campos dos seus arquivos com os seus requisitos. Não lê apólices nem confirma cobertura com a seguradora.', it: 'Opal verifica date e campi dei vostri file rispetto ai vostri requisiti. Non legge certificati né conferma coperture con l’assicuratore.', ja: 'Opal はファイルの日付と項目を設定した要件と照合します。保険証書の読み取りや保険会社への確認はしません。', zh: 'Opal 按您设定的要求核对文件中的日期和字段，不读取保险凭证，也不向保险公司确认保障。', ko: 'Opal은 파일의 날짜와 항목을 설정한 요건과 대조합니다. 보험증권을 읽거나 보험사에 보장을 확인하지 않습니다.' }] },
});
const pair = draftPair({
  prefix: 'opal', noun: 'request', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/request-<vendor>.md: a request to the vendor for an updated certificate, licence or tax form, listing exactly what is expired or missing. Marked DRAFT; open items are [TO CONFIRM]. Sending goes through opal_request_send (one click).',
  required: ['vendors', 'requirements', 'vendor'],
  args: { ...props, vendor: { type: 'string', description: 'Vendor name from opal_check' }, to: { type: 'string', description: 'Vendor email (defaults to the directory email)' }, company: { type: 'string', description: 'Your company name' }, holder_note: { type: 'string', maxLength: 600, description: 'Certificate holder and additional insured wording' }, reply_by: { type: 'string', description: 'Reply-by date' }, from: { type: 'string', description: 'Your name and contact' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const q = String(a.vendor).trim().toLowerCase(); const it = r.items.find((i) => i.vendor.toLowerCase() === q) || r.items.find((i) => q.length >= 3 && i.vendor.toLowerCase().includes(q));
    if (!it) throw new Error(`no vendor "${a.vendor}" in the directory`);
    if (it.status === 'ok') throw new Error(`${it.vendor} has nothing expired, expiring or missing`);
    return { id: it.vendor, to: a.to || it.email || undefined, text: requestText(it, a) };
  },
});
const refused = refusedTools([
  { name: 'approve_invoice', category: 'move_money', description: 'Opal never approves, holds or releases a vendor payment.' },
  { name: 'vendor_status_update', category: 'production_deploy', description: 'Opal never activates, deactivates or edits vendors in your accounting or property management system.' },
  { name: 'email_send', category: 'binding_send', description: 'Opal never sends requests; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'opal-of-vendors', version: pkg.version,
  description: 'Checks every vendor\'s liability, workers\' comp and auto insurance, licence and tax ID against your own requirements by trade, finds payments made while a vendor was out of compliance, and drafts requests for updated certificates. Paying and deactivating vendors are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { requirements: REQUIREMENTS_SCHEMA },
  sources: {
    vendors: { label: 'Vendor directory', args: ['vendors'], fields: VENDOR_FIELDS, profiles: VENDOR_PROFILES },
    payments: { label: 'Vendor payments', args: ['payments'], fields: PAYMENT_FIELDS, profiles: [] },
  },
  prompts: [{
    name: 'vendor_compliance', title: 'Check vendor compliance',
    description: 'Walks the host model through a monthly vendor compliance check with Opal.',
    arguments: [{ name: 'vendors', description: 'Vendor directory', required: true }, { name: 'requirements', description: 'Requirements JSON', required: true }, { name: 'payments', description: 'Vendor payments', required: false }],
    text: `You are helping an accounts payable or property manager check vendor compliance with opal-of-vendors. Vendors: {{vendors}}. Requirements: {{requirements}}. Payments: {{payments}}.

Rules: Opal never pays, holds payments, or changes vendor records; approve_invoice, vendor_status_update and email_send are blocked. Never show a full tax ID; Opal masks them.

1. Call opal_check. Lead with payments made while out of compliance, then expired items, then those expiring soon.
2. Call opal_explain for vendors the person asks about.
3. Call opal_write_report and share the paths.
4. Offer opal_draft_request per vendor; only when the person asks, call opal_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Opal allowlist.' }] },
});
