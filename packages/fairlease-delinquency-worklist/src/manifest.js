import { defineManifest, MODEL_PIN, LEASES_SCHEMA, LEDGER_FIELDS, LEDGER_PROFILES, AGING_FIELDS, AGING_PROFILES, standardTools, draftPair, refusedTools, isoDate } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { checkDelinquency, reminderText, POLICY_SCHEMA } from './delinquency.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/delinquency';
const props = {
  ledger: { type: 'string', description: 'Tenant ledger (CSV, Excel or JSON) with charges and payments; Fairlease Delinquency Worklist ages it itself, oldest charges paid first. AppFolio, Yardi and Buildium ledgers are recognised. Give this or aging' },
  aging: { type: 'string', description: 'Aging or delinquency report with balance and 0-30/31-60/61-90/90+ columns (AppFolio Delinquency, Yardi Aged Receivables, Buildium Outstanding balances). Give this or ledger' },
  as_of: { type: 'string', description: 'Date to age to, YYYY-MM-DD (default today)' },
  leases: { type: 'string', description: 'Optional leases JSON: deposits, lease ends and scheduled rent for the delinquency rate' },
  policy: { type: 'string', description: 'Optional policy JSON: grace_days, late_fee (flat or pct, max), min_balance, your own stages (days and name), payment_plans. Late-fee checks run only when it gives grace_days and late_fee' },
};
const run = (a, ctx) => {
  if (!a.ledger === !a.aging) throw new Error('give exactly one of ledger or aging');
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  return checkDelinquency({ ledgerRows: a.ledger ? ctx.records(a.ledger, 'ledger') : null, agingRows: a.aging ? ctx.records(a.aging, 'aging') : null, leases: a.leases ? ctx.readJson(a.leases, 'leases') : null, policy: a.policy ? ctx.readJson(a.policy, 'policy') : {}, asOf });
};
const std = standardTools({
  prefix: 'delinquency', outDir: OUT, props, required: [], run,
  check: { title: 'Build the delinquency worklist', description: 'Age every tenant balance (from a ledger, oldest first, or from an aging report), put each delinquent tenant at a stage from your own policy, and check late fees against your grace period and fee cap. Payment plans pause reminders. Lists credits and balances under your minimum separately.' },
  explain: { arg: 'tenant', argDoc: 'Unit, tenant name or lease id from delinquency_check', key: (i) => [i.lease_id, i.tenant, i.unit], title: 'Explain one tenant\'s balance', description: 'Show one tenant\'s open charges by age, stage, deposit, last payment and every finding.',
    describe: (i) => `${i.tenant} (unit ${i.unit}): balance ${i.balance}, oldest ${i.oldest_days} days, ${i.status}${i.stage ? `, stage ${i.stage.replace(/_/g, ' ')}` : ''}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'delinquency', description: 'Write the delinquency worklist',
    title: { en: 'Delinquency worklist', de: 'Mietrückstände', fr: 'Impayés de loyer', es: 'Morosidad', pt: 'Inadimplência', it: 'Morosità', ja: '滞納一覧', zh: '欠租清单', ko: '연체 목록' },
    row: (i) => ({ unit: i.unit, tenant: i.tenant, balance: i.balance, b_1_30: i['b_1-30'], b_31_60: i['b_31-60'], b_61_90: i['b_61-90'], b_90_plus: i['b_90+'], last_payment: i.last_payment, stage: i.stage, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['unit', 'tenant', 'balance', 'b_1_30', 'b_31_60', 'b_61_90', 'b_90_plus', 'last_payment', 'stage', 'status', 'findings', 'reasons'],
    htmlColumns: ['unit', 'tenant', 'balance', 'b_1_30', 'b_31_60', 'b_61_90', 'b_90_plus', 'stage', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Stages and late fees follow the policy file you give. Fairlease Delinquency Worklist drafts courtesy reminders only; legal notices, filings and credit reporting are for a person and counsel.', de: 'Stufen und Mahngebühren folgen Ihrer Richtliniendatei. Fairlease Delinquency Worklist entwirft nur freundliche Erinnerungen; rechtliche Mahnungen, Klagen und Meldungen sind Sache einer Person und eines Anwalts.', fr: 'Étapes et pénalités suivent votre fichier de règles. Fairlease Delinquency Worklist ne rédige que des rappels amiables ; mises en demeure, procédures et signalements relèvent d’une personne et d’un avocat.', es: 'Etapas y recargos siguen su archivo de reglas. Fairlease Delinquency Worklist solo redacta recordatorios amables; avisos legales, demandas y reportes son tarea de una persona y su abogado.', pt: 'Etapas e multas seguem o seu arquivo de regras. Fairlease Delinquency Worklist só redige lembretes cordiais; notificações legais, ações e cadastros de inadimplentes cabem a uma pessoa e ao advogado.', it: 'Fasi e penali seguono il vostro file di regole. Fairlease Delinquency Worklist redige solo promemoria cortesi; diffide, azioni legali e segnalazioni spettano a una persona e al legale.', ja: '段階と遅延損害金は指定のポリシーファイルに従います。Fairlease Delinquency Worklist が作るのは丁寧な督促の下書きだけで、法的通知・訴訟・信用情報への登録は担当者と弁護士が判断します。', zh: '阶段和滞纳金按您的规则文件执行。Fairlease Delinquency Worklist 只起草礼貌提醒；法律通知、诉讼和征信上报由人员和律师决定。', ko: '단계와 연체료는 지정한 정책 파일을 따릅니다. Fairlease Delinquency Worklist는 정중한 안내문 초안만 쓰며, 법적 통지·소송·신용정보 등록은 담당자와 변호사가 결정합니다.' }] },
});
const pair = draftPair({
  prefix: 'delinquency', noun: 'reminder', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/reminder-<unit>.md: a courtesy payment reminder listing the open charges, marked DRAFT and "not a legal notice". Refused for tenants on a payment plan, in collections, or with nothing owed. Sending goes through delinquency_request_send (one click).',
  required: ['tenant'],
  args: { ...props, tenant: { type: 'string', description: 'Unit, tenant name or lease id from delinquency_check' }, to: { type: 'string', description: 'Tenant email or mailing address' }, from: { type: 'string', description: 'Manager name and contact for the signature' }, pay_note: { type: 'string', description: 'How to pay (portal link, office hours)' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const q = String(a.tenant).trim().toLowerCase();
    const it = r.items.find((i) => [i.lease_id, i.unit, i.tenant].some((k) => String(k ?? '').toLowerCase() === q));
    if (!it) throw new Error(`no tenant "${a.tenant}" in the balances`);
    if (it.status !== 'delinquent') throw new Error(`${it.tenant} has nothing to remind about (status ${it.status})`);
    if (it.stage === 'on_plan') throw new Error(`${it.tenant} is on a payment plan; reminders are paused`);
    if (it.findings.some((f) => f.code === 'in_collections')) throw new Error(`${it.tenant} is already in collections`);
    return { id: it.unit, to: a.to, amount: it.balance, text: reminderText(it, { ...a, as_of: r.as_of }) };
  },
});
const refused = refusedTools([
  { name: 'serve_legal_notice', category: 'binding_send', description: 'Fairlease Delinquency Worklist never drafts or serves a notice to pay or quit or any other legal notice; that is for a person and counsel under local law.' },
  { name: 'file_eviction', category: 'binding_send', description: 'Fairlease Delinquency Worklist never files an eviction or any court paper.' },
  { name: 'report_to_credit_bureau', category: 'binding_send', description: 'Fairlease Delinquency Worklist never reports a tenant to a credit bureau or collection agency.' },
  { name: 'post_tenant_charge', category: 'move_money', description: 'Fairlease Delinquency Worklist never posts late fees, reverses fees or applies payments; your accounting team does.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairlease Delinquency Worklist never sends reminders; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-delinquency-worklist', version: pkg.version,
  description: 'Turns a tenant ledger or aging report into a delinquency worklist: balances by age, stages from your own policy, late fees checked against your grace period and cap, payment plans, and courtesy reminder drafts. Never serves notices, files evictions or reports to credit bureaus.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { leases: LEASES_SCHEMA, policy: POLICY_SCHEMA },
  sources: {
    ledger: { label: 'Tenant ledger', args: ['ledger'], fields: LEDGER_FIELDS, profiles: LEDGER_PROFILES },
    aging: { label: 'Aging or delinquency report', args: ['aging'], fields: AGING_FIELDS, profiles: AGING_PROFILES },
  },
  prompts: [{
    name: 'delinquency_review', title: 'Review delinquency',
    description: 'Walks the host model through a weekly delinquency review with Fairlease Delinquency Worklist.',
    arguments: [{ name: 'ledger', description: 'Tenant ledger (or pass an aging report as aging)', required: true }, { name: 'policy', description: 'Policy JSON', required: false }],
    text: `You are helping a property manager review delinquency with fairlease-delinquency-worklist. Ledger: {{ledger}}. Policy: {{policy}}.

Rules: Fairlease Delinquency Worklist drafts courtesy reminders only. serve_legal_notice, file_eviction, report_to_credit_bureau, post_tenant_charge and email_send are blocked; do not call them and do not write legal notices yourself. Talk about balances, not about the tenant as a person.

1. Call delinquency_check. Report the total delinquent, how much is over 60 days, how many tenants are at each stage, and any late fees to look at.
2. Call delinquency_explain for tenants the person asks about.
3. Call delinquency_write_report and share the paths.
4. Offer delinquency_draft_reminder for tenants at a reminder stage. Show the draft path and [TO CONFIRM] markers.
5. Only when the person asks, call delinquency_request_send for a reviewed draft. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease Delinquency Worklist allowlist.' }] },
});
