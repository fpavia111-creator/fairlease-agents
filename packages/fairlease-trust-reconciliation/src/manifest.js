import { defineManifest, MODEL_PIN, BANK_FIELDS, TRUST_LEDGER_FIELDS, standardTools, refusedTools } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { reconcileTrust, TRUST_POLICY_SCHEMA } from './trust.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/trust';
const props = {
  bank: { type: 'string', description: 'Trust bank statement (CSV, Excel or JSON): date, description, check number or reference, amount or debit and credit, running balance. Local headers such as Buchungstag, Verwendungszweck or Betrag are read' },
  book: { type: 'string', description: 'Book register of the same account (check register or cash ledger): date, check number, payee, deposit and payment (or amount)' },
  ledgers: { type: 'string', description: 'Optional owner and tenant ledger balances at the statement end: name, type (owner, tenant deposits, prepaid rent…), property, balance' },
  policy: { type: 'string', description: 'Trust policy JSON (trust_policy schema): statement_end (required), bank_ending_balance, book_opening_balance and date, book_debit_is_deposit, match_days, stale_check_days, transit_days, tolerance' },
};
const run = (a, ctx) => reconcileTrust({ bankRows: ctx.records(a.bank, 'bank'), bookRows: ctx.records(a.book, 'book'), ledgerRows: a.ledgers ? ctx.records(a.ledgers, 'ledgers') : null, policy: ctx.readJson(a.policy, 'trust_policy') });
const std = standardTools({
  prefix: 'trust', outDir: OUT, props, required: ['bank', 'book', 'policy'], run,
  check: { title: 'Reconcile the trust account', description: 'Three-way reconciliation at the statement end: bank balance adjusted for deposits in transit and outstanding checks, against the book balance, against the total of owner and tenant ledgers. Lists bank items missing from the book (fees, returned payments), stale outstanding checks, old deposits in transit, possible duplicate entries and negative ledgers.' },
  explain: { arg: 'reference', argDoc: 'Check number, reference, ledger name or "three-way" from trust_check', key: (i) => [i.reference, i.description], title: 'Explain one item', description: 'Show one reconciling item or the three-way totals.',
    describe: (i) => `${i.type.replace(/_/g, ' ')} ${i.reference || ''} ${i.date} ${i.description} ${i.amount ?? ''}: ${i.status}. ${i.findings.map((f) => f.detail).join(' ')}`.replace(/\s+/g, ' ').trim() },
  report: { base: 'trust', description: 'Write the three-way reconciliation',
    title: { en: 'Trust account three-way reconciliation', de: 'Treuhandkonto: Drei-Wege-Abstimmung', fr: 'Compte séquestre : rapprochement à trois', es: 'Cuenta fiduciaria: conciliación a tres bandas', pt: 'Conta fiduciária: conciliação tripla', it: 'Conto fiduciario: riconciliazione a tre vie', ja: '預り金口座の三者照合', zh: '托管账户三方对账', ko: '신탁계좌 3자 대사' },
    intro: (r) => r.summary,
    row: (i) => ({ category: i.type, date: i.date, reference: i.reference, description: i.description, amount: i.amount, days: i.age_days ?? '', status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['category', 'date', 'reference', 'description', 'amount', 'days', 'status', 'findings', 'reasons'],
    htmlColumns: ['category', 'date', 'reference', 'description', 'amount', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Fairlease Trust Reconciliation reconciles the files you give it. It does not connect to the bank, and the trust accounting rules that apply to you (who may sign, how often to reconcile, what to do with stale checks) come from your licensing authority.', de: 'Fairlease Trust Reconciliation stimmt die gelieferten Dateien ab. Es verbindet sich nicht mit der Bank; die für Sie geltenden Treuhandregeln (Zeichnungsbefugnis, Turnus, Umgang mit alten Schecks) legt Ihre Aufsicht fest.', fr: 'Fairlease Trust Reconciliation rapproche les fichiers fournis. Il ne se connecte pas à la banque ; les règles de compte séquestre qui vous concernent viennent de votre autorité de tutelle.', es: 'Fairlease Trust Reconciliation concilia los archivos que le da. No se conecta al banco; las reglas de cuentas fiduciarias que le aplican las fija su autoridad de licencias.', pt: 'O Fairlease Trust Reconciliation concilia os arquivos fornecidos. Não se conecta ao banco; as regras de conta fiduciária que se aplicam a você vêm do seu órgão regulador.', it: 'Fairlease Trust Reconciliation riconcilia i file forniti. Non si collega alla banca; le regole sui conti fiduciari che vi riguardano sono fissate dall’autorità competente.', ja: 'Fairlease Trust Reconciliation は渡されたファイルを照合します。銀行には接続しません。適用される預り金の規則は監督当局が定めます。', zh: 'Fairlease Trust Reconciliation 只核对您提供的文件，不连接银行；适用于您的托管账户规则由主管机构规定。', ko: 'Fairlease Trust Reconciliation은 제공된 파일을 대사합니다. 은행에 연결하지 않으며, 적용되는 신탁계좌 규정은 감독기관이 정합니다.' }] },
});
const refused = refusedTools([
  { name: 'transfer_funds', category: 'move_money', description: 'Fairlease Trust Reconciliation never moves money between trust, operating or owner accounts.' },
  { name: 'void_check', category: 'move_money', description: 'Fairlease Trust Reconciliation never voids or reissues a check; stale checks follow your unclaimed property rules.' },
  { name: 'gl_post', category: 'production_deploy', description: 'Fairlease Trust Reconciliation never posts adjusting entries to your books.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-trust-reconciliation', version: pkg.version,
  description: 'Three-way reconciliation of a trust or escrow bank account: bank statement against the book register against the owner and tenant ledgers, with outstanding checks, deposits in transit, bank items missing from the book, stale checks and negative ledgers. Moving money and posting entries are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { trust_policy: TRUST_POLICY_SCHEMA },
  sources: {
    bank: { label: 'Bank statement', args: ['bank'], fields: BANK_FIELDS, profiles: [] },
    book: { label: 'Book register', args: ['book'], fields: BANK_FIELDS, profiles: [] },
    ledgers: { label: 'Owner and tenant ledgers', args: ['ledgers'], fields: TRUST_LEDGER_FIELDS, profiles: [] },
  },
  prompts: [{
    name: 'trust_reconciliation', title: 'Monthly trust reconciliation',
    description: 'Walks the host model through a monthly three-way trust reconciliation with Fairlease Trust Reconciliation.',
    arguments: [{ name: 'bank', description: 'Bank statement', required: true }, { name: 'book', description: 'Book register', required: true }, { name: 'ledgers', description: 'Ledger balances', required: false }, { name: 'policy', description: 'Trust policy JSON', required: true }],
    text: `You are helping a property manager reconcile a trust account with fairlease-trust-reconciliation. Bank: {{bank}}. Book: {{book}}. Ledgers: {{ledgers}}. Policy: {{policy}}.

Rules: Fairlease Trust Reconciliation never moves money, voids checks or posts entries; transfer_funds, void_check and gl_post are blocked. Never call the account reconciled unless all three balances agree.

1. Call trust_check. Lead with whether bank, book and ledgers agree and by how much, then negative ledgers, then bank items missing from the book, then stale checks.
2. Call trust_explain for items the person asks about.
3. Call trust_write_report and share the paths for the reconciliation file.`,
  }],
  tools: [...std.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease Trust Reconciliation allowlist.' }] },
});
