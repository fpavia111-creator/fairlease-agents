// Affordable housing recertification dates against the schedule in the user's policy file. Pure functions.
// Malachite tracks dates and notices only: it never reads income, decides eligibility or works out rent.
import { str, isoDate, addDays, addMonths, daysBetween, foldText, sameUnit, sameParty } from 'keystone-core';

export const RECERT_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['programs'],
  properties: {
    programs: { type: 'object', minProperties: 1, maxProperties: 40, additionalProperties: { type: 'object', additionalProperties: false, required: ['frequency_months'], properties: {
      frequency_months: { type: 'integer', minimum: 1, maximum: 60 },
      notice_days: { type: 'array', maxItems: 3, items: { type: 'integer', minimum: 1, maximum: 365 } },
      start_days_before: { type: 'integer', minimum: 0, maximum: 365 },
      words: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 2, maxLength: 60 } },
    } } },
    default_program: { type: 'string', maxLength: 100 },
    due_soon_days: { type: 'integer', minimum: 0, maximum: 180 },
    market_units: { type: 'array', maxItems: 20000, items: { type: 'string', minLength: 1, maxLength: 40 } },
    documents: { type: 'array', maxItems: 40, items: { type: 'string', minLength: 2, maxLength: 200 } },
  },
});

const fold = (s) => foldText(str(s)).toLowerCase();
const IN_PROGRESS = /(progress|pending|scheduled|started|in bearbeitung|en cours|en curso|em andamento|in corso|受付中|進行中|处理中|진행)/;
const STOP = new Set(['household', 'family', 'fictional', 'ficticio', 'ficticia', 'fiktiv', 'the', 'and', 'des', 'del', 'de', 'la', 'le', 'haushalt', 'hogar', 'famille', '世帯', '架空']);
const tokens = (s) => fold(s).split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2 && !STOP.has(t));
const samePerson = (a, b) => sameParty(a, b) || tokens(a).some((t) => t.length >= 3 && tokens(b).includes(t));

export function programFor(name, policy) {
  const n = fold(name);
  for (const [k, p] of Object.entries(policy.programs)) {
    const words = [k, ...(p.words || [])].map(fold);
    if (n && words.some((w) => n === w || n.includes(w))) return k;
  }
  return policy.default_program && policy.programs[policy.default_program] ? policy.default_program : null;
}

export function checkRecerts({ households, rentRoll = null, policy, asOf }) {
  const soon = policy.due_soon_days ?? 30; const items = []; const events = [];
  for (const h of households) {
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const program = programFor(h.program, policy); const cfg = program ? policy.programs[program] : null;
    const moveIn = isoDate(h.move_in); const last = isoDate(h.last_cert); const given = isoDate(h.next_due);
    const st = fold(h.status);
    let due = null;
    if (!cfg) add('program_unknown', `Program "${str(h.program) || 'blank'}" is not in your policy file, so no schedule applies.`);
    if (cfg) {
      const computed = last ? addMonths(last, cfg.frequency_months) : null;
      if (given && computed && Math.abs(daysBetween(computed, given)) > 31) add('due_date_differs', `Tracker says next due ${given}; last certification ${last} plus ${cfg.frequency_months} month(s) is ${computed}.`);
      due = given || computed;
      if (!last) {
        add('last_cert_missing', 'No last certification date in the tracker.');
        if (!due && moveIn) { due = addMonths(moveIn, cfg.frequency_months); while (due < addDays(asOf, -(cfg.start_days_before ?? 120))) due = addMonths(due, cfg.frequency_months); add('due_from_move_in', `Next due taken as the move-in anniversary ${due}; confirm it.`); }
      }
      if (!due) add('due_unknown', 'No next due date, last certification or move-in date, so the due date cannot be placed.');
    }
    const left = due ? daysBetween(asOf, due) : null;
    if (due && cfg) {
      const notices = [...(cfg.notice_days || [])].sort((a, b) => b - a);
      const recorded = [isoDate(h.notice_sent), isoDate(h.second_notice), isoDate(h.third_notice)].map((d) => (d && (!last || d > last) ? d : null));
      notices.forEach((n, k) => {
        const by = addDays(due, -n); const got = recorded[k];
        if (by >= asOf) { events.push({ date: by, summary: `${n}-day recertification notice: ${str(h.household)}${h.unit ? ` (${str(h.unit)})` : ''}`, description: `${program} recertification due ${due}.` }); return; }
        if (!got) add('notice_missing', `The ${n}-day notice (by ${by}) is not recorded.`);
        else if (got && got > by) add('notice_late', `The ${n}-day notice went ${got}, ${daysBetween(by, got)} day(s) after ${by}.`);
      });
      if (due >= asOf) events.push({ date: due, summary: `Recertification due: ${str(h.household)}${h.unit ? ` (${str(h.unit)})` : ''}`, description: `${program}. Last certification ${last || 'unknown'}.` });
      if (left < 0) add('overdue', `Recertification was due ${due}, ${-left} day(s) ago${IN_PROGRESS.test(st) ? ` (tracker says "${str(h.status)}")` : ''}.`);
      else if (left <= soon) add('due_soon', `Due ${due}: ${left} day(s) left.`);
      else if (cfg.start_days_before !== undefined && left <= cfg.start_days_before) add('in_window', `Due ${due}; your policy starts ${cfg.start_days_before} days before.`);
    }
    if (rentRoll) {
      const rr = rentRoll.filter((r) => sameUnit(r.unit, h.unit));
      const occ = rr.filter((r) => str(r.tenant) && !/vacant|leer|vacante|vago|sfitto|空室|空置|공실/.test(fold(r.tenant)) && !/vacant/.test(fold(r.status)));
      if (h.unit && !occ.length) add('not_in_rent_roll', `Unit ${str(h.unit)} is vacant or missing in the rent roll; the household may have moved out.`);
      else if (h.unit && occ.length && !occ.some((r) => samePerson(r.tenant, h.household))) add('name_differs', `Rent roll shows ${occ.map((r) => str(r.tenant)).join(', ')} in unit ${str(h.unit)}.`);
    }
    const codes = findings.map((f) => f.code);
    const status = codes.includes('overdue') ? 'overdue' : codes.some((c) => ['notice_missing', 'not_in_rent_roll', 'due_unknown', 'program_unknown', 'due_date_differs', 'last_cert_missing'].includes(c)) ? 'review' : codes.includes('due_soon') ? 'due_soon' : codes.includes('in_window') ? 'in_window' : 'ok';
    items.push({ kind: 'household', id: str(h.household), household: str(h.household), unit: str(h.unit) || null, property: str(h.property) || null, program: program || str(h.program) || null, last_cert: last, next_due: due, days_left: left, tracker_status: str(h.status) || null, status, findings });
  }
  if (rentRoll) {
    const skip = new Set((policy.market_units || []).map(fold));
    for (const r of rentRoll) {
      if (!str(r.unit) || skip.has(fold(r.unit))) continue;
      if (!str(r.tenant) || /vacant|leer|vacante|vago|sfitto|空室|空置|공실/.test(fold(r.tenant)) || /vacant/.test(fold(r.status))) continue;
      if (households.some((h) => sameUnit(h.unit, r.unit))) continue;
      items.push({ kind: 'untracked', id: `${str(r.unit)} ${str(r.tenant)}`, household: str(r.tenant), unit: str(r.unit), property: str(r.property) || null, program: null, last_cert: null, next_due: null, days_left: null, tracker_status: null, status: 'review', findings: [{ code: 'not_tracked', detail: `Occupied in the rent roll but not in the recertification tracker. If it is a market-rate unit, add it to market_units.` }] });
    }
  }
  const order = { overdue: 0, review: 1, due_soon: 2, in_window: 3, ok: 4 };
  items.sort((a, b) => order[a.status] - order[b.status] || (a.days_left ?? 9999) - (b.days_left ?? 9999) || String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true }));
  events.sort((a, b) => a.date.localeCompare(b.date));
  const n = (s) => items.filter((i) => i.status === s).length;
  const missing = items.reduce((s, i) => s + i.findings.filter((f) => f.code === 'notice_missing').length, 0);
  const summary = `${items.filter((i) => i.kind === 'household').length} household(s) tracked: ${n('overdue')} overdue, ${n('review')} to review, ${n('due_soon')} due within ${soon} days, ${n('in_window')} in the window your policy starts work. ${missing} notice(s) not recorded.${rentRoll ? ` ${items.filter((i) => i.kind === 'untracked').length} occupied unit(s) not in the tracker.` : ''} ${events.length} upcoming date(s).`;
  return { summary, as_of: asOf, items, events };
}

/** Recertification reminder to a household. */
export function reminderText(it, a = {}, policy = {}) {
  const docs = (policy.documents && policy.documents.length ? policy.documents : null);
  return `**To:** ${a.to || `[TO CONFIRM: ${it.household} mailing address or email]`}

# Your ${it.program || ''} recertification is due${it.next_due ? ` ${it.next_due}` : ''}

Household: ${it.household}
Unit: ${it.unit || '[TO CONFIRM]'}

Your household's recertification is due ${it.next_due || '[TO CONFIRM: date]'}. Please ${a.appointment ? `come to your appointment on ${a.appointment}` : 'contact the office to book an appointment [TO CONFIRM: how to book]'} and bring:

${docs ? docs.map((d) => `- ${d}`).join('\n') : '- [TO CONFIRM: list of documents your program asks for]'}

If anything about your household has changed, please tell us at the appointment. ${a.language_line || '[TO CONFIRM: language assistance and accessibility contact]'}

${a.from || '[TO CONFIRM: office name, phone and hours]'}
`;
}
