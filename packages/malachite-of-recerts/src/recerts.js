// Affordable housing recertification dates against the schedule in the user's policy file. Pure functions.
// Malachite tracks dates and notices only: it never reads income, decides eligibility or works out rent.
import { str, isoDate, addDays, addMonths, daysBetween, foldText, unitKey, sameParty } from 'keystone-core';

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
const MOVED_OUT = /(moved out|move out|move-out|vacated|terminated|past resident|former|ausgezogen|déménagé|parti|desocupado|mudou|trasferito|退去|已搬出|迁出|퇴거)/;
const IN_PROGRESS = /(progress|pending|scheduled|started|in bearbeitung|en cours|en curso|em andamento|in corso|受付中|進行中|处理中|진행)/;
const STOP = new Set(['household', 'family', 'fictional', 'ficticio', 'ficticia', 'fiktiv', 'the', 'and', 'des', 'del', 'de', 'la', 'le', 'haushalt', 'hogar', 'famille', '世帯', '架空']);
const TOK = new Map();
const tokens = (s) => { const k = str(s); let t = TOK.get(k); if (!t) { t = fold(k).split(/[^\p{L}\p{N}]+/u).filter((x) => x.length >= 2 && !STOP.has(x)); if (TOK.size > 50000) TOK.clear(); TOK.set(k, t); } return t; };
const samePerson = (a, b) => sameParty(a, b) || tokens(a).some((t) => t.length >= 3 && tokens(b).includes(t));

export function programFor(name, policy) {
  const n = fold(name); const padded = ` ${n.replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
  for (const [k, p] of Object.entries(policy.programs)) {
    const words = [k, ...(p.words || [])].map(fold);
    // Whole words only: "Homeless preference" is not HOME and "Chapter" is not HAP. Scripts without spaces match anywhere.
    if (n && words.some((w) => n === w || padded.includes(` ${w.replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `) || (/[^\x00-\x7f]/.test(w) && n.includes(w)))) return k;
  }
  return policy.default_program && policy.programs[policy.default_program] ? policy.default_program : null;
}

export function checkRecerts({ households, rentRoll = null, policy, asOf }) {
  const soon = policy.due_soon_days ?? 30; const items = []; const events = [];
  // Rent roll rows and tracked households by unit, built once (large files).
  const isOcc = (r) => str(r.tenant) && !/vacant|leer|vacante|vago|sfitto|空室|空置|공실/.test(fold(r.tenant)) && !/vacant/.test(fold(r.status));
  const pk = (r) => fold(r.property).replace(/[^\p{L}\p{N}]+/gu, '');
  // With a property on both sides the unit is looked up inside its property; otherwise by unit alone.
  const both = (rentRoll || []).some((r) => pk(r)) && households.some((h) => pk(h));
  const uk = (r) => { const u = unitKey(r.unit); return u && both ? `${pk(r)}|${u}` : u; };
  const rrByUnit = new Map(); for (const r of rentRoll || []) { const k = uk(r); if (!k || !isOcc(r)) continue; if (!rrByUnit.has(k)) rrByUnit.set(k, []); rrByUnit.get(k).push(r); }
  const trackedUnits = new Set(households.map((h) => uk(h)).filter(Boolean));
  const unitCount = new Map(); for (const h of households) { const k = uk(h); if (k && !MOVED_OUT.test(fold(h.status))) unitCount.set(k, (unitCount.get(k) || 0) + 1); }
  for (const h of households) {
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const program = programFor(h.program, policy); const cfg = program ? policy.programs[program] : null;
    const moveIn = isoDate(h.move_in); const last = isoDate(h.last_cert); const given = isoDate(h.next_due);
    const st = fold(h.status);
    if (MOVED_OUT.test(st)) { items.push({ kind: 'household', id: str(h.household), household: str(h.household), unit: str(h.unit) || null, property: str(h.property) || null, program: program || str(h.program) || null, last_cert: last, next_due: null, days_left: null, tracker_status: str(h.status) || null, status: 'closed', findings: [] }); continue; }
    if (unitCount.get(uk(h)) > 1) add('unit_listed_twice', `Unit ${str(h.unit)} is in the tracker ${unitCount.get(uk(h))} times; one row may be a household that moved out.`);
    if (last && last > asOf) add('last_cert_in_future', `Last certification ${last} is after ${asOf}; check the date.`);
    let due = null;
    if (!cfg) add('program_unknown', `Program "${str(h.program) || 'blank'}" is not in your policy file, so no schedule applies.`);
    if (cfg) {
      const computed = last ? addMonths(last, cfg.frequency_months) : null;
      const stale = !!(given && last && given <= last);
      if (stale) add('due_date_differs', `Tracker says next due ${given}, which is not after the last certification ${last}, so ${computed} is used (${last} plus ${cfg.frequency_months} month(s)). Update the tracker.`);
      else if (given && computed && Math.abs(daysBetween(computed, given)) > 31) add('due_date_differs', `Tracker says next due ${given}; last certification ${last} plus ${cfg.frequency_months} month(s) is ${computed}.`);
      due = stale ? computed : given || computed;
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
        if (by >= asOf) { if (!got) events.push({ date: by, summary: `${n}-day recertification notice: ${str(h.household)}${h.unit ? ` (${str(h.unit)})` : ''}`, description: `${program} recertification due ${due}.` }); return; }
        if (!got) add('notice_missing', `The ${n}-day notice (by ${by}) is not recorded.`);
        else if (got && got > by) add('notice_late', `The ${n}-day notice went ${got}, ${daysBetween(by, got)} day(s) after ${by}.`);
      });
      if (due >= asOf) events.push({ date: due, summary: `Recertification due: ${str(h.household)}${h.unit ? ` (${str(h.unit)})` : ''}`, description: `${program}. Last certification ${last || 'unknown'}.` });
      if (left < 0) add('overdue', `Recertification was due ${due}, ${-left} day(s) ago${IN_PROGRESS.test(st) ? ` (tracker says "${str(h.status)}")` : ''}.`);
      else if (left <= soon) add('due_soon', `Due ${due}: ${left} day(s) left.`);
      else if (cfg.start_days_before !== undefined && left <= cfg.start_days_before) add('in_window', `Due ${due}; your policy starts ${cfg.start_days_before} days before.`);
    }
    if (rentRoll) {
      const occ = rrByUnit.get(uk(h)) || [];
      if (h.unit && !occ.length) add('not_in_rent_roll', `Unit ${str(h.unit)} is vacant or missing in the rent roll; the household may have moved out.`);
      else if (h.unit && occ.length && !occ.some((r) => samePerson(r.tenant, h.household))) { const names = [...new Set(occ.map((r) => str(r.tenant)))]; add('name_differs', `Rent roll shows ${names.slice(0, 5).join(', ')}${names.length > 5 ? ` and ${names.length - 5} more` : ''} in unit ${str(h.unit)}.`); }
    }
    const codes = findings.map((f) => f.code);
    const status = codes.includes('overdue') ? 'overdue' : codes.some((c) => ['notice_missing', 'not_in_rent_roll', 'due_unknown', 'program_unknown', 'due_date_differs', 'last_cert_missing', 'unit_listed_twice', 'last_cert_in_future'].includes(c)) ? 'review' : codes.includes('due_soon') ? 'due_soon' : codes.includes('in_window') ? 'in_window' : 'ok';
    items.push({ kind: 'household', id: str(h.household), household: str(h.household), unit: str(h.unit) || null, property: str(h.property) || null, program: program || str(h.program) || null, last_cert: last, next_due: due, days_left: left, tracker_status: str(h.status) || null, status, findings });
  }
  if (rentRoll) {
    const skip = new Set((policy.market_units || []).flatMap((u) => [fold(u), unitKey(u)]));
    for (const r of rentRoll) {
      if (!str(r.unit) || skip.has(fold(r.unit)) || skip.has(unitKey(r.unit))) continue;
      if (!str(r.tenant) || /vacant|leer|vacante|vago|sfitto|空室|空置|공실/.test(fold(r.tenant)) || /vacant/.test(fold(r.status))) continue;
      if (trackedUnits.has(uk(r))) continue;
      items.push({ kind: 'untracked', id: `${str(r.unit)} ${str(r.tenant)}`, household: str(r.tenant), unit: str(r.unit), property: str(r.property) || null, program: null, last_cert: null, next_due: null, days_left: null, tracker_status: null, status: 'review', findings: [{ code: 'not_tracked', detail: `Occupied in the rent roll but not in the recertification tracker. If it is a market-rate unit, add it to market_units.` }] });
    }
  }
  const order = { overdue: 0, review: 1, due_soon: 2, in_window: 3, ok: 4, closed: 5 };
  items.sort((a, b) => order[a.status] - order[b.status] || (a.days_left ?? 9999) - (b.days_left ?? 9999) || String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true }));
  events.sort((a, b) => a.date.localeCompare(b.date));
  const n = (s) => items.filter((i) => i.status === s).length;
  const missing = items.reduce((s, i) => s + i.findings.filter((f) => f.code === 'notice_missing').length, 0);
  const summary = `${items.filter((i) => i.kind === 'household' && i.status !== 'closed').length} household(s) tracked: ${n('overdue')} overdue, ${n('review')} to review, ${n('due_soon')} due within ${soon} days, ${n('in_window')} in the window your policy starts work. ${missing} notice(s) not recorded.${rentRoll ? ` ${items.filter((i) => i.kind === 'untracked').length} occupied unit(s) not in the tracker.` : ''}${n('closed') ? ` ${n('closed')} moved out and left alone.` : ''} ${events.length} upcoming date(s).`;
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
