import { defineManifest, MODEL_PIN, RENT_ROLL_FIELDS, RENT_ROLL_PROFILES, standardTools, draftPair, refusedTools, memoryTools } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { checkMigration, punchListText, MIGRATION_POLICY_SCHEMA } from './migration.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/migration';
const MEMORY_KINDS = {
  unit_alias: {
    description: 'The new system\'s name for one old unit (for example old "B-201" is new "201").',
    effect: 'pairs that old unit with that new unit when comparing rent rolls; never changes an amount, a date or a tolerance',
    schema: { type: 'object', additionalProperties: false, required: ['old', 'new'], properties: { old: { type: 'string', minLength: 1, maxLength: 60 }, new: { type: 'string', minLength: 1, maxLength: 60 } } },
  },
};
const props = {
  before: { type: 'string', description: 'Rent roll from the old system at cutover (CSV, Excel or JSON). AppFolio, Yardi (with lease charges), Buildium, Rent Manager, Entrata, OneSite and MRI layouts are recognised; local headers such as Whg.-Nr., Kaltmiete, Kaution or 部屋番号 are read' },
  after: { type: 'string', description: 'Rent roll from the new system at the same cutover date, in any of the same layouts' },
  policy: { type: 'string', description: 'Optional migration JSON (migration_policy schema): cutover date, tolerance (default 0.01), fields to compare, unit_map from old to new unit names, ignore_units' },
};
const run = (a, ctx) => {
  const learned = Object.fromEntries(ctx.memoryFacts('unit_alias').map((f) => [f.value.old, f.value.new]));
  return checkMigration({ before: ctx.records(a.before, 'before'), after: ctx.records(a.after, 'after'), policy: a.policy ? ctx.readJson(a.policy, 'migration_policy') : {}, learned });
};
const std = standardTools({
  prefix: 'migration', outDir: OUT, props, required: ['before', 'after'], run,
  check: { title: 'Compare old and new rent rolls', description: 'Pairs every old unit with a new one (unit map and learned aliases, then the same unit, then the same number when unique) and compares tenant, rent, deposit, balance, market rent, area, lease dates, move-in and occupancy. Lists units missing from or only in the new system, and the totals (units, occupied, rent, deposits, balances, market rent, area) that do not tie.' },
  explain: { arg: 'unit', argDoc: 'Old or new unit from migration_check', key: (i) => [i.unit, i.new_unit], title: 'Explain one unit', description: 'Show one unit side by side, old and new, with each difference.',
    describe: (i) => `${i.unit}${i.new_unit && i.new_unit !== i.unit ? ` → ${i.new_unit}` : ''} (${i.tenant || 'no tenant'}): ${i.status}${i.matched_by ? `, paired by ${i.matched_by}` : ''}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'migration', description: 'Write the migration worklist',
    title: { en: 'System migration check', de: 'Prüfung der Systemumstellung', fr: 'Contrôle de la migration du logiciel', es: 'Revisión de la migración de sistema', pt: 'Verificação da migração de sistema', it: 'Verifica della migrazione di sistema', ja: 'システム移行チェック', zh: '系统迁移核对', ko: '시스템 이전 점검' },
    row: (i) => ({ unit: i.unit, id: i.new_unit || '', tenant: i.tenant, status: i.status, difference: i.amount, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['unit', 'id', 'tenant', 'status', 'difference', 'findings', 'reasons'],
    htmlColumns: ['unit', 'id', 'tenant', 'status', 'reasons'],
    sections: (r) => [{ title: { en: 'Totals', de: 'Summen', fr: 'Totaux', es: 'Totales', pt: 'Totais', it: 'Totali', ja: '合計', zh: '合计', ko: '합계' }, rows: r.totals.map((t) => ({ item: t.item, expected: t.expected, actual: t.actual, difference: t.difference, status: t.ties ? 'ok' : 'issue' })), columns: ['item', 'expected', 'actual', 'difference', 'status'] }],
    limits: ['files', 'advice', { en: 'Fairlease PMS Migration compares two rent roll exports. It does not read ledgers line by line, open either system, or decide when you are ready to go live.', de: 'Fairlease PMS Migration vergleicht zwei Mieterlisten-Exporte. Es liest keine Kontenblätter zeilenweise, öffnet keines der Systeme und entscheidet nicht, wann Sie live gehen.', fr: 'Fairlease PMS Migration compare deux exports d’état locatif. Il ne lit pas les grands livres ligne à ligne, n’ouvre aucun des deux logiciels et ne décide pas du passage en production.', es: 'Fairlease PMS Migration compara dos exportaciones de rent roll. No lee los mayores línea a línea, no abre ninguno de los sistemas ni decide cuándo arrancar.', pt: 'O Fairlease PMS Migration compara duas exportações de rent roll. Não lê razões linha a linha, não abre nenhum dos sistemas e não decide quando entrar em produção.', it: 'Fairlease PMS Migration confronta due esportazioni del rent roll. Non legge i partitari riga per riga, non apre nessuno dei due sistemi e non decide quando andare in produzione.', ja: 'Fairlease PMS Migration は 2 つのレントロールのエクスポートを比較します。元帳を行ごとに読んだり、どちらかのシステムを開いたり、本番移行の時期を決めたりはしません。', zh: 'Fairlease PMS Migration 对比两份租金清单导出。不逐行读取分类账，不打开任一系统，也不决定何时上线。', ko: 'Fairlease PMS Migration은 두 렌트롤 내보내기를 비교합니다. 원장을 줄 단위로 읽거나 어느 시스템도 열지 않으며, 오픈 시점을 결정하지 않습니다.' }] },
});
const pair = draftPair({
  prefix: 'migration', noun: 'punchlist', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/punchlist-<cutover>.md: every unit that differs, is missing or was paired by number, plus totals that do not tie, for the implementation team. Marked DRAFT; open items are [TO CONFIRM]. Sending goes through migration_request_send (one click).',
  required: ['before', 'after'],
  args: { ...props, to: { type: 'string', description: 'Implementation or conversion team contact' }, by: { type: 'string', description: 'Date corrections are needed by' }, owner: { type: 'string', maxLength: 200, description: 'Who signs off go-live' }, from: { type: 'string', description: 'Your name and contact' } },
  build: (a, ctx) => {
    const r = run(a, ctx);
    if (!r.items.some((i) => i.status !== 'ok') && r.totals.every((t) => t.ties)) throw new Error('every unit matches and every total ties; there is nothing to put on a punch list');
    return { id: r.cutover || 'cutover', to: a.to || undefined, text: punchListText(r, a) };
  },
});
const mem = memoryTools('migration', MEMORY_KINDS);
const refused = refusedTools([
  { name: 'approve_go_live', category: 'go_live', description: 'Fairlease PMS Migration never signs off a cutover or switches systems; a named person does.' },
  { name: 'pm_system_update', category: 'production_deploy', description: 'Fairlease PMS Migration never changes data in either system.' },
  { name: 'delete_old_system_data', category: 'delete_personal_data', description: 'Fairlease PMS Migration never deletes or archives the old system\'s records.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairlease PMS Migration never sends the punch list; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-pms-migration', version: pkg.version,
  description: 'Checks a property management system migration by comparing the old system\'s rent roll with the new one\'s at cutover: units missing or added, tenants, rents, deposits, balances, areas and lease dates that changed, and totals that do not tie. Drafts a punch list. Go-live and data changes are a person\'s call.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { migration_policy: MIGRATION_POLICY_SCHEMA },
  sources: {
    before: { label: 'Old system rent roll', args: ['before'], fields: RENT_ROLL_FIELDS, profiles: RENT_ROLL_PROFILES },
    after: { label: 'New system rent roll', args: ['after'], fields: RENT_ROLL_FIELDS, profiles: RENT_ROLL_PROFILES },
  },
  memory: { prefix: 'migration', kinds: MEMORY_KINDS },
  prompts: [{
    name: 'cutover_check', title: 'Check a system migration at cutover',
    description: 'Walks the host model through a cutover check with Fairlease PMS Migration.',
    arguments: [{ name: 'before', description: 'Old system rent roll', required: true }, { name: 'after', description: 'New system rent roll', required: true }],
    text: `You are helping an operator check a property management system migration with fairlease-pms-migration. Old: {{before}}. New: {{after}}.

Rules: Fairlease PMS Migration never signs off go-live, changes data in either system, deletes records or sends anything; approve_go_live, pm_system_update, delete_old_system_data and email_send are blocked. Never say the migration is complete or ready; say what ties and what does not.

1. Call migration_check. Lead with units missing from the new system and totals that do not tie, then units that differ, then units paired by number.
2. Call migration_explain for units the person asks about. For a unit paired by number that the person confirms, offer migration_learn with a unit_alias; a person accepts it with migration_accept_learning.
3. Call migration_write_report and share the paths.
4. Offer migration_draft_punchlist; only when the person asks, call migration_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...mem.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...mem.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease PMS Migration allowlist.' }] },
});
