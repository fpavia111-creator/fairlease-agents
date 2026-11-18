import { defineManifest, MODEL_PIN, WORK_ORDER_FIELDS, WORK_ORDER_PROFILES, standardTools, refusedTools, isoDate } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { checkWorkOrders, WO_POLICY_SCHEMA } from './workorders.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/workorders';
const props = {
  work_orders: { type: 'string', description: 'Work orders (CSV, Excel or JSON): number, unit, category, description, priority, status, vendor, created, completed, cost. AppFolio, Buildium and Yardi service-request exports are recognised' },
  policy: { type: 'string', description: 'Optional policy JSON: complete_days by priority (your own targets; default emergency 1, high 3, normal 7, low 14), repeat_days, stale_days, unassigned_days, outlier_factor, emergency_words' },
  as_of: { type: 'string', description: 'Date to age open orders to, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => { const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD'); return checkWorkOrders({ rows: ctx.records(a.work_orders, 'work_orders'), policy: a.policy ? ctx.readJson(a.policy, 'workorder_policy') : {}, asOf }); };
const std = standardTools({
  prefix: 'workorders', outDir: OUT, props, required: ['work_orders'], run,
  check: { title: 'Age the work orders', description: 'Ages every work order against your targets by priority, and flags likely emergencies filed as routine (leaks, no heat, gas, sparks; words in nine languages), open orders past target or stale, orders with no vendor, repeat problems in the same unit, and cost outliers. Includes a vendor scorecard and units with many orders.' },
  explain: { arg: 'work_order', argDoc: 'Work order number or unit from workorders_check', key: (i) => [i.work_order, i.unit], title: 'Explain one work order', description: 'Show one order\'s age against target, vendor, cost and findings.',
    describe: (i) => `${i.work_order} unit ${i.unit} (${i.category}, ${i.priority}): "${i.description}", ${i.open ? 'open' : 'completed'} ${i.days_open} day(s), target ${i.target_days}${i.vendor ? `, ${i.vendor}` : ', no vendor'}${i.cost !== null ? `, cost ${i.cost}` : ''}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'workorders', description: 'Write the work-order worklist',
    title: { en: 'Work orders', de: 'Instandhaltungsaufträge', fr: 'Demandes d’intervention', es: 'Órdenes de trabajo', pt: 'Ordens de serviço', it: 'Ordini di lavoro', ja: '修繕依頼', zh: '维修工单', ko: '작업 지시' },
    row: (i) => ({ work_order: i.work_order, unit: i.unit, category: i.category, priority: i.priority, vendor: i.vendor, date: i.created, days_open: i.days_open, amount: i.cost, status: i.open ? (i.status === 'issue' ? 'overdue' : 'review') : i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['work_order', 'unit', 'category', 'priority', 'vendor', 'date', 'days_open', 'amount', 'status', 'findings', 'reasons'],
    htmlColumns: ['work_order', 'unit', 'category', 'priority', 'vendor', 'days_open', 'status', 'reasons'],
    sections: (r) => [{ title: { en: 'Vendor scorecard', de: 'Dienstleisterbewertung', fr: 'Bilan des prestataires', es: 'Desempeño de proveedores', pt: 'Desempenho de fornecedores', it: 'Valutazione fornitori', ja: '業者別の実績', zh: '供应商表现', ko: '업체별 실적' }, rows: r.vendors, columns: ['vendor', 'count', 'open', 'average_days', 'on_time_pct', 'total'] }],
    limits: ['files', 'advice', { en: 'Targets are yours. A likely-emergency flag is a prompt to look today; it is not a safety assessment.', de: 'Die Zielzeiten sind Ihre. Ein Notfall-Hinweis heißt: heute ansehen; er ist keine Sicherheitsbewertung.', fr: 'Les délais cibles sont les vôtres. Un signal d’urgence invite à regarder aujourd’hui ; ce n’est pas une évaluation de sécurité.', es: 'Los plazos son suyos. Una alerta de posible emergencia invita a revisar hoy; no es una evaluación de seguridad.', pt: 'Os prazos são seus. Um alerta de possível emergência pede olhar hoje; não é avaliação de segurança.', it: 'I tempi obiettivo sono vostri. Un segnale di possibile emergenza invita a guardare oggi; non è una valutazione di sicurezza.', ja: '目標日数は利用者の設定です。緊急の可能性の表示は当日確認のための目安で、安全評価ではありません。', zh: '目标时限由您设定。可能紧急的提示是请今天查看，并非安全评估。', ko: '목표 일수는 사용자 설정입니다. 긴급 가능성 표시는 오늘 확인하라는 신호이며 안전 평가가 아닙니다.' }] },
});
const refused = refusedTools([
  { name: 'vendor_dispatch', category: 'binding_send', description: 'Fairlease Work Orders never dispatches, reassigns or schedules a vendor.' },
  { name: 'approve_invoice', category: 'move_money', description: 'Fairlease Work Orders never approves or pays a vendor invoice.' },
  { name: 'close_work_order', category: 'production_deploy', description: 'Fairlease Work Orders never opens, closes or changes work orders in the property management system.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-work-orders', version: pkg.version,
  description: 'Ages open work orders against your own targets by priority, flags likely emergencies filed as routine, repeat problems in the same unit, orders with no vendor and cost outliers, and scores vendors on time and cost. Dispatching and paying are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { workorder_policy: WO_POLICY_SCHEMA },
  sources: { work_orders: { label: 'Work orders', args: ['work_orders'], fields: WORK_ORDER_FIELDS, profiles: WORK_ORDER_PROFILES } },
  prompts: [{
    name: 'work_order_review', title: 'Review work orders',
    description: 'Walks the host model through a daily work-order review with Fairlease Work Orders.',
    arguments: [{ name: 'work_orders', description: 'Work order export', required: true }, { name: 'policy', description: 'Policy JSON', required: false }],
    text: `You are helping a maintenance manager review work orders with fairlease-work-orders. Work orders: {{work_orders}}. Policy: {{policy}}.

Rules: Fairlease Work Orders never dispatches vendors, pays invoices or changes work orders; vendor_dispatch, approve_invoice and close_work_order are blocked. A possible-emergency flag means a person should look today; never tell anyone a condition is safe.

1. Call workorders_check. Lead with every possible emergency, then open orders past target and unassigned ones, then repeats and cost outliers.
2. Call workorders_explain for orders the person asks about.
3. Call workorders_write_report and share the paths (it includes the vendor scorecard).`,
  }],
  tools: [...std.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease Work Orders allowlist.' }] },
});
