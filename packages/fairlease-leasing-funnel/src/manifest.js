import { defineManifest, MODEL_PIN, LEAD_FIELDS, LEAD_PROFILES, standardTools, draftPair, refusedTools, memoryTools, isoDate } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { checkLeads, followUpText, LEAD_POLICY_SCHEMA } from './leads.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/leads';
const MEMORY_KINDS = {
  source_alias: {
    description: 'Another name your system uses for a lead source (for example "ILS - Zillow" is "Zillow").',
    effect: 'counts leads from that source name under the given source in the funnel and cost table; never changes a lead, a date or a target',
    schema: { type: 'object', additionalProperties: false, required: ['alias', 'source'], properties: { alias: { type: 'string', minLength: 1, maxLength: 100 }, source: { type: 'string', minLength: 1, maxLength: 100 } } },
  },
};
const props = {
  leads: { type: 'string', description: 'Guest cards or lead export (CSV, Excel or JSON): lead ID, property, name, email, phone, source, unit type, date received, first response, tour, application, approval, lease signed, status, lost reason. AppFolio guest cards are recognised; local headers such as Fecha de contacto, Anfragedatum, Date de demande or 問合せ日 are read' },
  policy: { type: 'string', description: 'Optional targets JSON (lead_policy schema): respond_within_days (default 1), follow_up_days (3), stale_days (30), approved_days (7), duplicate_days (30), spend per source, source_aliases, from and to dates' },
  as_of: { type: 'string', description: 'Date to judge against, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => {
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  const learned = Object.fromEntries(ctx.memoryFacts('source_alias').map((f) => [f.value.alias, f.value.source]));
  return checkLeads({ leads: ctx.records(a.leads, 'leads'), policy: a.policy ? ctx.readJson(a.policy, 'lead_policy') : {}, asOf, learned });
};
const std = standardTools({
  prefix: 'leads', outDir: OUT, props, required: ['leads'], run,
  check: { title: 'Check the leasing funnel', description: 'Every lead against your targets: no response or a late first response, follow-ups due, approved applicants with no lease, stale open leads, duplicates (same email, phone or name), lost leads with no reason, and dates out of order. Also a table by source (leads counted once, response on time, tours, applications, leases, lead-to-lease rate and cost per lease when you give spend) and the lost reasons.' },
  explain: { arg: 'id', argDoc: 'Lead ID or name from leads_check', key: (i) => [i.id, i.name], title: 'Explain one lead', description: 'Show one lead\'s source, stage, last step and each finding.',
    describe: (i) => `${i.id} ${i.name} (${i.source}, came in ${i.created || '?'}): ${i.stage}, ${i.status}. Last step ${i.last_step || 'none'}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'leads', description: 'Write the leasing funnel worklist',
    title: { en: 'Leasing funnel', de: 'Vermietungstrichter', fr: 'Entonnoir de location', es: 'Embudo de alquiler', pt: 'Funil de locação', it: 'Funnel di locazione', ja: '募集から契約までの流れ', zh: '租赁转化漏斗', ko: '임대 퍼널' },
    row: (i) => ({ id: i.id, name: i.name, source: i.source, date: i.created || '', stage: i.stage, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['id', 'name', 'source', 'date', 'stage', 'status', 'findings', 'reasons'],
    htmlColumns: ['id', 'name', 'source', 'stage', 'reasons'],
    sections: (r) => [
      { title: { en: 'By source', de: 'Nach Quelle', fr: 'Par provenance', es: 'Por origen', pt: 'Por origem', it: 'Per fonte', ja: '反響元別', zh: '按来源', ko: '유입경로별' }, rows: r.sources.map((x) => ({ ...x, leads: x.count })), columns: ['source', 'leads', 'on_time_pct', 'response_days', 'tours', 'applications', 'leases', 'conversion_pct', 'spend', 'cost_per_lease'] },
      { title: { en: 'Lost reasons', de: 'Verlustgründe', fr: 'Motifs de perte', es: 'Motivos de pérdida', pt: 'Motivos de perda', it: 'Motivi di perdita', ja: '失注理由', zh: '流失原因', ko: '이탈 사유' }, rows: r.lost_reasons.map((x) => ({ reasons: x.reason, count: x.count })), columns: ['reasons', 'count'] },
    ],
    limits: ['files', 'advice', { en: 'Fairlease Leasing Funnel reads the dates and statuses in your lead export. It does not see calls, texts or emails that were not logged, and it never screens, approves or denies an applicant.', de: 'Fairlease Leasing Funnel liest Daten und Status aus Ihrem Interessenten-Export. Nicht erfasste Anrufe, SMS oder E-Mails sieht es nicht, und es prüft, bewilligt oder lehnt keine Bewerber ab.', fr: 'Fairlease Leasing Funnel lit les dates et statuts de votre export de contacts. Il ne voit pas les appels, SMS ou e-mails non enregistrés et ne sélectionne, n’accepte ni ne refuse aucun candidat.', es: 'Fairlease Leasing Funnel lee las fechas y estados de su exportación de interesados. No ve llamadas, mensajes ni correos que no se registraron y nunca evalúa, aprueba ni rechaza a un solicitante.', pt: 'O Fairlease Leasing Funnel lê as datas e status da exportação de leads. Não vê ligações, mensagens ou e-mails não registrados e nunca avalia, aprova ou recusa um candidato.', it: 'Fairlease Leasing Funnel legge date e stati dell’esportazione dei contatti. Non vede chiamate, messaggi o email non registrati e non valuta, approva o respinge alcun candidato.', ja: 'Fairlease Leasing Funnel は反響データの日付と状態を読みます。記録されていない電話・SMS・メールは見えず、入居審査や承認・否認は行いません。', zh: 'Fairlease Leasing Funnel 读取线索导出中的日期和状态。看不到未记录的电话、短信或邮件，也从不筛查、批准或拒绝申请人。', ko: 'Fairlease Leasing Funnel는 리드 내보내기의 날짜와 상태를 읽습니다. 기록되지 않은 전화·문자·이메일은 보지 못하며 신청자를 심사·승인·거절하지 않습니다.' }] },
});
const pair = draftPair({
  prefix: 'leads', noun: 'followup', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your leasing team',
  description: 'Write drafts/followup-<lead>.md: a short follow-up to one prospect suited to their stage (new, toured, applied or approved). Marked DRAFT; open items are [TO CONFIRM]. Sending goes through leads_request_send (one click).',
  required: ['leads', 'id'],
  args: { ...props, id: { type: 'string', description: 'Lead ID or name from leads_check' }, to: { type: 'string', description: 'Prospect email or phone' }, property: { type: 'string', maxLength: 200, description: 'Property name as you want it written' }, offer: { type: 'string', maxLength: 500, description: 'Any approved offer wording' }, from: { type: 'string', description: 'Your name, phone and office hours' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const q = String(a.id).trim().toLowerCase();
    const it = r.items.find((i) => i.id.toLowerCase() === q) || r.items.find((i) => q.length >= 3 && i.name.toLowerCase().includes(q));
    if (!it) throw new Error(`lead "${a.id}" has nothing to follow up`);
    if (!it.findings.some((f) => ['no_response', 'follow_up_due', 'approved_not_leased', 'stale_open'].includes(f.code))) throw new Error(`${it.id} has nothing to follow up`);
    return { id: it.id, to: a.to || undefined, text: followUpText(it, a) };
  },
});
const mem = memoryTools('leads', MEMORY_KINDS);
const refused = refusedTools([
  { name: 'decide_application', category: 'binding_send', description: 'Fairlease Leasing Funnel never approves or denies an applicant; that is a person\'s decision under your screening criteria.' },
  { name: 'run_screening', category: 'binding_send', description: 'Fairlease Leasing Funnel never orders credit, criminal or eviction screening.' },
  { name: 'text_prospect', category: 'binding_send', description: 'Fairlease Leasing Funnel never texts or calls prospects.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairlease Leasing Funnel never sends follow-ups; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-leasing-funnel', version: pkg.version,
  description: 'Checks the leasing funnel from guest cards and lead exports: leads not answered or answered late, follow-ups due, approved applicants with no lease, stale and duplicate leads, and conversion and cost per lease by source. Drafts follow-ups. Screening decisions and contact are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { lead_policy: LEAD_POLICY_SCHEMA },
  sources: { leads: { label: 'Guest cards and leads', args: ['leads'], fields: LEAD_FIELDS, profiles: LEAD_PROFILES } },
  memory: { prefix: 'leads', kinds: MEMORY_KINDS },
  prompts: [{
    name: 'funnel_review', title: 'Review the leasing funnel',
    description: 'Walks the host model through a weekly leasing funnel review with Fairlease Leasing Funnel.',
    arguments: [{ name: 'leads', description: 'Lead export', required: true }, { name: 'policy', description: 'Targets JSON', required: false }],
    text: `You are helping a leasing manager review the funnel with fairlease-leasing-funnel. Leads: {{leads}}. Targets: {{policy}}.

Rules: Fairlease Leasing Funnel never screens, approves or denies applicants, never contacts prospects and never sends; decide_application, run_screening, text_prospect and email_send are blocked. Talk about response times and steps, never about who a prospect is.

1. Call leads_check. Lead with leads that have no response, then approved applicants with no lease, then follow-ups due. Then the source table: lead-to-lease rate and cost per lease.
2. Call leads_explain for leads the person asks about. If a source has two names, offer leads_learn with a source_alias; a person accepts it with leads_accept_learning.
3. Call leads_write_report and share the paths.
4. Offer leads_draft_followup per lead; only when the person asks, call leads_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...mem.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...mem.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease Leasing Funnel allowlist.' }] },
});
