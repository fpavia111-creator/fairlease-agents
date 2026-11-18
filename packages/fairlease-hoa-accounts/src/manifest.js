import { defineManifest, MODEL_PIN, ASSOCIATION_FIELDS, VIOLATION_FIELDS, standardTools, draftPair, refusedTools, isoDate } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { checkAssociation, noticeText, ASSOCIATION_POLICY_SCHEMA } from './associations.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/hoa';
const props = {
  policy: { type: 'string', description: 'Association policy JSON (association_policy schema): assessment amount, per-unit amounts, frequency, due day, grace days, late fee, collection steps and violation steps (notice, cure, hearing before fine, stale, repeat)' },
  ledger: { type: 'string', description: 'Owner ledger (CSV, Excel or JSON): account, owner, unit, date, description, charge, payment, balance. Local headers such as Propietario, Vivienda, Concepto, Cargo or Abono are read' },
  violations: { type: 'string', description: 'Violations log (CSV, Excel or JSON): case, unit, owner, type, opened, first and second notice, hearing, closed, status, fine' },
  as_of: { type: 'string', description: 'Date to judge against, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => {
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  if (!a.ledger && !a.violations) throw new Error('give ledger, violations, or both');
  return checkAssociation({ policy: ctx.readJson(a.policy, 'association_policy'), ledger: a.ledger ? ctx.records(a.ledger, 'ledger') : null, violations: a.violations ? ctx.records(a.violations, 'violations') : null, asOf });
};
const std = standardTools({
  prefix: 'hoa', outDir: OUT, props, required: ['policy'], run,
  check: { title: 'Check association accounts and violations', description: 'Owner accounts against your assessment policy: missing or wrong assessments, late fees missed, not due or of the wrong amount, ledger balance that does not add up, amount and days past due with the step your collection policy names. Violations against your steps: first notice late, cure period over with no follow-up, fine without a hearing, open too long, repeats.' },
  explain: { arg: 'id', argDoc: 'Account, unit, owner or violation case from hoa_check', key: (i) => [i.id, i.account, i.unit, i.owner, i.violation_id], title: 'Explain one account or case', description: 'Show one owner account period by period, or one violation step by step, with each finding.',
    describe: (i) => (i.kind === 'account'
      ? `${i.account || i.unit} ${i.owner} (unit ${i.unit}): ${i.status}. Balance ${i.balance}, past due ${i.past_due}${i.oldest_unpaid ? ` since ${i.oldest_unpaid}` : ''}. ${i.periods.map((p) => `${p.period} ${p.charged}/${p.expected}${p.paid_on ? ` paid ${p.paid_on}` : ' unpaid'}`).join('; ')}. ${i.findings.map((f) => f.detail).join(' ')}`
      : `${i.violation_id} unit ${i.unit} ${i.owner}: ${i.type}. ${i.status}; opened ${i.opened || '?'}, first notice ${i.notice_1 || 'none'}, second ${i.notice_2 || 'none'}, hearing ${i.hearing || 'none'}${i.amount ? `, fine ${i.amount}` : ''}. ${i.findings.map((f) => f.detail).join(' ')}`).trim() },
  report: { base: 'hoa-association', description: 'Write the association worklist',
    title: { en: 'Association accounts and violations', de: 'Hausgeldkonten und Verstöße', fr: 'Comptes des copropriétaires et infractions', es: 'Cuentas de propietarios e infracciones', pt: 'Contas dos condôminos e infrações', it: 'Conti dei condomini e violazioni', ja: '区分所有者の口座と規約違反', zh: '业主账户与违规事项', ko: '소유자 계정과 위반 사항' },
    row: (i) => ({ id: i.id, unit: i.unit || '', owner: i.owner, amount: i.amount, days: i.days ?? '', status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['id', 'unit', 'owner', 'amount', 'days', 'status', 'findings', 'reasons'],
    htmlColumns: ['id', 'unit', 'owner', 'amount', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Fairlease HOA Accounts compares your ledger and violations log with the policy file you give it and repeats the steps that policy names. It does not read governing documents, decide whether a fee, fine or collection step is allowed, or take any step.', de: 'Fairlease HOA Accounts vergleicht Ihr Kontenblatt und Ihre Verstoßliste mit der angegebenen Richtliniendatei und nennt die dort festgelegten Schritte. Es liest keine Gemeinschaftsordnung, entscheidet nicht, ob eine Gebühr, Strafe oder Mahnstufe zulässig ist, und unternimmt keinen Schritt.', fr: 'Fairlease HOA Accounts compare votre grand livre et votre registre d’infractions au fichier de règles fourni et reprend les étapes qu’il prévoit. Il ne lit pas le règlement de copropriété, ne décide pas si une pénalité, une amende ou une relance est permise et n’engage aucune démarche.', es: 'Fairlease HOA Accounts compara su libro de cuentas y su registro de infracciones con el archivo de normas que usted indica y repite los pasos que ese archivo nombra. No lee los estatutos, no decide si un recargo, una multa o un paso de cobro está permitido ni toma ningún paso.', pt: 'O Fairlease HOA Accounts compara seu razão e o registro de infrações com o arquivo de regras informado e repete as etapas que ele define. Não lê a convenção, não decide se uma multa, taxa ou etapa de cobrança é permitida e não toma nenhuma medida.', it: 'Fairlease HOA Accounts confronta il libro contabile e il registro delle violazioni con il file di regole indicato e riporta i passaggi che prevede. Non legge il regolamento, non decide se una penale, una multa o un sollecito sono ammessi e non intraprende alcuna azione.', ja: 'Fairlease HOA Accounts は台帳と違反記録を指定のポリシーファイルと照合し、そこに定められた手順を示します。規約の読み取り、遅延金・罰金・督促手順の可否判断、手続きの実行は行いません。', zh: 'Fairlease HOA Accounts 将您的账簿和违规记录与所给的规则文件对照，并列出文件规定的步骤。不读取管理规约，不判断滞纳金、罚款或催收步骤是否允许，也不采取任何行动。', ko: 'Fairlease HOA Accounts은 원장과 위반 기록을 지정한 정책 파일과 대조하고 그 파일이 정한 단계를 알려 줍니다. 관리규약을 읽거나 연체료·벌금·추심 단계의 허용 여부를 판단하거나 어떤 조치도 취하지 않습니다.' }] },
});
const pair = draftPair({
  prefix: 'hoa', noun: 'notice', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/notice-<id>.md: a statement-of-account reminder for a past-due owner account, or a violation notice for an open case. Marked DRAFT; open items are [TO CONFIRM]. Sending goes through hoa_request_send (one click).',
  required: ['policy', 'id'],
  args: { ...props, id: { type: 'string', description: 'Account, unit, owner or violation case from hoa_check' }, to: { type: 'string', description: 'Owner email or mailing address' }, pay_by: { type: 'string', description: 'Pay-by date for a reminder' }, pay_to: { type: 'string', maxLength: 300, description: 'Payment address or portal' }, plan_offer: { type: 'string', maxLength: 1000, description: 'Payment plan wording, if the board approved one' }, rule: { type: 'string', maxLength: 300, description: 'Rule or section of the governing documents for a violation notice' }, cure_by: { type: 'string', description: 'Cure-by date for a violation notice' }, hearing: { type: 'string', maxLength: 200, description: 'Hearing date, time and place, if one is offered' }, from: { type: 'string', description: 'Your name and contact' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const q = String(a.id).trim().toLowerCase();
    const it = r.items.find((i) => [i.id, i.account, i.violation_id].some((v) => v && String(v).toLowerCase() === q)) || r.items.find((i) => i.kind === 'account' && [i.unit, i.owner].some((v) => v && String(v).toLowerCase() === q)) || r.items.find((i) => q.length >= 3 && String(i.owner).toLowerCase().includes(q));
    if (!it) throw new Error(`no account or case "${a.id}"`);
    if (it.kind === 'account' && it.status !== 'delinquent') throw new Error(`${it.id} ${it.owner} has nothing past due; no reminder to draft`);
    if (it.kind === 'violation' && it.status === 'closed') throw new Error(`${it.id} is closed; no notice to draft`);
    const policy = ctx.readJson(a.policy, 'association_policy');
    return { id: it.id, to: a.to || undefined, text: noticeText(it, { ...a, as_of: r.as_of, association: policy.association }) };
  },
});
const refused = refusedTools([
  { name: 'record_lien', category: 'binding_send', description: 'Fairlease HOA Accounts never records a lien or starts collection; the board decides and a person acts.' },
  { name: 'post_fine', category: 'move_money', description: 'Fairlease HOA Accounts never posts a fine or fee to an owner account.' },
  { name: 'post_owner_charge', category: 'move_money', description: 'Fairlease HOA Accounts never posts or reverses charges on an owner ledger.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairlease HOA Accounts never sends notices; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-hoa-accounts', version: pkg.version,
  description: 'Checks HOA and condo association owner accounts against your assessment and collection policy, and violations against your notice, cure and hearing steps; drafts owner reminders and violation notices. Fines, liens and charges are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { association_policy: ASSOCIATION_POLICY_SCHEMA },
  sources: {
    ledger: { label: 'Owner ledger', args: ['ledger'], fields: ASSOCIATION_FIELDS, profiles: [] },
    violations: { label: 'Violations log', args: ['violations'], fields: VIOLATION_FIELDS, profiles: [] },
  },
  prompts: [{
    name: 'association_review', title: 'Review association accounts and violations',
    description: 'Walks the host model through a monthly association review with Fairlease HOA Accounts.',
    arguments: [{ name: 'policy', description: 'Association policy JSON', required: true }, { name: 'ledger', description: 'Owner ledger', required: false }, { name: 'violations', description: 'Violations log', required: false }],
    text: `You are helping a community association manager with fairlease-hoa-accounts. Policy: {{policy}}. Ledger: {{ledger}}. Violations: {{violations}}.

Rules: Fairlease HOA Accounts never posts fines or charges, records liens or sends notices; record_lien, post_fine, post_owner_charge and email_send are blocked. Collection steps and fines are the board's decision: repeat the step the policy names, do not recommend legal action.

1. Call hoa_check. Lead with delinquent accounts (oldest first) and violations that need a step, then assessment and late fee issues.
2. Call hoa_explain for accounts or cases the person asks about.
3. Call hoa_write_report and share the paths.
4. Offer hoa_draft_notice per account or case; only when the person asks, call hoa_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease HOA Accounts allowlist.' }] },
});
