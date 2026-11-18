import { defineManifest, MODEL_PIN, BUDGET_FIELDS, GL_FIELDS, GL_PROFILES, standardTools, draftPair, refusedTools, isoDate } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { checkBudget, memoText, BUDGET_POLICY_SCHEMA } from './budgets.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/budget';
const props = {
  budget: { type: 'string', description: 'Budget by account and month (CSV, Excel or JSON): one row per account with a column per month, or one row per account and month with budget (and optionally actual). Local headers such as 勘定科目コード, 予算, 実績 or Presupuesto are read' },
  actuals: { type: 'string', description: 'Optional actuals: a twelve-month income statement (a column per month) or general ledger detail (date or period, debit and credit or amount). AppFolio, Yardi and Buildium general ledger layouts are recognised. Without it, actual on the budget rows is used' },
  policy: { type: 'string', description: 'Budget policy JSON (budget_policy schema): month, fiscal_start_month, threshold_pct and threshold_amount from your management agreement, basis (ptd, ytd, both), explain (unfavorable or both), account prefixes, explanations per account' },
  as_of: { type: 'string', description: 'Date whose month is reported when the policy names no month, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => {
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  return checkBudget({ budgetRows: ctx.records(a.budget, 'budget'), actualRows: a.actuals ? ctx.records(a.actuals, 'actuals') : null, policy: a.policy ? ctx.readJson(a.policy, 'budget_policy') : {}, asOf });
};
const std = standardTools({
  prefix: 'budget', outDir: OUT, props, required: ['budget'], run,
  check: { title: 'Compare budget and actual', description: 'Per account, for the month and year to date: variances over both your percentage and amount thresholds (favorable and unfavorable, or unfavorable only), spend on accounts with no budget, expenses forecast over the annual budget, budgets unused. NOI against budget. Explanations you enter in the policy are carried into the memo.' },
  explain: { arg: 'account', argDoc: 'Account number from budget_check', key: (i) => [i.account, i.name], title: 'Explain one account', description: 'Show one account\'s month and year-to-date budget, actual, variance and forecast.',
    describe: (i) => `${i.account} ${i.name} (${i.kind}): ${i.status}. Month ${i.ptd_actual} against ${i.ptd_budget} (${i.ptd_variance}); year to date ${i.ytd_actual} against ${i.ytd_budget} (${i.ytd_variance}); forecast ${i.forecast} against annual ${i.annual_budget}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'budget', description: 'Write the budget variance worklist',
    title: { en: 'Budget against actual', de: 'Budget-Ist-Vergleich', fr: 'Budget et réalisé', es: 'Presupuesto frente a real', pt: 'Orçado versus realizado', it: 'Budget e consuntivo', ja: '予算実績比較', zh: '预算与实际对比', ko: '예산 대비 실적' },
    row: (i) => ({ account: i.account, account_name: i.name, budget: i.ytd_budget, actual: i.ytd_actual, variance: i.ytd_variance, variance_pct: i.ytd_variance_pct, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['account', 'account_name', 'budget', 'actual', 'variance', 'variance_pct', 'status', 'findings', 'reasons'],
    htmlColumns: ['account', 'account_name', 'budget', 'actual', 'variance', 'variance_pct', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Fairlease Budget Variance compares the figures in your budget and actuals files and applies the thresholds you set. It does not know why a variance happened; explanations come from you.', de: 'Fairlease Budget Variance vergleicht die Zahlen Ihrer Budget- und Ist-Dateien mit Ihren Schwellen. Es weiß nicht, warum eine Abweichung entstand; Erläuterungen kommen von Ihnen.', fr: 'Fairlease Budget Variance compare les chiffres de vos fichiers de budget et de réalisé selon vos seuils. Il ne sait pas pourquoi un écart survient ; les explications viennent de vous.', es: 'Fairlease Budget Variance compara las cifras de sus archivos de presupuesto y real con sus umbrales. No sabe por qué ocurrió una variación; las explicaciones las aporta usted.', pt: 'O Fairlease Budget Variance compara os números dos arquivos de orçamento e realizado com os seus limites. Não sabe por que uma variação ocorreu; as explicações vêm de você.', it: 'Fairlease Budget Variance confronta le cifre dei file di budget e consuntivo con le vostre soglie. Non sa perché uno scostamento è avvenuto; le spiegazioni sono vostre.', ja: 'Fairlease Budget Variance は予算と実績のファイルの数字を、設定したしきい値で比較します。差異の理由はわからないため、説明はご自身で入力してください。', zh: 'Fairlease Budget Variance 按您设定的阈值比较预算与实际文件中的数字，不知道差异的原因；说明由您提供。', ko: 'Fairlease Budget Variance은 예산과 실적 파일의 수치를 설정한 기준으로 비교합니다. 차이의 원인은 알 수 없으므로 설명은 직접 입력합니다.' }] },
});
const pair = draftPair({
  prefix: 'budget', noun: 'memo', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/memo-<month>.md: the owner\'s variance report with NOI and a table of accounts over the thresholds, using the explanations in your policy and [TO CONFIRM] for the rest. Marked DRAFT. Sending goes through budget_request_send (one click).',
  required: ['budget'],
  args: { ...props, property: { type: 'string', maxLength: 200, description: 'Property name' }, to: { type: 'string', description: 'Owner' }, from: { type: 'string', description: 'Your name and contact' } },
  build: (a, ctx) => { const r = run(a, ctx); return { id: r.month, to: a.to || undefined, text: memoText(r, a) }; },
});
const refused = refusedTools([
  { name: 'budget_update', category: 'production_deploy', description: 'Fairlease Budget Variance never changes the budget in your accounting system; the owner approves budget changes.' },
  { name: 'gl_post', category: 'production_deploy', description: 'Fairlease Budget Variance never posts or reclassifies journal entries.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairlease Budget Variance never sends the memo; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-budget-variance', version: pkg.version,
  description: 'Compares actuals with the budget by account for the month and year to date, flags the variances your management agreement says must be explained, unbudgeted spend and the year-end forecast, and drafts the owner\'s variance memo. Changing budgets and books is a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { budget_policy: BUDGET_POLICY_SCHEMA },
  sources: {
    budget: { label: 'Budget', args: ['budget'], fields: BUDGET_FIELDS, profiles: [] },
    actuals: { label: 'Actuals', args: ['actuals'], fields: GL_FIELDS, profiles: GL_PROFILES },
  },
  prompts: [{
    name: 'budget_variance', title: 'Monthly budget variance',
    description: 'Walks the host model through the monthly budget variance report with Fairlease Budget Variance.',
    arguments: [{ name: 'budget', description: 'Budget file', required: true }, { name: 'actuals', description: 'Actuals', required: false }, { name: 'policy', description: 'Budget policy JSON', required: false }],
    text: `You are helping a property manager prepare the monthly budget variance report with fairlease-budget-variance. Budget: {{budget}}. Actuals: {{actuals}}. Policy: {{policy}}.

Rules: Fairlease Budget Variance never changes budgets or books; budget_update, gl_post and email_send are blocked. Never invent an explanation for a variance; ask the person.

1. Call budget_check. Lead with NOI against budget, then accounts that need an explanation, then forecast overruns.
2. Call budget_explain for accounts the person asks about, and ask for the reason behind each unexplained variance.
3. Call budget_write_report and share the paths.
4. Offer budget_draft_memo; only when the person asks, call budget_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease Budget Variance allowlist.' }] },
});
