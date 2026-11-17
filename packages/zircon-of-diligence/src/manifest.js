import { defineManifest, MODEL_PIN, RENT_ROLL_FIELDS, RENT_ROLL_PROFILES, GL_FIELDS, standardTools, draftPair, refusedTools, isoDate } from 'keystone-core';
import { readFileSync } from 'node:fs';
import { checkDiligence, questionsText, DILIGENCE_POLICY_SCHEMA } from './diligence.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/zircon';
const T12_FIELDS = Object.freeze({ property: GL_FIELDS.property, account: GL_FIELDS.account, account_name: GL_FIELDS.account_name, period: GL_FIELDS.period, date: GL_FIELDS.date, amount: GL_FIELDS.amount, debit: GL_FIELDS.debit, credit: GL_FIELDS.credit });
const props = {
  rent_roll: { type: 'string', description: 'Seller\'s rent roll (CSV, Excel or JSON). AppFolio and Yardi rent roll layouts are recognised' },
  t12: { type: 'string', description: 'Trailing-twelve-month income statement: one row per account with a column per month ("Dec 2025", "2026-01", "Jan-26"…), or one row per account and month (account, period, amount). Local headers such as Cuenta, Periodo or Importe are read' },
  policy: { type: 'string', description: 'Optional diligence policy JSON (diligence_policy schema): income_prefixes and expense_prefixes of account numbers, rent_accounts, outlier_pct, outlier_min, gap_tolerance_pct, above_market_pct' },
  as_of: { type: 'string', description: 'Rent roll date, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => {
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  return checkDiligence({ rentRoll: ctx.records(a.rent_roll, 'rent_roll'), t12Rows: ctx.records(a.t12, 't12'), policy: a.policy ? ctx.readJson(a.policy, 'diligence_policy') : {}, asOf });
};
const std = standardTools({
  prefix: 'zircon', outDir: OUT, props, required: ['rent_roll', 't12'], run,
  check: { title: 'Reconcile rent roll and T-12', description: 'Rent roll scheduled rent against the T-12\'s rent income for the last month and annualized; occupancy (physical and economic); expired leases still listed, occupied units with no rent, rent above the roll\'s own market; T-12 months missing, stale or blank, and months out of line with the account\'s typical month; NOI. Every item is a question for the seller, not a conclusion.' },
  explain: { arg: 'subject', argDoc: 'Unit, account number, "T-12" or "reconciliation" from zircon_check', key: (i) => [i.subject, i.title], title: 'Explain one item', description: 'Show one unit, account or the reconciliation with its findings.',
    describe: (i) => `${i.title} (${i.area.replace('_', ' ')}): ${i.status}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'zircon-diligence', description: 'Write the diligence worklist',
    title: { en: 'Rent roll and T-12 review', de: 'Mieterliste und T-12 im Abgleich', fr: 'État locatif et compte de résultat sur 12 mois', es: 'Rent roll frente a los últimos 12 meses', pt: 'Rent roll versus últimos 12 meses', it: 'Rent roll a confronto con gli ultimi 12 mesi', ja: 'レントロールと直近12か月損益の照合', zh: '租金清单与近12个月损益核对', ko: '렌트롤과 최근 12개월 손익 대조' },
    intro: (r) => r.summary,
    row: (i) => ({ category: i.area, item: i.title, amount: i.amount ?? '', status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['category', 'item', 'amount', 'status', 'findings', 'reasons'],
    htmlColumns: ['category', 'item', 'amount', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Zircon compares the seller\'s files with each other. It does not verify them against bank statements, leases or tax returns; every item is a question to ask, not a finding of fact.', de: 'Zircon vergleicht die Dateien des Verkäufers miteinander. Es prüft sie nicht gegen Kontoauszüge, Mietverträge oder Steuererklärungen; jeder Punkt ist eine Frage, keine Tatsachenfeststellung.', fr: 'Zircon compare les fichiers du vendeur entre eux. Il ne les vérifie pas avec les relevés bancaires, baux ou déclarations fiscales ; chaque point est une question, pas un constat.', es: 'Zircon compara los archivos del vendedor entre sí. No los verifica con extractos bancarios, contratos ni declaraciones; cada punto es una pregunta, no un hecho comprobado.', pt: 'O Zircon compara os arquivos do vendedor entre si. Não os confere com extratos, contratos ou declarações fiscais; cada item é uma pergunta, não uma constatação.', it: 'Zircon confronta tra loro i file del venditore. Non li verifica con estratti conto, contratti o dichiarazioni; ogni punto è una domanda, non un fatto accertato.', ja: 'Zircon は売主のファイル同士を照合します。銀行明細・契約書・税務申告とは照合しません。各項目は確認すべき質問であり、事実の認定ではありません。', zh: 'Zircon 只将卖方文件相互核对，不与银行流水、租约或纳税申报核实；每一项都是待问的问题，而非事实认定。', ko: 'Zircon은 매도인의 파일끼리 대조합니다. 은행 거래내역, 계약서, 세무신고와 대조하지 않으며 각 항목은 사실 확인이 아닌 질문입니다.' }] },
});
const pair = draftPair({
  prefix: 'zircon', noun: 'questions', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/questions-<property>.md: due diligence questions for the seller, one per open item, with the figures from both files. Marked DRAFT. Sending goes through zircon_request_send (one click).',
  required: ['rent_roll', 't12'],
  args: { ...props, property: { type: 'string', maxLength: 200, description: 'Property name for the title' }, to: { type: 'string', description: 'Seller or broker' }, reply_by: { type: 'string', description: 'Reply-by date' }, from: { type: 'string', description: 'Your name and contact' } },
  build: (a, ctx) => {
    const r = run(a, ctx); if (!r.items.some((i) => i.status === 'issue')) throw new Error('no open questions from the files');
    return { id: a.property || 'property', to: a.to || undefined, text: questionsText(r, a) };
  },
});
const refused = refusedTools([
  { name: 'submit_offer', category: 'binding_send', description: 'Zircon never submits or changes an offer, letter of intent or loan terms.' },
  { name: 'data_room_upload', category: 'binding_send', description: 'Zircon never uploads to or shares from a data room.' },
  { name: 'email_send', category: 'binding_send', description: 'Zircon never sends questions; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'zircon-of-diligence', version: pkg.version,
  description: 'Reconciles a seller\'s rent roll with the trailing-twelve-month income statement before you buy or lend: scheduled rent against rent collected, occupancy, expired leases still listed, months missing or out of line, and NOI, then drafts questions for the seller. Offers and data rooms are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { diligence_policy: DILIGENCE_POLICY_SCHEMA },
  sources: {
    rent_roll: { label: 'Rent roll', args: ['rent_roll'], fields: RENT_ROLL_FIELDS, profiles: RENT_ROLL_PROFILES },
    t12: { label: 'T-12 income statement', args: ['t12'], fields: T12_FIELDS, profiles: [] },
  },
  prompts: [{
    name: 'diligence_review', title: 'Reconcile rent roll and T-12',
    description: 'Walks the host model through a rent roll and T-12 reconciliation with Zircon.',
    arguments: [{ name: 'rent_roll', description: 'Seller\'s rent roll', required: true }, { name: 't12', description: 'T-12 income statement', required: true }],
    text: `You are helping a buyer or lender review a seller's rent roll and T-12 with zircon-of-diligence. Rent roll: {{rent_roll}}. T-12: {{t12}}.

Rules: Zircon never submits offers or touches a data room; submit_offer, data_room_upload and email_send are blocked. Every item is a question for the seller, not a finding of fact.

1. Call zircon_check. Lead with the gap between the roll and last month's rent income, then expired leases and occupancy, then T-12 months out of line.
2. Call zircon_explain for items the person asks about.
3. Call zircon_write_report and share the paths.
4. Offer zircon_draft_questions; only when the person asks, call zircon_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Zircon allowlist.' }] },
});
