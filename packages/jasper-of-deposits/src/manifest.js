import { defineManifest, MODEL_PIN, LEASES_SCHEMA, LEDGER_FIELDS, LEDGER_PROFILES, MOVE_OUT_FIELDS, standardTools, draftPair, refusedTools, isoDate } from 'keystone-core';
import { readFileSync } from 'node:fs';
import { checkDeposits, statementText, MOVE_OUTS_SCHEMA } from './deposits.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/jasper';
const props = {
  move_outs: { type: 'string', description: 'Move-outs JSON (move_outs schema): your rules (return_days is required: the deadline you must meet, from your own law or policy; optional interest_pct, require_evidence, wear_words) and each move-out (unit, date, deposit held, forwarding address, returned_on)' },
  deductions: { type: 'string', description: 'Deduction lines (CSV, Excel or JSON): unit, item, category, amount, optional age and useful life in years (prorated), and a photo, invoice or receipt reference' },
  leases: { type: 'string', description: 'Optional leases JSON for deposits and move-in dates' },
  ledger: { type: 'string', description: 'Optional final tenant ledger; the unpaid balance at move-out is deducted when your rules say so' },
  as_of: { type: 'string', description: 'Date deadlines are judged against, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => {
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  return checkDeposits({ config: ctx.readJson(a.move_outs, 'move_outs'), deductions: ctx.records(a.deductions, 'deductions'), leases: a.leases ? ctx.readJson(a.leases, 'leases') : null, ledger: a.ledger ? ctx.records(a.ledger, 'ledger') : null, asOf });
};
const std = standardTools({
  prefix: 'jasper', outDir: OUT, props, required: ['move_outs', 'deductions'], run,
  check: { title: 'Check move-out deposits', description: 'For every move-out: deposit held, deductions (prorated by useful life where age is given), unpaid balance, refund or amount owed, and the deadline from your rules. Flags possible normal wear and tear, deductions without a photo or invoice, missing forwarding addresses, deadlines passed or near, and refunds that differ from the check.' },
  explain: { arg: 'unit', argDoc: 'Unit or former tenant from jasper_check', key: (i) => [i.unit, i.tenant, i.lease_id], title: 'Explain one move-out', description: 'Show one move-out\'s deposit, each deduction with its notes, the refund and the deadline.',
    describe: (i) => `${i.tenant} (unit ${i.unit}), moved out ${i.move_out}: deposit ${i.deposit}, deductions ${i.deducted}${i.unpaid ? `, unpaid ${i.unpaid}` : ''}, ${i.refund === null ? 'refund unknown' : i.refund >= 0 ? `refund ${i.refund}` : `owes ${-i.refund}`}${i.deadline ? `, deadline ${i.deadline}` : ''}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'jasper-deposits', description: 'Write the move-out deposit worklist',
    title: { en: 'Move-out deposits', de: 'Kautionsabrechnungen', fr: 'Restitution des dépôts de garantie', es: 'Devolución de fianzas', pt: 'Devolução de cauções', it: 'Restituzione dei depositi cauzionali', ja: '敷金精算', zh: '押金结算', ko: '보증금 정산' },
    row: (i) => ({ unit: i.unit, tenant: i.tenant, move_out: i.move_out, deadline: i.deadline, deposit: i.deposit, deducted: i.deducted, unpaid: i.unpaid, refund: i.refund, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['unit', 'tenant', 'move_out', 'deadline', 'deposit', 'deducted', 'unpaid', 'refund', 'status', 'findings', 'reasons'],
    htmlColumns: ['unit', 'tenant', 'deadline', 'deposit', 'deducted', 'refund', 'status', 'reasons'],
    labels: {},
    sections: (r) => [{ title: { en: 'Deduction lines that matched no move-out', de: 'Positionen ohne Auszug', fr: 'Retenues sans départ', es: 'Deducciones sin salida', pt: 'Deduções sem saída', it: 'Addebiti senza uscita', ja: '退去に一致しない控除', zh: '未匹配退租的扣款', ko: '퇴거와 맞지 않는 공제' }, rows: r.unmatched_deductions, columns: ['unit', 'tenant', 'item', 'amount'] }],
    limits: ['files', 'advice', { en: 'Deadlines, interest and what counts as wear and tear follow the rules file you give, not any law. Flags are prompts for a person, not decisions.', de: 'Fristen, Zinsen und was als Abnutzung gilt, folgen Ihrer Regeldatei, nicht einem Gesetz. Hinweise sind Anstöße für eine Person, keine Entscheidungen.', fr: 'Délais, intérêts et usure normale suivent votre fichier de règles, pas une loi. Les signalements invitent une personne à décider.', es: 'Plazos, intereses y desgaste normal siguen su archivo de reglas, no una ley. Las alertas son para que una persona decida.', pt: 'Prazos, juros e desgaste normal seguem seu arquivo de regras, não uma lei. Os alertas são para uma pessoa decidir.', it: 'Termini, interessi e normale usura seguono il vostro file di regole, non una legge. Le segnalazioni servono a una persona per decidere.', ja: '期限・利息・通常損耗の扱いは、法律ではなく指定のルールファイルに従います。指摘は担当者の判断材料です。', zh: '期限、利息和正常损耗的认定按您的规则文件，而非任何法律。提示仅供人员判断。', ko: '기한·이자·통상 마모 기준은 법이 아니라 지정한 규칙 파일을 따릅니다. 표시는 담당자의 판단 자료입니다.' }] },
});
const pair = draftPair({
  prefix: 'jasper', noun: 'statement', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/statement-<unit>.md: the itemised deposit statement for the former tenant (deductions with their support, deposit, refund or amount owed). Possible wear and tear and missing support are [TO CONFIRM]. Sending goes through jasper_request_send (one click); the refund itself is paid by a person.',
  required: ['move_outs', 'deductions', 'unit'],
  args: { ...props, unit: { type: 'string', description: 'Unit from jasper_check' }, to: { type: 'string', description: 'Forwarding address or email (defaults to the one in the move-outs file)' }, from: { type: 'string', description: 'Manager name and contact for the signature' }, payment_note: { type: 'string', description: 'How and when the refund is paid, or how to pay a balance' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const it = r.items.find((i) => String(i.unit) === String(a.unit).trim());
    if (!it) throw new Error(`no move-out for unit ${a.unit}; units: ${r.items.map((i) => i.unit).join(', ')}`);
    if (it.refund === null) throw new Error(`unit ${it.unit} needs review first: ${it.findings.map((f) => f.detail).join(' ')}`);
    return { id: it.unit, to: a.to || it.forwarding_address || undefined, amount: it.refund, text: statementText(it, a) };
  },
});
const refused = refusedTools([
  { name: 'issue_refund', category: 'move_money', description: 'Jasper never pays a deposit refund; a person pays it after approving the statement.' },
  { name: 'post_tenant_charge', category: 'move_money', description: 'Jasper never posts deductions to the ledger.' },
  { name: 'send_to_collections', category: 'binding_send', description: 'Jasper never sends a former tenant to collections.' },
  { name: 'email_send', category: 'binding_send', description: 'Jasper never sends statements; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'jasper-of-deposits', version: pkg.version,
  description: 'Checks every move-out deposit against your own rules: the return deadline, itemised deductions with photos or invoices, useful-life proration, possible normal wear and tear, unpaid balances and the refund, then drafts the itemised statement. Paying refunds and sending are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { leases: LEASES_SCHEMA, move_outs: MOVE_OUTS_SCHEMA },
  sources: {
    deductions: { label: 'Move-out deductions', args: ['deductions'], fields: MOVE_OUT_FIELDS, profiles: [] },
    ledger: { label: 'Final tenant ledger', args: ['ledger'], fields: LEDGER_FIELDS, profiles: LEDGER_PROFILES },
  },
  prompts: [{
    name: 'deposit_dispositions', title: 'Check move-out deposits',
    description: 'Walks the host model through move-out deposit statements with Jasper.',
    arguments: [{ name: 'move_outs', description: 'Move-outs JSON with your rules', required: true }, { name: 'deductions', description: 'Deduction lines', required: true }],
    text: `You are helping a residential property manager with move-out deposits using jasper-of-deposits. Move-outs: {{move_outs}}. Deductions: {{deductions}}.

Rules: Jasper never pays refunds, posts charges, sends or refers to collections; issue_refund, post_tenant_charge, send_to_collections and email_send are blocked. Deadlines and wear-and-tear rules come only from the person's rules file; do not state what the law requires.

1. Call jasper_check. Lead with any move-out past its deadline, then those due soon. Name every possible wear-and-tear deduction and every deduction without support.
2. Call jasper_explain for move-outs the person asks about.
3. Call jasper_write_report and share the paths.
4. Offer jasper_draft_statement per move-out and show the [TO CONFIRM] markers.
5. Only when the person asks, call jasper_request_send for a reviewed draft. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Jasper allowlist.' }] },
});
