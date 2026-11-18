import { defineManifest, MODEL_PIN, LEASES_SCHEMA, CAM_SCHEMA, GL_FIELDS, GL_PROFILES, LEDGER_FIELDS, LEDGER_PROFILES, standardTools, draftPair, refusedTools, memoryTools } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { reconcile, statementText } from './cam.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/cam';
const props = {
  leases: { type: 'string', description: 'Leases JSON under --root (leases schema): each lease\'s share, base year, cap, excluded pools, admin fee and gross-up terms' },
  cam: { type: 'string', description: 'CAM setup JSON (cam schema): year, rentable area, occupancy, gross-up target, pools with their GL accounts, excluded accounts, prior-year capped amounts' },
  gl: { type: 'string', description: 'General ledger detail for the year (CSV, Excel or JSON): account, amount or debit/credit. AppFolio, Yardi and Buildium GL exports are recognised' },
  billed: { type: 'string', description: 'Optional tenant ledger or charge register with the CAM estimates billed during the year; without it the lease monthly_estimate is used' },
};
const MEMORY_KINDS = {
  account_pool: {
    description: 'A GL account that belongs in one of the CAM pools (for example "6450 parking lot sweeping goes in Common area (fixed)").',
    effect: 'adds the account to that pool in every later reconciliation; never changes shares, caps, stops or the gross-up target',
    schema: { type: 'object', additionalProperties: false, required: ['account', 'pool'], properties: { account: { type: 'string', pattern: '^[A-Za-z0-9.]{1,20}$' }, pool: { type: 'string', minLength: 1, maxLength: 80 } } },
  },
};
const run = (a, ctx) => {
  const leases = ctx.readJson(a.leases, 'leases');
  const cam = ctx.readJson(a.cam, 'cam');
  const gl = ctx.records(a.gl, 'gl');
  const billedRows = a.billed ? ctx.records(a.billed, 'billed') : null;
  const learned = ctx.memoryFacts('account_pool').map((f) => f.value);
  return reconcile({ leases, cam, gl, billedRows, learned });
};
const std = standardTools({
  prefix: 'cam', outDir: OUT, props, required: ['leases', 'cam', 'gl'], run,
  check: { title: 'Reconcile CAM for the year', description: 'Sum the GL into the CAM pools, gross up variable pools, then for every lease in force work out its pro-rata share, base-year stop, controllable-expense cap, admin fee, estimates billed and the balance due or credit. Lists GL accounts in no pool instead of guessing.' },
  explain: { arg: 'tenant', argDoc: 'Lease id, tenant name or unit from cam_check', key: (i) => [i.lease_id, i.tenant, i.unit], title: 'Explain one tenant\'s reconciliation', description: 'Show one lease\'s pool-by-pool share, stop, cap, admin fee, estimates and balance, with every finding.',
    describe: (i) => `${i.tenant} (${i.unit}, ${i.lease_id}): share ${i.share_pct}%, total ${i.total_due}, billed ${i.billed}, ${i.direction} ${Math.abs(i.balance ?? 0)}. ${i.findings.map((f) => f.detail).join(' ')}` },
  report: { base: 'cam', description: 'Write the CAM reconciliation worklist',
    title: { en: 'CAM reconciliation', de: 'Nebenkostenabrechnung (Gewerbe)', fr: 'Régularisation des charges', es: 'Conciliación de gastos comunes', pt: 'Conciliação de despesas comuns', it: 'Conguaglio oneri accessori', ja: '共益費精算', zh: '公共区域费用对账', ko: '공용관리비 정산' },
    row: (i) => ({ lease_id: i.lease_id, tenant: i.tenant, unit: i.unit, share_pct: i.share_pct, total_due: i.total_due, billed: i.billed, balance: i.balance, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['lease_id', 'tenant', 'unit', 'share_pct', 'total_due', 'billed', 'balance', 'status', 'findings', 'reasons'],
    htmlColumns: ['tenant', 'unit', 'share_pct', 'total_due', 'billed', 'balance', 'status', 'reasons'],
    sections: (r) => [
      { title: { en: 'Pools', de: 'Kostenpools', fr: 'Postes de charges', es: 'Partidas', pt: 'Grupos de despesas', it: 'Voci di spesa', ja: '費用プール', zh: '费用池', ko: '비용 풀' }, rows: r.pools, columns: ['name', 'total', 'grossed_up', 'variable', 'controllable'] },
      { title: { en: 'GL accounts in no pool (left out)', de: 'Konten ohne Pool (nicht umgelegt)', fr: 'Comptes hors postes (exclus)', es: 'Cuentas sin partida (excluidas)', pt: 'Contas sem grupo (excluídas)', it: 'Conti senza voce (esclusi)', ja: 'プール未割当の科目（除外）', zh: '未归入费用池的科目（未计入）', ko: '풀에 없는 계정(제외)' }, rows: r.unmapped, columns: ['account', 'name', 'amount'] },
      { title: { en: 'Excluded by the CAM file', de: 'Laut Datei ausgeschlossen', fr: 'Exclus par le fichier', es: 'Excluidas por el archivo', pt: 'Excluídas pelo arquivo', it: 'Escluse dal file', ja: '設定で除外', zh: '按设置排除', ko: '설정에서 제외' }, rows: r.excluded, columns: ['account', 'name', 'amount'] },
    ],
    limits: ['files', 'lease', 'advice', { en: 'Shares, stops and caps follow the terms in your leases file. Where a lease is silent or a prior-year amount is missing, the tenant is marked review, not ok.', de: 'Anteile, Sockelbeträge und Kappungen folgen Ihrer Mietvertragsdatei. Fehlt eine Angabe, wird der Mieter zur Prüfung markiert.', fr: 'Quotes-parts, franchises et plafonds suivent votre fichier de baux. Si une donnée manque, le locataire est marqué à vérifier.', es: 'Participaciones, topes y franquicias siguen su archivo de contratos. Si falta un dato, el inquilino queda para revisar.', pt: 'Participações, franquias e tetos seguem seu arquivo de contratos. Se faltar um dado, o inquilino fica para revisar.', it: 'Quote, franchigie e tetti seguono il vostro file dei contratti. Se manca un dato, l’inquilino è da verificare.', ja: '按分・基準額・上限はリースファイルの条件に従います。データが欠ける場合は要確認とします。', zh: '分摊比例、基数和上限按您的租约文件计算；缺少数据时标为待核查。', ko: '분담률·기준액·상한은 임대차 파일 조건을 따르며, 자료가 없으면 검토로 표시합니다.' }] },
});
const pair = draftPair({
  prefix: 'cam', noun: 'statement', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/statement-<lease>.md: one tenant\'s reconciliation statement (pools, share, stop, cap, admin fee, estimates, balance due or credit). Marked DRAFT; open items are [TO CONFIRM]. Sending goes through cam_request_send (one click).',
  required: ['leases', 'cam', 'gl', 'tenant'],
  args: { ...props, tenant: { type: 'string', description: 'Lease id from cam_check' }, to: { type: 'string', description: 'Tenant notice address or billing contact' }, from: { type: 'string', description: 'Landlord or manager name for the signature' }, due_note: { type: 'string', description: 'Payment or credit timing sentence under the lease' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const it = r.items.find((i) => i.lease_id === String(a.tenant).trim());
    if (!it) throw new Error(`lease ${a.tenant} not found; leases in the reconciliation: ${r.items.map((i) => i.lease_id).join(', ')}`);
    if (it.total_due === null) throw new Error(`${it.lease_id} needs review before a statement: ${it.findings.map((f) => f.detail).join(' ')}`);
    return { id: it.lease_id, to: a.to, amount: it.balance, text: statementText(it, r, a) };
  },
});
const mem = memoryTools('cam', MEMORY_KINDS);
const refused = refusedTools([
  { name: 'post_tenant_charge', category: 'move_money', description: 'Fairlease CAM Reconciliation never posts charges or credits to tenant ledgers; your accounting team posts the approved reconciliation.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairlease CAM Reconciliation never sends email; a person sends the approved statement.' },
  { name: 'pm_system_update', category: 'production_deploy', description: 'Fairlease CAM Reconciliation never changes recurring charges in the property management system.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-cam-reconciliation', version: pkg.version,
  description: 'Reconciles common area maintenance (CAM) and operating expenses for commercial leases: GL to expense pools, pro-rata shares, gross-ups, base-year stops, controllable-expense caps, admin fees and estimates billed, with tenant statement drafts. Posting and sending are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { leases: LEASES_SCHEMA, cam: CAM_SCHEMA },
  sources: {
    gl: { label: 'General ledger detail', args: ['gl'], fields: GL_FIELDS, profiles: GL_PROFILES },
    billed: { label: 'Tenant ledger or CAM charges billed', args: ['billed'], fields: LEDGER_FIELDS, profiles: LEDGER_PROFILES },
  },
  memory: { prefix: 'cam', kinds: MEMORY_KINDS },
  prompts: [{
    name: 'cam_reconciliation', title: 'Reconcile CAM for the year',
    description: 'Walks the host model through a year-end CAM reconciliation with Fairlease CAM Reconciliation: pools, shares, caps, statements, and sending that waits for a person.',
    arguments: [{ name: 'leases', description: 'Leases JSON under --root', required: true }, { name: 'cam', description: 'CAM setup JSON', required: true }, { name: 'gl', description: 'GL detail for the year', required: true }],
    text: `You are helping a commercial property manager or accountant reconcile CAM with fairlease-cam-reconciliation. Leases: {{leases}}. CAM setup: {{cam}}. GL: {{gl}}.

Rules: Fairlease CAM Reconciliation never posts charges and never sends. post_tenant_charge, email_send and pm_system_update are blocked; do not call them. Results follow the person's own leases and CAM files; they are not a legal reading of any lease.

0. Call cam_recall to see GL accounts Fairlease CAM Reconciliation has learned to put in pools. If the person tells you where an account belongs, call cam_learn (kind account_pool) and say it waits for a named person to accept.
1. Call cam_check. If a file fails its schema, show the error. Report pools total, recovery %, tenants owing and credits, and every GL account in no pool.
2. For each tenant marked review, call cam_explain and say exactly what is missing (a prior-year capped amount, a share, estimates).
3. Call cam_write_report and share the CSV and HTML paths.
4. Offer cam_draft_statement per tenant. Show the draft path and any [TO CONFIRM] markers.
5. Only when the person asks, call cam_request_send for a reviewed draft. It returns needs_approval: show the approval id and wait.`,
  }],
  tools: [...std.tools, ...pair.tools, ...mem.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...mem.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease CAM Reconciliation allowlist.' }] },
});
