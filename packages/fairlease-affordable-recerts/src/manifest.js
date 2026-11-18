import { defineManifest, MODEL_PIN, RECERT_FIELDS, RENT_ROLL_FIELDS, RENT_ROLL_PROFILES, standardTools, draftPair, refusedTools, isoDate, toIcs, writeWorklist } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { checkRecerts, reminderText, RECERT_POLICY_SCHEMA } from './recerts.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/recerts';
const props = {
  tracker: { type: 'string', description: 'Recertification tracker (CSV, Excel or JSON): household, unit, program, move-in, last certification, next due, status, and up to three notice dates. Yardi and OneSite style headers such as Effective Date, Next AR Due or 120-Day Notice, and local headers such as 世帯, 前回申告日 or 次回申告期限, are read' },
  policy: { type: 'string', description: 'Schedule JSON (recert_policy schema): per program frequency_months, notice_days (up to three, for example 120, 90, 60), start_days_before; due_soon_days; market_units to skip; documents for the reminder' },
  rent_roll: { type: 'string', description: 'Optional rent roll (CSV, Excel or JSON) to find occupied units missing from the tracker and tracked households whose unit is vacant' },
  as_of: { type: 'string', description: 'Date to judge against, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => {
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  return checkRecerts({ households: ctx.records(a.tracker, 'tracker'), rentRoll: a.rent_roll ? ctx.records(a.rent_roll, 'rent_roll') : null, policy: ctx.readJson(a.policy, 'recert_policy'), asOf });
};
const std = standardTools({
  prefix: 'recerts', outDir: OUT, props, required: ['tracker', 'policy'], run,
  check: { title: 'Check recertification dates', description: 'Every household against the schedule in your policy file: next due date (from the tracker, or last certification plus the program frequency), overdue and soon-due households, the notices your policy sends before each due date and whether they are recorded and on time, due dates that disagree with the last certification, and programs not in your policy. With a rent roll, also occupied units missing from the tracker and tracked households whose unit is vacant.' },
  explain: { arg: 'household', argDoc: 'Household or unit from recerts_check', key: (i) => [i.household, i.unit, i.id], title: 'Explain one household', description: 'Show one household\'s program, last certification, next due date, notices and each finding.',
    describe: (i) => `${i.household}${i.unit ? ` (unit ${i.unit})` : ''}, ${i.program || 'no program'}: ${i.status.replace(/_/g, ' ')}. Last certification ${i.last_cert || 'unknown'}, next due ${i.next_due || 'unknown'}${i.days_left !== null ? ` (${i.days_left} days)` : ''}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'recerts', description: 'Write the recertification worklist',
    title: { en: 'Recertifications', de: 'Wiederholungsprüfungen', fr: 'Recertifications', es: 'Recertificaciones', pt: 'Recertificações', it: 'Ricertificazioni', ja: '収入再認定', zh: '资格复核', ko: '재인증' },
    row: (i) => ({ unit: i.unit || '', tenant: i.household, program: i.program || '', due: i.next_due || '', days: i.days_left ?? '', status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['unit', 'tenant', 'program', 'due', 'days', 'status', 'findings', 'reasons'],
    htmlColumns: ['unit', 'tenant', 'program', 'due', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Fairlease Affordable Recerts tracks dates and notices against the schedule in your policy file. It does not read income or assets, decide eligibility, work out rent, or know your program\'s rules; your compliance staff and agency guidance do.', de: 'Fairlease Affordable Recerts verfolgt Termine und Mitteilungen nach dem Zeitplan Ihrer Richtliniendatei. Es liest keine Einkommen oder Vermögen, entscheidet nicht über Berechtigung, berechnet keine Miete und kennt die Programmregeln nicht.', fr: 'Fairlease Affordable Recerts suit les dates et les avis selon le calendrier de votre fichier de règles. Il ne lit ni revenus ni patrimoine, ne décide pas de l’éligibilité, ne calcule pas le loyer et ne connaît pas les règles du programme.', es: 'Fairlease Affordable Recerts sigue fechas y avisos según el calendario de su archivo de reglas. No lee ingresos ni bienes, no decide la elegibilidad, no calcula la renta ni conoce las reglas del programa.', pt: 'O Fairlease Affordable Recerts acompanha datas e avisos conforme o calendário do seu arquivo de regras. Não lê renda nem bens, não decide elegibilidade, não calcula aluguel e não conhece as regras do programa.', it: 'Fairlease Affordable Recerts segue date e avvisi secondo il calendario del file di regole. Non legge redditi o patrimoni, non decide l’idoneità, non calcola il canone e non conosce le regole del programma.', ja: 'Fairlease Affordable Recerts はポリシーファイルの日程に沿って期限と通知を追跡します。収入や資産の確認、資格の判断、家賃の算定はせず、制度の規則も知りません。', zh: 'Fairlease Affordable Recerts 按规则文件中的日程跟踪日期和通知。不读取收入或资产，不判断资格，不计算租金，也不了解项目规则。', ko: 'Fairlease Affordable Recerts는 정책 파일의 일정에 따라 날짜와 통지를 추적합니다. 소득이나 자산을 확인하거나 자격을 판단하거나 임대료를 계산하지 않으며 프로그램 규정을 알지 못합니다.' }] },
});
const calTool = {
  name: 'recerts_calendar', kind: 'report', title: 'Write the recertification calendar',
  description: `Write recerts-calendar.ics (notice dates and due dates from as_of on) and recerts-calendar.csv/.html into out_dir (default ${OUT}). Opens in any calendar app.`,
  inputSchema: { type: 'object', additionalProperties: false, required: ['tracker', 'policy'], properties: { ...props, out_dir: { type: 'string', description: `Folder for the files (default ${OUT})` } } },
  handler: async (a, ctx) => {
    const r = run(a, ctx); const dir = ctx.outDir(a.out_dir || OUT);
    const ics = ctx.writeFile(dir, 'recerts-calendar.ics', toIcs(r.events, { calName: 'Fairlease recertifications' }));
    const w = writeWorklist(ctx, a.out_dir || OUT, 'recerts-calendar', { title: { en: 'Recertification calendar', de: 'Termine der Wiederholungsprüfungen', fr: 'Calendrier des recertifications', es: 'Calendario de recertificaciones', pt: 'Calendário de recertificações', it: 'Calendario delle ricertificazioni', ja: '再認定カレンダー', zh: '复核日历', ko: '재인증 일정' }, rows: r.events.map((e) => ({ date: e.date, description: e.summary, reasons: e.description })), columns: ['date', 'description', 'reasons'], limits: ['files', 'advice'] });
    return { summary: `${r.events.length} date(s) from ${r.as_of}: ${r.events.filter((e) => /notice/i.test(e.summary)).length} notice(s) and ${r.events.filter((e) => /due/i.test(e.summary) && !/notice/i.test(e.summary)).length} due date(s).`, events: r.events, files: [ics, ...w.files].map((f) => f.slice(ctx.root.length + 1).split('\\').join('/')) };
  },
};
const pair = draftPair({
  prefix: 'recerts', noun: 'reminder', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/reminder-<household>.md: a recertification reminder to one household with the due date and the documents listed in your policy. Marked DRAFT; open items are [TO CONFIRM]. Sending goes through recerts_request_send (one click).',
  required: ['tracker', 'policy', 'household'],
  args: { ...props, household: { type: 'string', description: 'Household or unit from recerts_check' }, to: { type: 'string', description: 'Household mailing address or email' }, appointment: { type: 'string', maxLength: 200, description: 'Appointment date, time and place, if booked' }, language_line: { type: 'string', maxLength: 500, description: 'Language assistance and accessibility sentence for your office' }, from: { type: 'string', description: 'Office name, phone and hours' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const q = String(a.household).trim().toLowerCase();
    const it = r.items.find((i) => i.kind === 'household' && [i.household, i.unit].some((v) => v && String(v).toLowerCase() === q)) || r.items.find((i) => i.kind === 'household' && q.length >= 3 && i.household.toLowerCase().includes(q));
    if (!it) throw new Error(`no household "${a.household}" in the tracker`);
    if (!it.next_due) throw new Error(`${it.household} has no due date to remind them of; fix the tracker first`);
    if (it.status === 'ok') throw new Error(`${it.household} is not due until ${it.next_due}; nothing to remind yet`);
    return { id: it.household, to: a.to || undefined, text: reminderText(it, a, ctx.readJson(a.policy, 'recert_policy')) };
  },
});
const refused = refusedTools([
  { name: 'certify_household', category: 'binding_send', description: 'Fairlease Affordable Recerts never certifies a household or decides eligibility; trained staff do.' },
  { name: 'submit_to_agency', category: 'binding_send', description: 'Fairlease Affordable Recerts never submits certifications or vouchers to an agency or housing authority system.' },
  { name: 'change_rent', category: 'move_money', description: 'Fairlease Affordable Recerts never changes a household\'s rent or posts charges.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairlease Affordable Recerts never sends reminders; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-affordable-recerts', version: pkg.version,
  description: 'Tracks affordable housing recertification dates against the schedule in your policy file: due dates, the notices your policy sends before each one, overdue and soon-due households, and households missing from the tracker or the rent roll. Writes a calendar and drafts reminders. Eligibility, rent and agency submissions are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { recert_policy: RECERT_POLICY_SCHEMA },
  sources: {
    tracker: { label: 'Recertification tracker', args: ['tracker'], fields: RECERT_FIELDS, profiles: [] },
    rent_roll: { label: 'Rent roll', args: ['rent_roll'], fields: RENT_ROLL_FIELDS, profiles: RENT_ROLL_PROFILES },
  },
  prompts: [{
    name: 'recert_review', title: 'Review recertification dates',
    description: 'Walks the host model through a monthly recertification review with Fairlease Affordable Recerts.',
    arguments: [{ name: 'tracker', description: 'Recertification tracker', required: true }, { name: 'policy', description: 'Schedule JSON', required: true }, { name: 'rent_roll', description: 'Rent roll', required: false }],
    text: `You are helping an affordable housing manager track recertifications with fairlease-affordable-recerts. Tracker: {{tracker}}. Policy: {{policy}}. Rent roll: {{rent_roll}}.

Rules: Fairlease Affordable Recerts never certifies, decides eligibility, changes rent, submits to an agency or sends anything; certify_household, submit_to_agency, change_rent and email_send are blocked. Do not tell the person what a program requires; repeat the schedule in their policy file.

1. Call recerts_check. Lead with overdue households, then notices not recorded, then those due soon.
2. Call recerts_explain for households the person asks about.
3. Call recerts_write_report and recerts_calendar, and share the paths.
4. Offer recerts_draft_reminder per household; only when the person asks, call recerts_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, calTool, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, { tool: 'recerts_calendar', decision: 'allow' }, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease Affordable Recerts allowlist.' }] },
});
