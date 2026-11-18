import { defineManifest, MODEL_PIN, LEASES_SCHEMA, INDEX_SCHEMA, LEDGER_FIELDS, LEDGER_PROFILES, standardTools, refusedTools, isoDate, monthKey, toIcs, writeWorklist } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { checkEscalations, upcoming } from './escalations.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/escalations';
const props = {
  leases: { type: 'string', description: 'Leases JSON (leases schema): rent, steps, escalation clause (fixed_pct, fixed_amount or cpi with floor and cap) and free rent' },
  ledger: { type: 'string', description: 'Tenant ledger or charge register under --root: rent charges by lease or unit and date. AppFolio, Yardi and Buildium ledgers are recognised; codes such as RNT, RNTCOM and words such as Rent, Miete, Loyer, 家賃 are read as rent' },
  from: { type: 'string', description: 'First month to check, YYYY-MM' },
  to: { type: 'string', description: 'Last month to check, YYYY-MM' },
  indexes: { type: 'string', description: 'CPI-style index values JSON for CPI escalations, copied from your source' },
  tolerance: { type: 'number', minimum: 0, maximum: 1000, description: 'Monthly difference ignored, in currency units (default 1)' },
};
const month = (v, n) => { const m = monthKey(v); if (!m) throw new Error(`${n} must be a month as YYYY-MM`); return m; };
const run = (a, ctx) => checkEscalations({ leases: ctx.readJson(a.leases, 'leases'), rows: ctx.records(a.ledger, 'ledger'), from: month(a.from, 'from'), to: `${month(a.to, 'to')}-28`, indexes: a.indexes ? ctx.readJson(a.indexes, 'indexes') : {}, tolerance: a.tolerance ?? 1 });
const std = standardTools({
  prefix: 'escalations', outDir: OUT, props, required: ['leases', 'ledger', 'from', 'to'], run,
  check: { title: 'Check rent billed against the escalation schedules', description: 'For every lease and month, compare rent billed with the lease schedule (steps, fixed percent or amount escalations, CPI with floor and cap, free rent, part months by days). Flags missed escalations, under- and overbilling, months not billed, rent billed during free rent, and CPI months without an index value.' },
  explain: { arg: 'lease', argDoc: 'Lease id, tenant or unit from escalations_check', key: (i) => [i.lease_id, i.tenant, i.unit], title: 'Explain one lease month by month', description: 'Show one lease\'s schedule against what was billed, month by month.',
    describe: (i) => `${i.tenant} (${i.lease_id}): expected ${i.expected_total}, billed ${i.billed_total}, difference ${i.net_difference}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'escalations', description: 'Write the escalation billing worklist',
    title: { en: 'Rent escalations against billing', de: 'Mietanpassungen gegen Sollstellung', fr: 'Indexations de loyer et facturation', es: 'Actualizaciones de renta frente a facturación', pt: 'Reajustes de aluguel versus cobrança', it: 'Adeguamenti del canone e fatturazione', ja: '賃料改定と請求の照合', zh: '租金调整与开票核对', ko: '임대료 인상과 청구 대조' },
    row: (i) => ({ lease_id: i.lease_id, tenant: i.tenant, unit: i.unit, expected_total: i.expected_total, billed_total: i.billed_total, net_difference: i.net_difference, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['lease_id', 'tenant', 'unit', 'expected_total', 'billed_total', 'net_difference', 'status', 'findings', 'reasons'],
    htmlColumns: ['tenant', 'unit', 'expected_total', 'billed_total', 'net_difference', 'status', 'reasons'],
    limits: ['files', 'lease', 'advice', { en: 'CPI escalations use only the index values you supply; nothing is looked up online.', de: 'Indexmieten verwenden nur die von Ihnen gelieferten Indexwerte; nichts wird online abgerufen.', fr: 'Les indexations n’utilisent que les indices que vous fournissez ; rien n’est recherché en ligne.', es: 'Las actualizaciones por IPC solo usan los índices que usted aporta; no se consulta nada en línea.', pt: 'Reajustes por índice usam apenas os valores que você fornece; nada é consultado online.', it: 'Gli adeguamenti ISTAT usano solo gli indici forniti; nulla viene cercato online.', ja: '物価指数による改定は、提供された指数値のみを使います。オンライン検索はしません。', zh: 'CPI 调整只使用您提供的指数值，不在线查询。', ko: '물가지수 인상은 제공한 지수 값만 사용하며 온라인 조회는 하지 않습니다.' }] },
});
const upTool = {
  name: 'escalations_upcoming', kind: 'report', title: 'List upcoming escalations',
  description: `List every rent change between as_of and as_of + days with the old and new rent, and write escalations-upcoming.ics (a calendar file) and escalations-upcoming.csv/.html into out_dir (default ${OUT}).`,
  inputSchema: { type: 'object', additionalProperties: false, required: ['leases', 'as_of'], properties: { leases: props.leases, indexes: props.indexes, as_of: { type: 'string' }, days: { type: 'integer', minimum: 1, maximum: 1095, description: 'How far ahead to look, in days (default 120)' }, out_dir: { type: 'string' } } },
  handler: async (a, ctx) => {
    const asOf = isoDate(a.as_of); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
    const items = upcoming({ leases: ctx.readJson(a.leases, 'leases'), asOf, days: a.days || 120, indexes: a.indexes ? ctx.readJson(a.indexes, 'indexes') : {} });
    const dir = ctx.outDir(a.out_dir || OUT);
    const ics = ctx.writeFile(dir, 'escalations-upcoming.ics', toIcs(items.map((i) => ({ date: i.date, summary: `Rent change ${i.unit} ${i.tenant}: ${i.from_monthly} → ${i.to_monthly ?? '?'}`, description: `${i.reason}. Lease ${i.lease_id}. Check the recurring charge in the property management system.` })), { calName: 'Fairlease rent escalations' }));
    const w = writeWorklist(ctx, a.out_dir || OUT, 'escalations-upcoming', { title: { en: 'Upcoming rent changes', de: 'Anstehende Mietänderungen', fr: 'Changements de loyer à venir', es: 'Próximos cambios de renta', pt: 'Próximas mudanças de aluguel', it: 'Prossime variazioni del canone', ja: '今後の賃料改定', zh: '即将到来的租金调整', ko: '예정된 임대료 변경' }, rows: items, columns: ['date', 'days_away', 'lease_id', 'tenant', 'unit', 'from_monthly', 'to_monthly', 'change', 'reason', 'status'], limits: ['files', 'lease'] });
    return { summary: `${items.length} rent change(s) in the next ${a.days || 120} days from ${asOf}${items.some((i) => i.status === 'review') ? '; some need a CPI value' : ''}.`, items, files: [ics, ...w.files].map((f) => f.slice(ctx.root.length + 1).split('\\').join('/')) };
  },
};
const refused = refusedTools([
  { name: 'post_tenant_charge', category: 'move_money', description: 'Fairlease Rent Escalations never bills a missed escalation or credits an overcharge; your accounting team does after review.' },
  { name: 'pm_system_update', category: 'production_deploy', description: 'Fairlease Rent Escalations never changes recurring charges in the property management system.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-rent-escalations', version: pkg.version,
  description: 'Checks rent billed against each lease\'s escalation schedule, month by month: rent steps, fixed percent or amount increases, CPI with floor and cap from your own index values, free rent and part months. Finds missed escalations and months not billed, and lists the increases coming up as a calendar. Billing is a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { leases: LEASES_SCHEMA, indexes: INDEX_SCHEMA },
  sources: { ledger: { label: 'Tenant ledger or rent charges', args: ['ledger'], fields: LEDGER_FIELDS, profiles: LEDGER_PROFILES } },
  prompts: [{
    name: 'escalation_audit', title: 'Check escalations against billing',
    description: 'Walks the host model through an escalation audit with Fairlease Rent Escalations.',
    arguments: [{ name: 'leases', description: 'Leases JSON', required: true }, { name: 'ledger', description: 'Rent charges or tenant ledger', required: true }, { name: 'from', description: 'First month, YYYY-MM', required: true }, { name: 'to', description: 'Last month, YYYY-MM', required: true }],
    text: `You are helping a property accountant check rent escalations with fairlease-rent-escalations. Leases: {{leases}}. Ledger: {{ledger}}. Months {{from}} to {{to}}.

Rules: Fairlease Rent Escalations never bills or credits anything and never changes recurring charges; post_tenant_charge and pm_system_update are blocked. CPI values come only from the person's index file.

1. Call escalations_check. Report total underbilled, each missed escalation and months not billed.
2. Call escalations_explain for any lease the person asks about and show the month-by-month lines.
3. Call escalations_write_report, then escalations_upcoming for the next 120 days, and share the paths (the .ics opens in any calendar).`,
  }],
  tools: [...std.tools, upTool, ...refused.tools],
  policy: { rules: [...std.rules, { tool: 'escalations_upcoming', decision: 'allow' }, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease Rent Escalations allowlist.' }] },
});
