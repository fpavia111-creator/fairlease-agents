import { defineManifest, MODEL_PIN, CAPEX_FIELDS, standardTools, draftPair, refusedTools, isoDate } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { checkCapex, changeRequestText, CAPEX_POLICY_SCHEMA } from './capex.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/capex';
const props = {
  projects: { type: 'string', description: 'Capital project list or job cost export (CSV, Excel or JSON): project, ID, property, category, status, funding source, start, finish, budget, committed, spent. Several rows per project are added up. Local headers such as 工事名, 予算, 実績 or Presupuesto are read' },
  policy: { type: 'string', description: 'Optional capex policy JSON (capex_policy schema): tolerance_pct, ahead_pct, stalled_days, capitalize_min, reserves (balance per funding source)' },
  as_of: { type: 'string', description: 'Date to judge schedules against, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => {
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  return checkCapex({ rows: ctx.records(a.projects, 'projects'), policy: a.policy ? ctx.readJson(a.policy, 'capex_policy') : {}, asOf });
};
const std = standardTools({
  prefix: 'capex', outDir: OUT, props, required: ['projects'], run,
  check: { title: 'Check capital projects', description: 'Every project against its budget: over budget, heading over (spent plus open commitments), spending ahead of the schedule, past its finish date, not started, completed with open commitments, no budget. With reserve balances, shows whether each funding source covers the remaining budgets.' },
  explain: { arg: 'project', argDoc: 'Project ID or name from capex_check', key: (i) => [i.project_id, i.project], title: 'Explain one project', description: 'Show one project\'s budget, spend, commitments, dates and findings.',
    describe: (i) => `${i.project_id ? `${i.project_id} ` : ''}${i.project} (${i.status || 'no status'}, ${i.funding}): budget ${i.budget ?? 'none'}, spent ${i.spent}, committed ${i.committed}, spent plus committed ${i.forecast}${i.finish ? `, finish ${i.finish}` : ''}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'capex', description: 'Write the capital projects worklist',
    title: { en: 'Capital projects', de: 'Investitionsprojekte', fr: 'Projets d’investissement', es: 'Proyectos de capital', pt: 'Projetos de capital', it: 'Progetti di investimento', ja: '大規模修繕・設備投資', zh: '资本性项目', ko: '자본적 지출 공사' },
    row: (i) => ({ id: i.project_id, item: i.project, budget: i.budget, actual: i.spent, committed: i.committed, remaining: i.remaining, deadline: i.finish || '', status: i.state, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['id', 'item', 'budget', 'actual', 'committed', 'remaining', 'deadline', 'status', 'findings', 'reasons'],
    htmlColumns: ['id', 'item', 'budget', 'actual', 'committed', 'deadline', 'status', 'reasons'],
    sections: (r) => r.reserves.length ? [{ title: { en: 'Reserves', de: 'Rücklagen', fr: 'Réserves', es: 'Reservas', pt: 'Reservas', it: 'Riserve', ja: '積立金', zh: '储备金', ko: '적립금' }, rows: r.reserves.map((x) => ({ item: x.funding, amount: x.balance, remaining: x.remaining_budgets, reasons: x.detail })), columns: ['item', 'amount', 'remaining', 'reasons'] }] : [],
    limits: ['files', 'advice', { en: 'Fairlease Capital Projects adds up the budgets, commitments and spend in your files. It does not read contracts or invoices, and whether a cost is capitalized is your accountant\'s decision.', de: 'Fairlease Capital Projects summiert Budgets, Aufträge und Ausgaben aus Ihren Dateien. Es liest keine Verträge oder Rechnungen; ob Kosten aktiviert werden, entscheidet Ihre Buchhaltung.', fr: 'Fairlease Capital Projects additionne budgets, engagements et dépenses de vos fichiers. Il ne lit ni contrats ni factures ; l’immobilisation d’un coût relève de votre comptable.', es: 'Fairlease Capital Projects suma presupuestos, compromisos y gastos de sus archivos. No lee contratos ni facturas; si un costo se capitaliza lo decide su contador.', pt: 'O Fairlease Capital Projects soma orçamentos, compromissos e gastos dos seus arquivos. Não lê contratos nem notas; se um custo é capitalizado é decisão do seu contador.', it: 'Fairlease Capital Projects somma budget, impegni e spese dai vostri file. Non legge contratti né fatture; se un costo va capitalizzato lo decide il vostro commercialista.', ja: 'Fairlease Capital Projects はファイル内の予算・発注残・実績を集計します。契約書や請求書は読まず、資産計上の判断は会計担当者が行います。', zh: 'Fairlease Capital Projects 汇总文件中的预算、承诺和支出，不读取合同或发票；是否资本化由您的会计决定。', ko: 'Fairlease Capital Projects은 파일의 예산, 발주액, 지출을 합산합니다. 계약서나 송장은 읽지 않으며 자산화 여부는 회계 담당자가 결정합니다.' }] },
});
const pair = draftPair({
  prefix: 'capex', noun: 'request', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/request-<project>.md: a budget change request to the owner for a project over budget, heading over or with no budget, with the figures from the file. Marked DRAFT; new budget and reason are [TO CONFIRM] unless given. Sending goes through capex_request_send (one click).',
  required: ['projects', 'project'],
  args: { ...props, project: { type: 'string', description: 'Project ID or name from capex_check' }, to: { type: 'string', description: 'Owner or asset manager' }, new_budget: { type: 'number', minimum: 0, description: 'Requested new budget' }, reason: { type: 'string', maxLength: 1500, description: 'Why the cost changed' }, reply_by: { type: 'string', description: 'Reply-by date' }, from: { type: 'string', description: 'Your name and contact' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const q = String(a.project).trim().toLowerCase();
    const it = r.items.find((i) => [i.project_id, i.project].some((v) => String(v).toLowerCase() === q)) || r.items.find((i) => q.length >= 3 && i.project.toLowerCase().includes(q));
    if (!it) throw new Error(`no project "${a.project}" in the file`);
    if (!it.findings.some((f) => ['over_budget', 'forecast_over', 'no_budget'].includes(f.code))) throw new Error(`${it.project} is within its budget; no change request is needed`);
    return { id: it.project_id || it.project, to: a.to || undefined, text: changeRequestText(it, a) };
  },
});
const refused = refusedTools([
  { name: 'approve_change_order', category: 'move_money', description: 'Fairlease Capital Projects never approves a change order or raises a budget; the owner decides.' },
  { name: 'approve_invoice', category: 'move_money', description: 'Fairlease Capital Projects never approves or pays a contractor invoice.' },
  { name: 'gl_post', category: 'production_deploy', description: 'Fairlease Capital Projects never posts journal entries or capitalizes costs in your books.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairlease Capital Projects never sends requests; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-capital-projects', version: pkg.version,
  description: 'Tracks capital projects against budget, open commitments, schedule and reserve balances, flags overruns, late and stalled projects, and drafts budget change requests for owners. Approving change orders, paying invoices and booking costs are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { capex_policy: CAPEX_POLICY_SCHEMA },
  sources: { projects: { label: 'Capital projects', args: ['projects'], fields: CAPEX_FIELDS, profiles: [] } },
  prompts: [{
    name: 'capex_review', title: 'Review capital projects',
    description: 'Walks the host model through a monthly capital projects review with Fairlease Capital Projects.',
    arguments: [{ name: 'projects', description: 'Project list or job cost export', required: true }, { name: 'policy', description: 'Capex policy JSON', required: false }],
    text: `You are helping an asset or property manager review capital projects with fairlease-capital-projects. Projects: {{projects}}. Policy: {{policy}}.

Rules: Fairlease Capital Projects never approves change orders, pays invoices or posts entries; approve_change_order, approve_invoice, gl_post and email_send are blocked. Capitalization is the accountant's decision.

1. Call capex_check. Lead with reserve shortfalls, then projects over or heading over budget, then late and stalled ones.
2. Call capex_explain for projects the person asks about.
3. Call capex_write_report and share the paths.
4. Offer capex_draft_request for projects over budget; only when the person asks, call capex_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease Capital Projects allowlist.' }] },
});
