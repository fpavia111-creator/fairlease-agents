import { defineManifest, MODEL_PIN, VENDOR_FIELDS, VENDOR_PROFILES, PAYMENT_FIELDS, standardTools, draftPair, refusedTools } from 'keystone-core';
import { readFileSync } from 'node:fs';
import { checkFilings, w9RequestText, DEFAULT_EXCLUDE_METHODS } from './filings.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/pearl';
const props = {
  payments: { type: 'string', description: 'Payments to vendors and owners (CSV, Excel or JSON): payee, date, amount, method, GL account, check or reference. Local headers such as Beneficiario, Fecha de pago, Importe or Forma de pago are read' },
  vendors: { type: 'string', description: 'Vendor and owner directory (CSV, Excel or JSON): name, vendor ID, trade, tax ID, 1099 flag, W-9 on file, entity type, mailing address, email. AppFolio and Buildium vendor exports are recognised' },
  tax_year: { type: 'integer', minimum: 2000, maximum: 2100, description: 'Tax year to total, for example 2026. Payments dated in other years are ignored' },
  threshold: { type: 'number', minimum: 0, description: 'Reporting threshold per payee for this tax year, as your tax preparer gives it. Pearl has no built-in threshold' },
  exclude_methods: { type: 'array', maxItems: 40, items: { type: 'string', minLength: 2, maxLength: 40 }, description: `Payment methods left out of the totals, matched as words in the method column (default: ${DEFAULT_EXCLUDE_METHODS.join(', ')}). Set it to what your tax preparer advises` },
};
const required = ['payments', 'tax_year', 'threshold'];
const run = (a, ctx) => checkFilings({ payments: ctx.records(a.payments, 'payments'), vendors: a.vendors ? ctx.records(a.vendors, 'vendors') : [], taxYear: a.tax_year, threshold: a.threshold, excludeMethods: a.exclude_methods && a.exclude_methods.length ? a.exclude_methods : DEFAULT_EXCLUDE_METHODS });
const std = standardTools({
  prefix: 'pearl', outDir: OUT, props, required, run,
  check: { title: 'Check 1099 readiness', description: 'Totals each payee\'s payments for the tax year (records sharing a tax ID are added together), leaves out excluded payment methods, and compares each total with your threshold. Flags missing or malformed tax IDs, missing addresses, missing W-9s, several records on one tax ID, payees not in the directory, directory flags that say no 1099 for a payee over the threshold, and law firms and corporations to confirm. Suggests NEC or MISC (MISC for rents paid to owners). Tax IDs are always masked.' },
  explain: { arg: 'payee', argDoc: 'Payee name or vendor ID from pearl_check', key: (i) => [i.payee, i.vendor_id, ...i.records], title: 'Explain one payee', description: 'Show one payee\'s total, excluded payments, masked tax ID, suggested form and each finding.',
    describe: (i) => `${i.payee}${i.vendor_id ? ` (${i.vendor_id})` : ''}: ${i.status.replace(/_/g, ' ')}. Paid ${i.total} in ${i.payments} payment(s)${i.excluded ? `, plus ${i.excluded} by excluded methods` : ''}; tax ID ${i.tin || 'none'}${i.form ? `; suggested form 1099-${i.form}` : ''}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'pearl-1099', description: 'Write the 1099 readiness worklist',
    title: { en: '1099 readiness', de: '1099-Vorbereitung', fr: 'Préparation des 1099', es: 'Preparación de los 1099', pt: 'Preparação dos 1099', it: 'Preparazione dei 1099', ja: '1099 の準備状況', zh: '1099 准备情况', ko: '1099 준비 현황' },
    row: (i) => ({ vendor: i.payee, id: i.vendor_id || '', tax_id: i.tin, amount: i.total, excluded: i.excluded, form: i.form ? `1099-${i.form}` : '', status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['vendor', 'id', 'tax_id', 'amount', 'excluded', 'form', 'status', 'findings', 'reasons'],
    htmlColumns: ['vendor', 'tax_id', 'amount', 'form', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Pearl totals your payment file against the threshold and methods you give it and checks tax IDs for format only. It does not verify tax IDs with the IRS, decide whether a payee or payment is reportable, or file anything. Confirm forms and amounts with your tax preparer.', de: 'Pearl summiert Ihre Zahlungsdatei gegen den Schwellenwert und die Zahlungsarten, die Sie angeben, und prüft Steuernummern nur auf das Format. Es prüft keine Steuernummern bei der Behörde, entscheidet nicht, ob eine Zahlung meldepflichtig ist, und reicht nichts ein. Klären Sie Formulare und Beträge mit Ihrem Steuerberater.', fr: 'Pearl totalise votre fichier de paiements selon le seuil et les modes que vous indiquez et ne contrôle que le format des numéros fiscaux. Il ne les vérifie pas auprès de l’administration, ne décide pas si un paiement doit être déclaré et ne dépose rien. Confirmez formulaires et montants avec votre conseiller fiscal.', es: 'Pearl suma su archivo de pagos según el umbral y las formas de pago que usted indica y solo revisa el formato de los números fiscales. No los verifica con el IRS, no decide si un pago se debe declarar ni presenta nada. Confirme formularios e importes con su preparador de impuestos.', pt: 'O Pearl soma seu arquivo de pagamentos conforme o limite e as formas de pagamento que você informa e verifica apenas o formato dos números fiscais. Não os confirma com o IRS, não decide se um pagamento deve ser declarado e não envia nada. Confirme formulários e valores com seu contador.', it: 'Pearl somma il file dei pagamenti secondo la soglia e i metodi indicati e controlla solo il formato dei codici fiscali. Non li verifica presso l’IRS, non decide se un pagamento va dichiarato e non presenta nulla. Conferma moduli e importi con il tuo consulente fiscale.', ja: 'Pearl は指定されたしきい値と支払方法に従って支払ファイルを集計し、納税者番号は形式のみ確認します。IRS への照合、報告対象かどうかの判断、提出は行いません。様式と金額は税務担当者に確認してください。', zh: 'Pearl 按您给出的门槛和付款方式汇总付款文件，只检查税号格式。不向 IRS 核验税号，不判断付款是否需要申报，也不提交任何内容。表格和金额请与税务顾问确认。', ko: 'Pearl은 입력한 기준 금액과 지급 방법에 따라 지급 파일을 합산하고 납세자 번호는 형식만 확인합니다. IRS 조회, 신고 대상 여부 판단, 제출은 하지 않습니다. 양식과 금액은 세무 담당자와 확인하세요.' }] },
});
const pair = draftPair({
  prefix: 'pearl', noun: 'request', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/request-<payee>.md: a W-9 request to one payee listing exactly what is missing (tax ID, address, W-9, name confirmation). It never contains a tax ID and asks for a secure channel. Marked DRAFT; open items are [TO CONFIRM]. Sending goes through pearl_request_send (one click).',
  required: [...required, 'payee'],
  args: { ...props, payee: { type: 'string', description: 'Payee name or vendor ID from pearl_check' }, to: { type: 'string', description: 'Payee email or mailing address' }, payer: { type: 'string', maxLength: 200, description: 'Payer name, for example the owner entity or management company' }, reply_by: { type: 'string', description: 'Reply-by date' }, secure_channel: { type: 'string', maxLength: 300, description: 'Secure upload link or mailing address for the W-9' }, from: { type: 'string', description: 'Your name and contact' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const q = String(a.payee).trim().toLowerCase();
    const it = r.items.find((i) => [i.payee, i.vendor_id, ...i.records].some((v) => v && String(v).toLowerCase() === q)) || r.items.find((i) => q.length >= 3 && i.payee.toLowerCase().includes(q));
    if (!it) throw new Error(`no payee "${a.payee}" in ${a.tax_year}`);
    if (!it.findings.some((f) => ['tin_missing', 'tin_invalid', 'payee_not_in_directory', 'w9_missing', 'address_missing', 'shared_tin'].includes(f.code))) throw new Error(`${it.payee} has a well-formed tax ID, an address and a W-9 on file; there is nothing to request`);
    return { id: it.payee, to: a.to || undefined, text: w9RequestText(it, { ...a, tax_year: r.tax_year }) };
  },
});
const refused = refusedTools([
  { name: 'file_1099', category: 'binding_send', description: 'Pearl never files or e-files information returns; a person files them, usually through a tax preparer.' },
  { name: 'tin_match_submit', category: 'binding_send', description: 'Pearl never submits tax IDs to an outside matching service.' },
  { name: 'backup_withholding_start', category: 'move_money', description: 'Pearl never starts or changes withholding on a payee.' },
  { name: 'email_send', category: 'binding_send', description: 'Pearl never sends requests; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'pearl-of-filings', version: pkg.version,
  description: 'Gets vendor and owner 1099s ready: totals each payee\'s payments for the tax year against the threshold you give, leaves out card payments, flags missing or malformed tax IDs, missing addresses, shared tax IDs and payees not in the directory, and drafts W-9 requests. Tax IDs are always masked. Filing is a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  sources: {
    payments: { label: 'Payments to vendors and owners', args: ['payments'], fields: PAYMENT_FIELDS, profiles: [] },
    vendors: { label: 'Vendor and owner directory', args: ['vendors'], fields: VENDOR_FIELDS, profiles: VENDOR_PROFILES },
  },
  prompts: [{
    name: 'year_end_1099', title: 'Get 1099s ready',
    description: 'Walks the host model through a year-end 1099 readiness check with Pearl.',
    arguments: [{ name: 'payments', description: 'Payment file', required: true }, { name: 'vendors', description: 'Vendor directory', required: false }, { name: 'tax_year', description: 'Tax year', required: true }, { name: 'threshold', description: 'Threshold from the tax preparer', required: true }],
    text: `You are helping a property manager get 1099s ready with pearl-of-filings. Payments: {{payments}}. Directory: {{vendors}}. Tax year {{tax_year}}, threshold {{threshold}}.

Rules: Pearl never files, never submits tax IDs anywhere and never sends; file_1099, tin_match_submit, backup_withholding_start and email_send are blocked. Never print a full tax ID. Do not say a payee must or need not get a 1099; say what the files show and that the tax preparer confirms. If the person has not given a threshold, ask for the one their tax preparer uses; do not supply one.

1. Call pearl_check. Lead with payees to fix (missing tax ID or address, shared tax IDs, payees not in the directory), then those to confirm, then ready.
2. Call pearl_explain for payees the person asks about.
3. Call pearl_write_report and share the paths.
4. Offer pearl_draft_request for payees to fix; only when the person asks, call pearl_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Pearl allowlist.' }] },
});
