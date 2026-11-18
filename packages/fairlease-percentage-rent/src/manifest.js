import { defineManifest, MODEL_PIN, LEASES_SCHEMA, INDEX_SCHEMA, SALES_FIELDS, LEDGER_FIELDS, LEDGER_PROFILES, standardTools, draftPair, refusedTools } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { computeOverage, statementText } from './overage.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/overage';
const props = {
  leases: { type: 'string', description: 'Leases JSON under --root (leases schema). Leases with a percentage_rent clause are checked: rate, natural or fixed breakpoint, lease year start month, report due days' },
  sales: { type: 'string', description: 'Tenant sales reports (CSV, Excel or JSON): tenant or lease, month, gross sales, exclusions, date received. Months such as 2025-03, Mar 2025, 03/2025 or 2025年3月 are read' },
  year: { type: 'integer', minimum: 1990, maximum: 2200, description: 'Lease year to work out, by the calendar year it starts in (a February lease year 2025 runs Feb 2025 to Jan 2026)' },
  billed: { type: 'string', description: 'Optional tenant ledger with percentage rent already billed (codes such as PCT, OVG or words such as percentage rent, Umsatzmiete). Without it nothing billed is subtracted' },
  billed_through: { type: 'string', description: 'Optional date: also count percentage rent billed after the lease year ends, up to this date (annual true-ups billed in the spring)' },
  as_of: { type: 'string', description: 'Date reports are judged against, YYYY-MM-DD (default today). A report is missing only once it is due' },
  indexes: { type: 'string', description: 'Optional CPI-style index values JSON, needed only for leases whose base rent escalates by CPI' },
  tolerance: { type: 'number', minimum: 0, maximum: 1000, description: 'Balance ignored, in currency units (default 1)' },
};
const run = (a, ctx) => computeOverage({ leases: ctx.readJson(a.leases, 'leases'), rows: ctx.records(a.sales, 'sales'), year: a.year, billedRows: a.billed ? ctx.records(a.billed, 'billed') : null, billedThrough: a.billed_through, asOf: a.as_of, indexes: a.indexes ? ctx.readJson(a.indexes, 'indexes') : {}, tolerance: a.tolerance ?? 1 });
const std = standardTools({
  prefix: 'overage', outDir: OUT, props, required: ['leases', 'sales', 'year'], run,
  check: { title: 'Work out percentage rent for the year', description: 'For every lease with a percentage rent clause: net sales for the lease year, the breakpoint (natural from scheduled base rent, or fixed and prorated for a partial year), percentage rent earned, amounts already billed and the balance. Flags missing, late, revised and conflicting sales reports, and stays at review until every month is in.' },
  explain: { arg: 'tenant', argDoc: 'Lease id, tenant name or unit from overage_check', key: (i) => [i.lease_id, i.tenant, i.unit], title: 'Explain one tenant\'s percentage rent', description: 'Show one lease\'s sales month by month, the breakpoint and how it was set, percentage rent, billed and balance, with every finding.',
    describe: (i) => `${i.tenant} (${i.unit}, ${i.lease_id}), lease year ${i.lease_year}: net sales ${i.net_sales}, breakpoint ${i.breakpoint} (${i.breakpoint_basis}), percentage rent ${i.owed ?? 'not final'}, billed ${i.billed ?? 'n/a'}, ${i.balance === null ? 'balance not final' : `${i.direction} ${Math.abs(i.balance)}`}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'overage', description: 'Write the percentage rent worklist',
    title: { en: 'Percentage rent', de: 'Umsatzmiete', fr: 'Loyer variable sur chiffre d’affaires', es: 'Renta variable por ventas', pt: 'Aluguel percentual sobre vendas', it: 'Canone variabile sul fatturato', ja: '歩合賃料', zh: '营业额提成租金', ko: '매출 연동 임대료' },
    row: (i) => ({ lease_id: i.lease_id, tenant: i.tenant, unit: i.unit, lease_year: i.lease_year, net_sales: i.net_sales, breakpoint: i.breakpoint, owed: i.owed, billed: i.billed, balance: i.balance, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['lease_id', 'tenant', 'unit', 'lease_year', 'net_sales', 'breakpoint', 'owed', 'billed', 'balance', 'status', 'findings', 'reasons'],
    htmlColumns: ['tenant', 'unit', 'net_sales', 'breakpoint', 'owed', 'billed', 'balance', 'status', 'reasons'],
    sections: (r) => [{ title: { en: 'Sales rows that matched no lease', de: 'Umsatzzeilen ohne Mietvertrag', fr: 'Lignes de ventes sans bail', es: 'Filas de ventas sin contrato', pt: 'Linhas de vendas sem contrato', it: 'Righe di vendita senza contratto', ja: 'リースに一致しない売上行', zh: '未匹配租约的销售行', ko: '임대차와 맞지 않는 매출 행' }, rows: r.unmatched, columns: ['tenant', 'unit', 'period', 'gross_sales'] }],
    limits: ['files', 'lease', 'advice', { en: 'Percentage rent is worked out yearly on net sales (gross less the exclusions in your file). Monthly breakpoints, tiered rates and audit rights are not modelled.', de: 'Die Umsatzmiete wird jährlich auf den Nettoumsatz (brutto abzüglich der Abzüge in Ihrer Datei) berechnet. Monatliche Schwellen, Staffelsätze und Prüfungsrechte sind nicht abgebildet.', fr: 'Le loyer variable est calculé à l’année sur le chiffre d’affaires net (brut moins les déductions du fichier). Seuils mensuels, taux par paliers et droits d’audit ne sont pas modélisés.', es: 'La renta variable se calcula por año sobre ventas netas (brutas menos las deducciones del archivo). No se modelan umbrales mensuales, tramos ni derechos de auditoría.', pt: 'O aluguel percentual é calculado por ano sobre vendas líquidas (brutas menos as deduções do arquivo). Limites mensais, faixas e direitos de auditoria não são modelados.', it: 'Il canone variabile è calcolato annualmente sulle vendite nette (lorde meno le detrazioni del file). Soglie mensili, aliquote a scaglioni e diritti di verifica non sono modellati.', ja: '歩合賃料は年単位で純売上（総売上から控除額を差し引いた額）に対して計算します。月次の基準額、段階料率、監査権は扱いません。', zh: '提成租金按年以净销售额（总额减去文件中的扣除额）计算。不处理按月门槛、阶梯费率和审计权。', ko: '매출 연동 임대료는 순매출(총매출에서 파일의 공제액을 뺀 금액)로 연 단위 계산합니다. 월별 기준액, 단계 요율, 감사권은 다루지 않습니다.' }] },
});
const pair = draftPair({
  prefix: 'overage', noun: 'statement', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/statement-<lease>.md: the tenant\'s percentage rent statement (sales by month, breakpoint, rate, earned, billed, balance). When reports are missing it drafts a request for the missing reports instead. Marked DRAFT; open items are [TO CONFIRM]. Sending goes through overage_request_send (one click).',
  required: ['leases', 'sales', 'year', 'tenant'],
  args: { ...props, tenant: { type: 'string', description: 'Lease id from overage_check' }, to: { type: 'string', description: 'Tenant notice address or billing contact' }, from: { type: 'string', description: 'Landlord or manager name for the signature' }, due_note: { type: 'string', description: 'Payment or credit timing sentence under the lease' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const it = r.items.find((i) => i.lease_id === String(a.tenant).trim());
    if (!it) throw new Error(`lease ${a.tenant} has no percentage rent for lease year ${a.year}; leases checked: ${r.items.map((i) => i.lease_id).join(', ') || 'none'}`);
    if (it.owed === null && !it.findings.some((f) => f.code === 'sales_missing')) throw new Error(`${it.lease_id} needs review before a statement: ${it.findings.map((f) => f.detail).join(' ')}`);
    return { id: it.lease_id, to: a.to, amount: it.owed === null ? undefined : it.balance, text: statementText(it, r, a) };
  },
});
const refused = refusedTools([
  { name: 'post_tenant_charge', category: 'move_money', description: 'Fairlease Percentage Rent never bills percentage rent or credits a tenant; your accounting team posts the approved amount.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairlease Percentage Rent never sends statements or report requests; a person sends the approved draft.' },
  { name: 'start_sales_audit', category: 'binding_send', description: 'Fairlease Percentage Rent never invokes a lease audit right or demands a tenant\'s books; that is a decision for the landlord and counsel.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-percentage-rent', version: pkg.version,
  description: 'Works out percentage (overage) rent from tenant sales reports: natural or fixed breakpoints, partial lease years, exclusions, amounts already billed and the balance, with late, missing and revised reports flagged and tenant statements drafted. Billing and sending are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { leases: LEASES_SCHEMA, indexes: INDEX_SCHEMA },
  sources: {
    sales: { label: 'Tenant sales reports', args: ['sales'], fields: SALES_FIELDS, profiles: [] },
    billed: { label: 'Tenant ledger or percentage rent billed', args: ['billed'], fields: LEDGER_FIELDS, profiles: LEDGER_PROFILES },
  },
  prompts: [{
    name: 'percentage_rent', title: 'Work out percentage rent for the year',
    description: 'Walks the host model through a year-end percentage rent review with Fairlease Percentage Rent.',
    arguments: [{ name: 'leases', description: 'Leases JSON', required: true }, { name: 'sales', description: 'Tenant sales reports', required: true }, { name: 'year', description: 'Lease year (YYYY)', required: true }],
    text: `You are helping a retail property manager work out percentage rent with fairlease-percentage-rent. Leases: {{leases}}. Sales reports: {{sales}}. Lease year {{year}}.

Rules: Fairlease Percentage Rent never bills, credits or sends, and never starts a sales audit; post_tenant_charge, email_send and start_sales_audit are blocked. Results follow the person's own lease file; they are not a legal reading of any lease.

1. Call overage_check (add the billed ledger if the person has one). Report percentage rent earned, balances due, and every tenant at review with what is missing.
2. Call overage_explain for any tenant the person asks about.
3. Call overage_write_report and share the paths.
4. Offer overage_draft_statement per tenant; for a tenant with missing reports the draft is a request for them. Show the draft path and any [TO CONFIRM] markers.
5. Only when the person asks, call overage_request_send for a reviewed draft. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease Percentage Rent allowlist.' }] },
});
