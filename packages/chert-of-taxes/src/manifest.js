import { defineManifest, MODEL_PIN, TAX_FIELDS, standardTools, refusedTools, isoDate, toIcs, writeWorklist } from 'keystone-core';
import { readFileSync } from 'node:fs';
import { checkTaxes, TAX_POLICY_SCHEMA } from './taxes.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/chert';
const props = {
  taxes: { type: 'string', description: 'Property tax file (CSV, Excel or JSON), one row per installment or per parcel and year: property, parcel, tax year, assessed value, prior value, appeal deadline (as printed on the notice), due date, amount, paid. Local headers such as Parcelle, Einheitswert, 納期限 or IBI are read' },
  policy: { type: 'string', description: 'Optional tax policy JSON (tax_policy schema): appeal_review_pct, due_soon_days, tolerance, appeal_deadlines per parcel (dates you copied from notices)' },
  as_of: { type: 'string', description: 'Date to judge due dates against, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => {
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  return checkTaxes({ rows: ctx.records(a.taxes, 'taxes'), policy: a.policy ? ctx.readJson(a.policy, 'tax_policy') : {}, asOf });
};
const std = standardTools({
  prefix: 'chert', outDir: OUT, props, required: ['taxes'], run,
  check: { title: 'Check property taxes', description: 'Per parcel and year: assessed value up more than appeal_review_pct (with or without an appeal deadline entered), appeal deadlines you entered coming up, installments overdue, short, overpaid or due soon. Chert never works out a deadline; it only uses dates you copy from notices.' },
  explain: { arg: 'parcel', argDoc: 'Parcel number from chert_check', key: (i) => [i.parcel], title: 'Explain one parcel', description: 'Show one parcel\'s assessment, deadline, installments and findings.',
    describe: (i) => `${i.parcel}${i.property ? ` (${i.property})` : ''}, ${i.year ?? 'year unknown'}: ${i.status.replace(/_/g, ' ')}. Assessed ${i.assessed ?? '-'}${i.change_pct !== null ? ` (${i.change_pct >= 0 ? '+' : ''}${i.change_pct}% from ${i.prior})` : ''}; appeal deadline ${i.appeal_deadline || 'not entered'}; billed ${i.billed}, paid ${i.paid}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'chert-taxes', description: 'Write the property tax worklist',
    title: { en: 'Property taxes', de: 'Grundsteuer', fr: 'Taxes foncières', es: 'Impuestos sobre inmuebles', pt: 'Impostos sobre imóveis', it: 'Imposte sugli immobili', ja: '固定資産税', zh: '房产税', ko: '재산세' },
    row: (i) => ({ property: i.property, parcel: i.parcel, assessed_value: i.assessed, change_pct: i.change_pct, deadline: i.appeal_deadline || '', billed: i.billed, amount: i.paid, balance: i.outstanding, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['property', 'parcel', 'assessed_value', 'change_pct', 'deadline', 'billed', 'amount', 'balance', 'status', 'findings', 'reasons'],
    htmlColumns: ['property', 'parcel', 'assessed_value', 'change_pct', 'deadline', 'balance', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Chert uses only the values and deadlines in your files. It does not look up assessments or tax rules, and it never works out an appeal deadline; confirm each date with the notice or a tax advisor.', de: 'Chert verwendet nur Werte und Fristen aus Ihren Dateien. Es ruft keine Bescheide oder Steuerregeln ab und berechnet nie eine Einspruchsfrist; prüfen Sie jedes Datum am Bescheid oder mit Ihrer Steuerberatung.', fr: 'Chert n’utilise que les valeurs et délais de vos fichiers. Il ne consulte ni avis ni règles fiscales et ne calcule jamais un délai de réclamation ; vérifiez chaque date sur l’avis ou auprès d’un conseiller fiscal.', es: 'Chert solo usa los valores y plazos de sus archivos. No consulta valoraciones ni normas fiscales y nunca calcula un plazo de recurso; confirme cada fecha con la notificación o un asesor fiscal.', pt: 'O Chert usa apenas os valores e prazos dos seus arquivos. Não consulta avaliações nem regras fiscais e nunca calcula um prazo de impugnação; confirme cada data com a notificação ou um consultor tributário.', it: 'Chert usa solo valori e scadenze dei vostri file. Non consulta valutazioni né norme fiscali e non calcola mai un termine di ricorso; verificate ogni data con l’avviso o un consulente fiscale.', ja: 'Chert はファイル内の評価額と期限だけを使います。評価額や税制を調べることはなく、審査申出期限を計算することもありません。各日付は通知書または税理士に確認してください。', zh: 'Chert 只使用文件中的数值和期限，不查询评估或税务规则，也从不推算复议期限；请以通知书或税务顾问核实每个日期。', ko: 'Chert는 파일의 값과 기한만 사용합니다. 공시가격이나 세법을 조회하지 않으며 이의신청 기한을 계산하지 않습니다. 각 날짜는 고지서나 세무 전문가에게 확인하세요.' }] },
});
const calTool = {
  name: 'chert_calendar', kind: 'report', title: 'Write the tax calendar',
  description: `Write chert-calendar.ics (installments still owed and appeal deadlines you entered, from as_of on) and chert-calendar.csv/.html into out_dir (default ${OUT}). Opens in any calendar app.`,
  inputSchema: { type: 'object', additionalProperties: false, required: ['taxes'], properties: { ...props, out_dir: { type: 'string', description: `Folder for the files (default ${OUT})` } } },
  handler: async (a, ctx) => {
    const r = run(a, ctx); const dir = ctx.outDir(a.out_dir || OUT);
    const ics = ctx.writeFile(dir, 'chert-calendar.ics', toIcs(r.events, { calName: 'Keystone property taxes' }));
    const w = writeWorklist(ctx, a.out_dir || OUT, 'chert-calendar', { title: { en: 'Property tax calendar', de: 'Grundsteuer-Termine', fr: 'Calendrier des taxes foncières', es: 'Calendario de impuestos sobre inmuebles', pt: 'Calendário de impostos sobre imóveis', it: 'Scadenzario imposte sugli immobili', ja: '固定資産税カレンダー', zh: '房产税日历', ko: '재산세 일정' }, rows: r.events.map((e) => ({ date: e.date, description: e.summary, reasons: e.description })), columns: ['date', 'description', 'reasons'], limits: ['files', 'advice'] });
    return { summary: `${r.events.length} date(s) from ${r.as_of}: ${r.events.filter((e) => /appeal/i.test(e.summary)).length} appeal deadline(s) you entered, ${r.events.filter((e) => /due/i.test(e.summary)).length} installment(s) still owed.`, events: r.events, files: [ics, ...w.files].map((f) => f.slice(ctx.root.length + 1).split('\\').join('/')) };
  },
};
const refused = refusedTools([
  { name: 'file_tax_appeal', category: 'binding_send', description: 'Chert never files an appeal or protest; a person or tax advisor does.' },
  { name: 'pay_tax', category: 'move_money', description: 'Chert never pays a tax bill or schedules a payment.' },
  { name: 'gl_post', category: 'production_deploy', description: 'Chert never posts accruals or payments to your books.' },
]);

export const manifest = defineManifest({
  name: 'chert-of-taxes', version: pkg.version,
  description: 'Tracks property tax assessments, installments and the appeal deadlines you enter: flags large assessment increases, missing deadlines, unpaid or short installments, and writes a calendar of due dates. It never works out a deadline, files an appeal or pays a bill.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { tax_policy: TAX_POLICY_SCHEMA },
  sources: { taxes: { label: 'Property tax file', args: ['taxes'], fields: TAX_FIELDS, profiles: [] } },
  prompts: [{
    name: 'tax_review', title: 'Review property taxes',
    description: 'Walks the host model through a property tax review with Chert.',
    arguments: [{ name: 'taxes', description: 'Property tax file', required: true }, { name: 'policy', description: 'Tax policy JSON', required: false }],
    text: `You are helping an owner or property manager review property taxes with chert-of-taxes. Taxes: {{taxes}}. Policy: {{policy}}.

Rules: Chert never files appeals, pays bills or posts entries; file_tax_appeal, pay_tax and gl_post are blocked. Never state an appeal deadline that is not in the file; ask the person to copy it from the notice.

1. Call chert_check. Lead with installments past due, then large assessment increases and their deadlines (or the lack of one), then what is due soon.
2. Call chert_explain for parcels the person asks about.
3. Call chert_write_report and chert_calendar, and share the paths (the .ics opens in any calendar).`,
  }],
  tools: [...std.tools, calTool, ...refused.tools],
  policy: { rules: [...std.rules, { tool: 'chert_calendar', decision: 'allow' }, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Chert allowlist.' }] },
});
