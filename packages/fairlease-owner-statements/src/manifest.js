import { defineManifest, MODEL_PIN, OWNER_STATEMENT_FIELDS, OWNER_LEDGER_FIELDS, standardTools, draftPair, refusedTools } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { checkStatements, contributionText, STATEMENT_POLICY_SCHEMA } from './statements.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/statements';
const props = {
  statements: { type: 'string', description: 'Owner statement summaries (CSV, Excel or JSON), one row per owner, property and period: beginning cash, income, expenses, management fee, distribution, reserve, ending cash. Several periods let Fairlease Owner Statements check each beginning against the last ending. Local headers such as Saldo inicial, Honorarios de gestión or 期末残高 are read' },
  ledger: { type: 'string', description: 'Optional owner ledger detail (date, owner, property, type, description, cash in and cash out or amount) to check the statement totals' },
  policy: { type: 'string', description: 'Optional statement policy JSON (statement_policy schema): reserves per property from your management agreements, default_reserve, distribution_min, tolerance, fee_in_expenses, period' },
};
const run = (a, ctx) => checkStatements({ rows: ctx.records(a.statements, 'statements'), ledgerRows: a.ledger ? ctx.records(a.ledger, 'ledger') : null, policy: a.policy ? ctx.readJson(a.policy, 'statement_policy') : {} });
const std = standardTools({
  prefix: 'statements', outDir: OUT, props, required: ['statements'], run,
  check: { title: 'Check owner statements', description: 'Each owner statement before it goes out: the arithmetic, beginning against last period\'s ending, ending below the reserve or negative, distributions that left less than the reserve, cash above the reserve not distributed, and income, expenses and fee against the owner ledger.' },
  explain: { arg: 'owner', argDoc: 'Owner or property name from statements_check (latest period)', key: (i) => (i.current ? [i.owner, i.property] : []), title: 'Explain one statement', description: 'Show one owner\'s latest statement line by line with findings.',
    describe: (i) => `${i.owner}, ${i.property}, ${i.period}: ${i.status}. Beginning ${i.beginning} + income ${i.income} − expenses ${i.expenses} − fee ${i.fee} − distribution ${i.distribution} → ending ${i.ending} (reserve ${i.reserve}). ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'statements', description: 'Write the owner statement worklist',
    title: { en: 'Owner statements', de: 'Eigentümerabrechnungen', fr: 'Relevés propriétaires', es: 'Liquidaciones a propietarios', pt: 'Prestações de contas aos proprietários', it: 'Rendiconti ai proprietari', ja: 'オーナー収支報告書', zh: '业主对账单', ko: '소유주 정산서' },
    row: (i) => ({ owner: i.owner, property: i.property, period: i.period, income: i.income, expenses: i.expenses, fees: i.fee, payout: i.distribution, ending_balance: i.ending, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['owner', 'property', 'period', 'income', 'expenses', 'fees', 'payout', 'ending_balance', 'status', 'findings', 'reasons'],
    htmlColumns: ['owner', 'property', 'period', 'ending_balance', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Fairlease Owner Statements checks the statement figures against each other, the prior period and your owner ledger. Reserves come from your management agreements as you enter them.', de: 'Fairlease Owner Statements prüft die Zahlen der Abrechnung gegeneinander, gegen die Vorperiode und gegen Ihr Eigentümerkonto. Rücklagen stammen aus Ihren Verwalterverträgen, so wie Sie sie eintragen.', fr: 'Fairlease Owner Statements vérifie les chiffres du relevé entre eux, avec la période précédente et avec votre compte propriétaire. Les réserves viennent de vos mandats, telles que vous les saisissez.', es: 'Fairlease Owner Statements comprueba las cifras de la liquidación entre sí, con el periodo anterior y con su mayor del propietario. Las reservas salen de sus contratos de gestión tal como las introduce.', pt: 'O Fairlease Owner Statements confere os números da prestação de contas entre si, com o período anterior e com o razão do proprietário. As reservas vêm dos seus contratos de administração, como você as informa.', it: 'Fairlease Owner Statements verifica le cifre del rendiconto tra loro, con il periodo precedente e con il partitario del proprietario. Le riserve vengono dai vostri mandati di gestione come le inserite.', ja: 'Fairlease Owner Statements は報告書の数字同士、前期、オーナー元帳と照合します。留保金は管理委託契約に基づき入力された値を使います。', zh: 'Fairlease Owner Statements 将对账单数字相互核对，并与上期和业主明细账核对。储备金取自您录入的管理合同约定。', ko: 'Fairlease Owner Statements는 정산서 수치를 서로, 전기, 소유주 원장과 대조합니다. 유보금은 관리계약에 따라 입력한 값을 사용합니다.' }] },
});
const pair = draftPair({
  prefix: 'statements', noun: 'request', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/request-<property>.md: an owner contribution request for a negative balance or a reserve shortfall on the latest statement. Marked DRAFT; reason, due date and payment instructions are [TO CONFIRM] unless given. Sending goes through statements_request_send (one click).',
  required: ['statements', 'owner'],
  args: { ...props, owner: { type: 'string', description: 'Owner or property name from statements_check' }, to: { type: 'string', description: 'Owner email' }, amount: { type: 'number', minimum: 0, description: 'Amount to request (default: the shortfall)' }, reason: { type: 'string', maxLength: 1000, description: 'What the shortfall paid for' }, due: { type: 'string', description: 'Due date' }, pay_to: { type: 'string', maxLength: 500, description: 'How to pay' }, from: { type: 'string', description: 'Your name and contact' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const q = String(a.owner).trim().toLowerCase();
    const it = r.items.find((i) => i.current && [i.owner, i.property].some((v) => v.toLowerCase() === q)) || r.items.find((i) => i.current && q.length >= 3 && `${i.owner} ${i.property}`.toLowerCase().includes(q));
    if (!it) throw new Error(`no ${r.period} statement for "${a.owner}"`);
    if (!it.findings.some((f) => ['negative_balance', 'reserve_short', 'distribution_below_reserve'].includes(f.code))) throw new Error(`${it.owner} (${it.property}) is at or above the reserve; no contribution is needed`);
    return { id: it.property, to: a.to || undefined, text: contributionText(it, a) };
  },
});
const refused = refusedTools([
  { name: 'owner_distribution', category: 'move_money', description: 'Fairlease Owner Statements never pays or holds an owner distribution.' },
  { name: 'statement_publish', category: 'binding_send', description: 'Fairlease Owner Statements never publishes statements to the owner portal; a person does after review.' },
  { name: 'gl_post', category: 'production_deploy', description: 'Fairlease Owner Statements never posts corrections to your books.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairlease Owner Statements never sends requests; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-owner-statements', version: pkg.version,
  description: 'Checks owner statements before they go out: the arithmetic, beginning against last period\'s ending, reserves, distributions made below the reserve, negative balances, and totals against the owner ledger. Drafts owner contribution requests. Paying owners and publishing statements are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { statement_policy: STATEMENT_POLICY_SCHEMA },
  sources: {
    statements: { label: 'Owner statements', args: ['statements'], fields: OWNER_STATEMENT_FIELDS, profiles: [] },
    ledger: { label: 'Owner ledger', args: ['ledger'], fields: OWNER_LEDGER_FIELDS, profiles: [] },
  },
  prompts: [{
    name: 'owner_statement_review', title: 'Review owner statements',
    description: 'Walks the host model through the monthly owner statement review with Fairlease Owner Statements.',
    arguments: [{ name: 'statements', description: 'Owner statement summaries', required: true }, { name: 'ledger', description: 'Owner ledger detail', required: false }, { name: 'policy', description: 'Statement policy JSON', required: false }],
    text: `You are helping a property management accountant review owner statements with fairlease-owner-statements. Statements: {{statements}}. Ledger: {{ledger}}. Policy: {{policy}}.

Rules: Fairlease Owner Statements never pays owners, publishes statements or posts entries; owner_distribution, statement_publish, gl_post and email_send are blocked.

1. Call statements_check. Lead with statements that must be fixed before sending (math, beginning balance, ledger mismatches), then negative balances and reserve shortfalls.
2. Call statements_explain for owners the person asks about.
3. Call statements_write_report and share the paths.
4. Offer statements_draft_request for negative balances; only when the person asks, call statements_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease Owner Statements allowlist.' }] },
});
