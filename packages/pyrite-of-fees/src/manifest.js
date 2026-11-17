import { defineManifest, MODEL_PIN, OWNER_LEDGER_FIELDS, RENT_ROLL_FIELDS, RENT_ROLL_PROFILES, standardTools, draftPair, refusedTools } from 'keystone-core';
import { readFileSync } from 'node:fs';
import { checkFees, creditText, AGREEMENTS_SCHEMA } from './fees.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/pyrite';
const props = {
  ledger: { type: 'string', description: 'Owner ledger detail (CSV, Excel or JSON): owner, property, date, type, account, description, cash in and cash out (or a signed amount). Fees are recognised by their wording in nine languages. Local headers such as Propriétaire, Recettes or Dépenses are read' },
  agreements: { type: 'string', description: 'Management agreement terms JSON (agreements schema), one entry per owner and property: management_fee_pct or flat_monthly, minimum and maximum, excluded_income words, leasing_fee and renewal_fee (flat or pct_of_monthly_rent), maintenance_markup_pct, other_fees allowed' },
  rent_roll: { type: 'string', description: 'Optional rent roll, to price leasing and renewal fees set as a percentage of the unit\'s rent' },
  period: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Only check this month, YYYY-MM (default all months in the ledger)' },
};
const run = (a, ctx) => checkFees({ ledgerRows: ctx.records(a.ledger, 'ledger'), agreements: ctx.readJson(a.agreements, 'agreements'), rentRoll: a.rent_roll ? ctx.records(a.rent_roll, 'rent_roll') : null, period: a.period || null });
const std = standardTools({
  prefix: 'pyrite', outDir: OUT, props, required: ['ledger', 'agreements'], run,
  check: { title: 'Check fees against agreements', description: 'Per owner and month: the management fee recomputed from the agreement (percent of collected income less excluded items, flat, minimum, maximum), leasing and renewal fees, maintenance markup against the bills it applies to, fees charged twice, and fees the agreement does not provide for.' },
  explain: { arg: 'owner', argDoc: 'Owner or property name from pyrite_check', key: (i) => [i.owner, i.property], title: 'Explain one owner', description: 'Show one owner\'s fees for each month against the agreement.',
    describe: (i) => `${i.owner}, ${i.property}, ${i.period}: ${i.status}. Collected ${i.collected}, fee base ${i.fee_base}; management fee expected ${i.expected_management_fee ?? '-'}, charged ${i.charged_management_fee}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'pyrite-fees', description: 'Write the fee review worklist',
    title: { en: 'Management fees against agreements', de: 'Verwaltergebühren gegen Verträge', fr: 'Honoraires de gestion et mandats', es: 'Honorarios de gestión frente a contratos', pt: 'Taxas de administração versus contratos', it: 'Compensi di gestione e mandati', ja: '管理手数料と委託契約の照合', zh: '管理费与合同核对', ko: '관리수수료와 계약 대조' },
    row: (i) => ({ owner: i.owner, property: i.property, period: i.period, expected: i.expected_management_fee, actual: i.charged_management_fee, fees: i.fees_charged, difference: i.overcharge, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['owner', 'property', 'period', 'expected', 'actual', 'fees', 'difference', 'status', 'findings', 'reasons'],
    htmlColumns: ['owner', 'property', 'period', 'expected', 'actual', 'difference', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Pyrite applies the agreement terms you entered to the ledger lines in your file. It does not read the agreements themselves; check unusual terms against the signed agreement.', de: 'Pyrite wendet die eingetragenen Vertragsbedingungen auf die Buchungen Ihrer Datei an. Es liest die Verträge nicht selbst; prüfen Sie ungewöhnliche Klauseln am unterschriebenen Vertrag.', fr: 'Pyrite applique les conditions saisies aux lignes de votre fichier. Il ne lit pas les mandats eux-mêmes ; vérifiez les clauses inhabituelles sur le mandat signé.', es: 'Pyrite aplica las condiciones introducidas a las líneas de su archivo. No lee los contratos; compruebe las cláusulas inusuales en el contrato firmado.', pt: 'O Pyrite aplica as condições informadas às linhas do seu arquivo. Não lê os contratos; confira cláusulas incomuns no contrato assinado.', it: 'Pyrite applica le condizioni inserite alle righe del file. Non legge i mandati; verificate le clausole insolite sul mandato firmato.', ja: 'Pyrite は入力された契約条件をファイルの明細に当てはめます。契約書そのものは読みません。通常と異なる条項は署名済み契約で確認してください。', zh: 'Pyrite 将录入的合同条款应用于文件中的明细，不读取合同原文；特殊条款请对照已签合同核实。', ko: 'Pyrite는 입력된 계약 조건을 파일의 내역에 적용합니다. 계약서 자체는 읽지 않으니 특이 조항은 서명된 계약서로 확인하세요.' }] },
});
const pair = draftPair({
  prefix: 'pyrite', noun: 'credit', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/credit-<property>-<period>.md: a fee correction note to the owner listing each fee above or outside the agreement and the total to be credited. Marked DRAFT. Sending goes through pyrite_request_send (one click); the credit itself is posted by a person.',
  required: ['ledger', 'agreements', 'owner'],
  args: { ...props, owner: { type: 'string', description: 'Owner or property name from pyrite_check' }, for_period: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Month of the correction (default the latest month with an overcharge)' }, to: { type: 'string', description: 'Owner email' }, credit_on: { type: 'string', maxLength: 300, description: 'Where the credit will appear, for example the November statement' }, from: { type: 'string', description: 'Your name and contact' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const q = String(a.owner).trim().toLowerCase();
    const mine = r.items.filter((i) => [i.owner, i.property].some((v) => v.toLowerCase() === q || (q.length >= 3 && v.toLowerCase().includes(q))) && i.overcharge > 0 && (!a.for_period || i.period === a.for_period)).sort((x, y) => y.period.localeCompare(x.period));
    if (!mine.length) throw new Error(`no fees above or outside the agreement for "${a.owner}"`);
    return { id: `${mine[0].property}-${mine[0].period}`, to: a.to || undefined, text: creditText(mine[0], a) };
  },
});
const refused = refusedTools([
  { name: 'post_owner_credit', category: 'move_money', description: 'Pyrite never posts a credit or refund to an owner; a person does after review.' },
  { name: 'fee_setup_update', category: 'production_deploy', description: 'Pyrite never changes fee setups in your property management system.' },
  { name: 'email_send', category: 'binding_send', description: 'Pyrite never sends notes; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'pyrite-of-fees', version: pkg.version,
  description: 'Recomputes the management, leasing, renewal and markup fees charged to each owner from the terms of their management agreement, and flags overcharges, undercharges, duplicates and fees the agreement does not provide for. Drafts fee correction notes. Crediting owners and changing fee setups are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { agreements: AGREEMENTS_SCHEMA },
  sources: {
    ledger: { label: 'Owner ledger', args: ['ledger'], fields: OWNER_LEDGER_FIELDS, profiles: [] },
    rent_roll: { label: 'Rent roll', args: ['rent_roll'], fields: RENT_ROLL_FIELDS, profiles: RENT_ROLL_PROFILES },
  },
  prompts: [{
    name: 'fee_review', title: 'Review fees against agreements',
    description: 'Walks the host model through a fee review with Pyrite.',
    arguments: [{ name: 'ledger', description: 'Owner ledger', required: true }, { name: 'agreements', description: 'Agreement terms JSON', required: true }, { name: 'rent_roll', description: 'Rent roll', required: false }],
    text: `You are helping a property management firm review owner fees against management agreements with pyrite-of-fees. Ledger: {{ledger}}. Agreements: {{agreements}}. Rent roll: {{rent_roll}}.

Rules: Pyrite never posts credits or changes fee setups; post_owner_credit, fee_setup_update and email_send are blocked.

1. Call pyrite_check. Lead with the total overcharge, then duplicates and fees outside the agreement, then management fee differences.
2. Call pyrite_explain for owners the person asks about.
3. Call pyrite_write_report and share the paths.
4. Offer pyrite_draft_credit per owner; only when the person asks, call pyrite_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Pyrite allowlist.' }] },
});
