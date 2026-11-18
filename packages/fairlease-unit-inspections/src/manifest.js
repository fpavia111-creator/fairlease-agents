import { defineManifest, MODEL_PIN, INSPECTION_FIELDS, RENT_ROLL_FIELDS, RENT_ROLL_PROFILES, WORK_ORDER_FIELDS, WORK_ORDER_PROFILES, standardTools, draftPair, refusedTools, isoDate } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { checkInspections, noticeText, INSPECTION_POLICY_SCHEMA } from './inspections.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/inspections';
const props = {
  inspections: { type: 'string', description: 'Inspection results, one row per item (CSV, Excel or JSON): unit, inspection date, type (move-in, move-out, annual…), area, item, condition (word or score), notes, photo, inspector. Local headers such as Einheit, Raum, Zustand or 点検日 are read' },
  policy: { type: 'string', description: 'Inspection policy JSON (inspection_policy schema): interval_days (required), due_soon_days, followup_days, poor_at, scale_max, require_photo, skip_vacant, notice_hours' },
  rent_roll: { type: 'string', description: 'Optional rent roll, to list every unit (never-inspected units) and skip vacant ones' },
  work_orders: { type: 'string', description: 'Optional work orders, to check that poor items were followed by a work order' },
  as_of: { type: 'string', description: 'Date to judge schedules against, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => {
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  return checkInspections({ rows: ctx.records(a.inspections, 'inspections'), policy: ctx.readJson(a.policy, 'inspection_policy'), rentRoll: a.rent_roll ? ctx.records(a.rent_roll, 'rent_roll') : null, workOrders: a.work_orders ? ctx.records(a.work_orders, 'work_orders') : null, asOf });
};
const std = standardTools({
  prefix: 'inspections', outDir: OUT, props, required: ['inspections', 'policy'], run,
  check: { title: 'Check inspections', description: 'Per unit: periodic inspection overdue or due soon on your interval, never inspected (with a rent roll), move-out items worse than at move-in with no photo, move-outs with no move-in to compare, and poor items with no work order after your follow-up days (with work orders). Conditions are read as words in nine languages or as scores.' },
  explain: { arg: 'unit', argDoc: 'Unit from inspections_check', key: (i) => [i.unit], title: 'Explain one unit', description: 'Show one unit\'s inspection history, item changes from move-in to move-out and findings.',
    describe: (i) => `Unit ${i.unit}${i.tenant ? ` (${i.tenant})` : i.vacant ? ' (vacant)' : ''}: ${i.status.replace(/_/g, ' ')}. ${i.inspections} inspection(s), last ${i.last_inspection || 'none'}${i.next_due ? `, next due ${i.next_due}` : ''}. ${i.worse.map((w) => `${w.item}: ${w.before} → ${w.after}${w.photo ? ' (photo)' : ''}.`).join(' ')} ${i.findings.map((f) => f.detail).join(' ')}`.replace(/\s+/g, ' ').trim() },
  report: { base: 'inspections', description: 'Write the inspection worklist',
    title: { en: 'Unit inspections', de: 'Wohnungsbegehungen', fr: 'Inspections des logements', es: 'Inspecciones de unidades', pt: 'Vistorias das unidades', it: 'Ispezioni delle unità', ja: '住戸点検', zh: '单元检查', ko: '세대 점검' },
    row: (i) => ({ unit: i.unit, tenant: i.tenant, date: i.last_inspection || '', deadline: i.next_due || '', status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['unit', 'tenant', 'date', 'deadline', 'status', 'findings', 'reasons'],
    htmlColumns: ['unit', 'tenant', 'date', 'deadline', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Fairlease Unit Inspections compares the ratings recorded in your inspection files. It does not look at photos, and it does not decide what is damage or normal wear and tear; a person does.', de: 'Fairlease Unit Inspections vergleicht die in Ihren Begehungsdateien erfassten Bewertungen. Es sieht keine Fotos an und entscheidet nicht, was Schaden und was normale Abnutzung ist; das entscheidet ein Mensch.', fr: 'Fairlease Unit Inspections compare les notes saisies dans vos fichiers d’inspection. Il ne regarde pas les photos et ne décide pas ce qui relève d’un dégât ou de l’usure normale ; une personne décide.', es: 'Fairlease Unit Inspections compara las calificaciones registradas en sus archivos de inspección. No mira fotos ni decide qué es daño y qué es desgaste normal; lo decide una persona.', pt: 'O Fairlease Unit Inspections compara as notas registradas nos seus arquivos de vistoria. Não olha fotos nem decide o que é dano ou desgaste normal; uma pessoa decide.', it: 'Fairlease Unit Inspections confronta le valutazioni registrate nei file di ispezione. Non guarda le foto e non decide cosa sia danno o normale usura; decide una persona.', ja: 'Fairlease Unit Inspections は点検ファイルに記録された評価を比較します。写真は見ず、損傷か通常損耗かの判断もしません。判断は人が行います。', zh: 'Fairlease Unit Inspections 比较检查文件中记录的评级，不查看照片，也不判断是损坏还是正常磨损；由人来判断。', ko: 'Fairlease Unit Inspections는 점검 파일에 기록된 평가를 비교합니다. 사진을 보지 않으며 손상인지 통상 마모인지 판단하지 않습니다. 판단은 사람이 합니다.' }] },
});
const pair = draftPair({
  prefix: 'inspections', noun: 'notice', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/notice-<unit>.md: a notice of entry for a unit whose inspection is overdue or due soon. Marked DRAFT; date window and notice period are [TO CONFIRM] unless given. Sending goes through inspections_request_send (one click).',
  required: ['inspections', 'policy', 'unit'],
  args: { ...props, unit: { type: 'string', description: 'Unit from inspections_check' }, to: { type: 'string', description: 'Resident email or address' }, when: { type: 'string', maxLength: 200, description: 'Date and time window of the visit' }, reply_by: { type: 'string', description: 'Date to reply by if the time does not work' }, from: { type: 'string', description: 'Your name and contact' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const q = String(a.unit).trim().toLowerCase(); const it = r.items.find((i) => String(i.unit).toLowerCase() === q);
    if (!it) throw new Error(`no unit "${a.unit}" in the files`);
    if (it.vacant) throw new Error(`unit ${it.unit} is vacant; no notice of entry is needed`);
    if (!it.findings.some((f) => ['inspection_overdue', 'inspection_due_soon', 'never_inspected'].includes(f.code))) throw new Error(`unit ${it.unit} is not due for an inspection (next due ${it.next_due || 'unknown'})`);
    return { id: it.unit, to: a.to || undefined, text: noticeText(it, a, ctx.readJson(a.policy, 'inspection_policy')) };
  },
});
const refused = refusedTools([
  { name: 'post_tenant_charge', category: 'move_money', description: 'Fairlease Unit Inspections never charges a resident for damage; a person decides what is damage.' },
  { name: 'vendor_dispatch', category: 'binding_send', description: 'Fairlease Unit Inspections never dispatches a vendor or opens a work order in your system.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairlease Unit Inspections never sends notices; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-unit-inspections', version: pkg.version,
  description: 'Compares move-out inspections with move-in item by item, flags units overdue for their periodic inspection, poor items with no work order and changes with no photo, and drafts notices of entry. Charging residents and dispatching vendors are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { inspection_policy: INSPECTION_POLICY_SCHEMA },
  sources: {
    inspections: { label: 'Inspection results', args: ['inspections'], fields: INSPECTION_FIELDS, profiles: [] },
    rent_roll: { label: 'Rent roll', args: ['rent_roll'], fields: RENT_ROLL_FIELDS, profiles: RENT_ROLL_PROFILES },
    work_orders: { label: 'Work orders', args: ['work_orders'], fields: WORK_ORDER_FIELDS, profiles: WORK_ORDER_PROFILES },
  },
  prompts: [{
    name: 'inspection_review', title: 'Review unit inspections',
    description: 'Walks the host model through a monthly inspection review with Fairlease Unit Inspections.',
    arguments: [{ name: 'inspections', description: 'Inspection results', required: true }, { name: 'policy', description: 'Inspection policy JSON', required: true }, { name: 'rent_roll', description: 'Rent roll', required: false }, { name: 'work_orders', description: 'Work orders', required: false }],
    text: `You are helping a property manager review unit inspections with fairlease-unit-inspections. Inspections: {{inspections}}. Policy: {{policy}}. Rent roll: {{rent_roll}}. Work orders: {{work_orders}}.

Rules: Fairlease Unit Inspections never charges residents, dispatches vendors or sends notices; post_tenant_charge, vendor_dispatch and email_send are blocked. Never call a change damage; say it is worse than at move-in and that a person decides.

1. Call inspections_check. Lead with safety items rated poor with no work order, then move-outs with items worse than move-in, then overdue inspections.
2. Call inspections_explain for units the person asks about.
3. Call inspections_write_report and share the paths.
4. Offer inspections_draft_notice for units due an inspection; only when the person asks, call inspections_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease Unit Inspections allowlist.' }] },
});
