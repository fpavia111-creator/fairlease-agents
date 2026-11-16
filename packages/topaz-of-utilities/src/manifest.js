import { defineManifest, MODEL_PIN, LEDGER_FIELDS, LEDGER_PROFILES, UTILITY_BILL_FIELDS, UNIT_FIELDS, standardTools, refusedTools } from 'keystone-core';
import { readFileSync } from 'node:fs';
import { checkRubs, RUBS_SCHEMA } from './rubs.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/topaz';
const props = {
  bills: { type: 'string', description: 'Utility bills (CSV, Excel or JSON): utility, service from and to, amount, optional common-area amount' },
  occupancy: { type: 'string', description: 'Occupancy rows: unit, tenant, square feet, occupants, move-in and move-out. One row per tenancy; a unit with no tenant row on a day is vacant that day (owner\'s share)' },
  rubs: { type: 'string', description: 'RUBS JSON (rubs schema): for each utility the method (sqft, occupants, units or a weighted mix), common_area_pct, words that name it on charges, optional cap_per_unit; vacant_occupants, billing_window_days, spike_pct, tolerance' },
  billed: { type: 'string', description: 'Optional tenant ledger with the utility charges billed (codes such as UTIL, WTR, TRASH or words such as water, sewer, trash). Without it Topaz only works out the split' },
};
const run = (a, ctx) => checkRubs({ bills: ctx.records(a.bills, 'bills'), occupancy: ctx.records(a.occupancy, 'occupancy'), billedRows: a.billed ? ctx.records(a.billed, 'billed') : null, cfg: ctx.readJson(a.rubs, 'rubs') });
const std = standardTools({
  prefix: 'topaz', outDir: OUT, props, required: ['bills', 'occupancy', 'rubs'], run,
  check: { title: 'Re-work the RUBS split and check what was billed', description: 'For every bill: take off the common area, split the rest by your method with each tenancy weighted by days occupied (vacant days are the owner\'s share), then compare with the utility charges billed after the period. Flags over-recovery, vacant units billed, duplicates, over- and underbilling, and bills that spike against earlier ones.' },
  explain: { arg: 'unit', argDoc: 'Unit or tenant from topaz_check', key: (i) => [i.unit, i.tenant], title: 'Explain one unit\'s utility charges', description: 'Show one unit\'s split and billed amounts across bills, with every finding.',
    describe: (i) => `Unit ${i.unit}${i.tenant ? ` (${i.tenant})` : ''}: split ${i.allowed}, billed ${i.billed ?? 'n/a'}${i.difference !== null ? `, difference ${i.difference}` : ''}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'topaz-rubs', description: 'Write the RUBS worklist',
    title: { en: 'Utility billback (RUBS) check', de: 'Prüfung der Nebenkostenumlage (Verbrauch)', fr: 'Contrôle de la refacturation des fluides', es: 'Revisión del prorrateo de servicios', pt: 'Conferência do rateio de consumo', it: 'Verifica del riparto utenze', ja: '水道光熱費按分の確認', zh: '公用事业费分摊核对', ko: '공과금 배분 점검' },
    row: (i) => ({ unit: i.unit, tenant: i.tenant, scheduled: i.allowed, billed: i.billed, difference: i.difference, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['unit', 'tenant', 'scheduled', 'billed', 'difference', 'status', 'findings', 'reasons'],
    htmlColumns: ['unit', 'tenant', 'scheduled', 'billed', 'difference', 'status', 'reasons'],
    sections: (r) => [
      { title: { en: 'Bills', de: 'Rechnungen', fr: 'Factures', es: 'Facturas', pt: 'Contas', it: 'Bollette', ja: '請求書', zh: '账单', ko: '고지서' }, rows: r.periods.map((p) => ({ category: p.utility, date: `${p.from} – ${p.to}`, amount: p.amount, owner_share: p.owner_share, billed: p.billed, reasons: p.findings.map((f) => f.detail).join(' ') })), columns: ['category', 'date', 'amount', 'owner_share', 'billed', 'reasons'] },
      { title: { en: 'Utility charges that matched no bill', de: 'Umlagen ohne Rechnung', fr: 'Refacturations sans facture', es: 'Cargos sin factura', pt: 'Cobranças sem conta', it: 'Addebiti senza bolletta', ja: '請求書に一致しない請求', zh: '无对应账单的收费', ko: '고지서와 맞지 않는 청구' }, rows: r.unmatched_charges, columns: ['unit', 'tenant', 'date', 'amount'] },
    ],
    limits: ['files', 'lease', 'advice', { en: 'The split follows the method in your RUBS file. Whether and how utilities may be billed back is set by your leases and local rules, which Topaz does not check.', de: 'Die Umlage folgt dem Schlüssel in Ihrer Datei. Ob und wie umgelegt werden darf, regeln Ihre Mietverträge und örtliche Vorschriften; Topaz prüft das nicht.', fr: 'La répartition suit la méthode de votre fichier. Le droit de refacturer dépend de vos baux et des règles locales, que Topaz ne vérifie pas.', es: 'El reparto sigue el método de su archivo. Si se puede repercutir y cómo lo fijan sus contratos y normas locales, que Topaz no revisa.', pt: 'O rateio segue o método do seu arquivo. Se e como repassar depende dos contratos e das regras locais, que o Topaz não verifica.', it: 'Il riparto segue il metodo del vostro file. Se e come riaddebitare dipende dai contratti e dalle norme locali, che Topaz non verifica.', ja: '按分はファイルで指定した方式に従います。請求の可否や方法は賃貸契約と地域の規則によるもので、Topaz は確認しません。', zh: '分摊按您文件中的方法计算。能否以及如何向租户收取取决于租约和当地规定，Topaz 不作核查。', ko: '배분은 파일에 지정한 방식을 따릅니다. 청구 가능 여부와 방법은 임대차 계약과 지역 규정에 따르며 Topaz는 확인하지 않습니다.' }] },
});
const refused = refusedTools([
  { name: 'post_tenant_charge', category: 'move_money', description: 'Topaz never posts utility charges or credits; your billing team does after review.' },
  { name: 'utility_portal_update', category: 'production_deploy', description: 'Topaz never changes billing settings in a utility billing or property management system.' },
]);

export const manifest = defineManifest({
  name: 'topaz-of-utilities', version: pkg.version,
  description: 'Re-works RUBS utility billbacks from the bills and occupancy by your own method: common area off, tenancies weighted by days, vacant days to the owner. Compares with what was billed and flags over-recovery, vacant units billed, duplicates and bills that spike. Billing is a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { rubs: RUBS_SCHEMA },
  sources: {
    bills: { label: 'Utility bills', args: ['bills'], fields: UTILITY_BILL_FIELDS, profiles: [] },
    occupancy: { label: 'Occupancy', args: ['occupancy'], fields: UNIT_FIELDS, profiles: [] },
    billed: { label: 'Tenant ledger with utility charges', args: ['billed'], fields: LEDGER_FIELDS, profiles: LEDGER_PROFILES },
  },
  prompts: [{
    name: 'rubs_check', title: 'Check utility billbacks',
    description: 'Walks the host model through a RUBS check with Topaz.',
    arguments: [{ name: 'bills', description: 'Utility bills', required: true }, { name: 'occupancy', description: 'Occupancy rows', required: true }, { name: 'rubs', description: 'RUBS JSON', required: true }],
    text: `You are helping a residential property manager check utility billbacks (RUBS) with topaz-of-utilities. Bills: {{bills}}. Occupancy: {{occupancy}}. RUBS file: {{rubs}}.

Rules: Topaz never posts charges or changes billing settings; post_tenant_charge and utility_portal_update are blocked. Whether utilities may be billed back is for the person's leases and local rules; do not state what is allowed.

1. Call topaz_check (add the billed ledger if there is one). Lead with any over-recovery and any bill spike (a spike may be a leak worth fixing before anyone is billed).
2. Call topaz_explain for units the person asks about.
3. Call topaz_write_report and share the paths.`,
  }],
  tools: [...std.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Topaz allowlist.' }] },
});
