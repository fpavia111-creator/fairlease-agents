// Rental listings across sites against the rent roll. Pure functions.
// Wording is flagged for a person to review; Fairlease Listing Checks never judges whether an advertisement is lawful.
import { r2, num, str, isoDate, addDays, daysBetween, foldText, unitKey } from 'fairlease-core';

export const LISTING_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    required_channels: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 2, maxLength: 60 } },
    list_notice_days: { type: 'integer', minimum: 0, maximum: 120 },
    rent_tolerance_pct: { type: 'number', minimum: 0, maximum: 50 },
    stale_days: { type: 'integer', minimum: 0, maximum: 365 },
    review_words: { type: 'array', maxItems: 200, items: { type: 'string', minLength: 2, maxLength: 80 } },
    ignore_units: { type: 'array', maxItems: 20000, items: { type: 'string', minLength: 1, maxLength: 40 } },
  },
});

// Phrases that fair housing guidance commonly asks people to look at again. Fairlease Listing Checks only points to them.
export const DEFAULT_REVIEW_WORDS = Object.freeze(['no children', 'no kids', 'adults only', 'adult only', 'singles only', 'perfect for singles', 'ideal for a single', 'perfect for a couple', 'no section 8', 'no vouchers', 'no housing assistance', 'english only', 'english speakers', 'christian', 'mature', 'no wheelchairs', 'able-bodied', 'must be employed', 'keine kinder', 'nur für paare', 'pas d’enfants', 'pas d\'enfants', 'sans enfants', 'sin niños', 'solo adultos', 'sem crianças', 'niente bambini', '子供不可', '外国人不可', '不接受儿童', '아이 불가']);
const fold = (s) => foldText(str(s)).toLowerCase();
const INACTIVE = /(inactive|off market|off-market|leased|rented|expired|draft|removed|archived|deleted|paused|unlisted|desactiv|inactiv|vermietet|loue|alquilad|alugad|affittat|成約|掲載終了|已下架|已出租|거래완료|비활성)/;
const VACANT = /(^| )(vacant|leer|leerstand|vacante|vago|sfitto|libre)( |$)|空室|空置|공실/;
// A tenant cell is a vacancy marker only when that is all it says: "Joe Vacanti" is a resident.
const VACANT_NAME = /^(vacant|vacant unit|vacancy|leer|leerstand|vacante|vago|sfitto|libre|空室|空置|공실)$/;
const LEASED = /(^| )(rented|leased|pre ?leased|vermietet|loue|alquilado|alugado|affittato)( |$)|成約|已出租|계약완료/;
const NOT_LEASED = /(^| )(unrented|unleased|not (rented|leased))( |$)/;
const ON_NOTICE = /(^| )(notice|ntv|gekundigt|kundigung|preavis|preaviso|disdetta)( |$)|解約予告|退去予定|退租通知|퇴거 예정/;
const NOT_RENTABLE = /(^| )(model|down|admin|employee|office|offline|off line|storage|musterwohnung)( |$)/;

/** Bedrooms and bathrooms from "2/1", "2 BD / 1.5 BA", "2x1" or a plain number. */
export function bedBath(v) {
  const s = str(v); if (!s) return { beds: null, baths: null };
  if (/studio|einzimmer|estudio|monolocale|ワンルーム|开间|원룸/i.test(s)) return { beds: 0, baths: null };
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:bd|br|bed|beds)?\s*[/x×-]\s*(\d+(?:\.\d+)?)/i);
  if (m) return { beds: Number(m[1]), baths: Number(m[2]) };
  const n = s.match(/\d+(?:\.\d+)?/); return { beds: n ? Number(n[0]) : null, baths: null };
}

export function checkListings({ listings, rentRoll, policy = {}, asOf }) {
  const tol = policy.rent_tolerance_pct ?? 2; const noticeDays = policy.list_notice_days ?? 30; const stale = policy.stale_days ?? 14;
  const required = (policy.required_channels || []).map((c) => ({ name: c, f: fold(c) }));
  const raw = policy.review_words && policy.review_words.length ? policy.review_words : DEFAULT_REVIEW_WORDS;
  const words = [...new Map(raw.map((w) => [fold(w).replace(/[^\p{L}\p{N}'’ -]+/gu, ' '), w])).entries()];
  const ignore = new Set((policy.ignore_units || []).map(unitKey));
  const units = new Map();
  // The property name only tells units apart when the rent roll has the same unit number under more than one property;
  // otherwise names that differ a little between systems would stop every listing from matching.
  const propsOf = new Map(); for (const r of rentRoll) { const k = unitKey(r.unit); if (!k) continue; if (!propsOf.has(k)) propsOf.set(k, new Set()); propsOf.get(k).add(fold(r.property)); }
  const sameProp = (a, b) => a === b || (a && b && (a.includes(b) || b.includes(a)));
  const unit = (u, property) => {
    const uk = unitKey(u); const props = propsOf.get(uk); const fp = fold(property);
    const k = props && props.size > 1 ? `${uk}\u0000${[...props].find((x) => sameProp(x, fp)) ?? fp}` : uk;
    if (!units.has(k)) units.set(k, { key: k, unit: str(u), property: str(property), rr: [], ls: [] }); return units.get(k);
  };
  for (const r of rentRoll) if (str(r.unit) && !ignore.has(unitKey(r.unit))) unit(r.unit, r.property).rr.push(r);
  for (const l of listings) if (str(l.unit) && !ignore.has(unitKey(l.unit))) unit(l.unit, l.property).ls.push(l);
  const items = [];
  for (const u of units.values()) {
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const rr = u.rr.find((r) => str(r.tenant) || str(r.status)) || u.rr[0] || null;
    const moveOut = rr ? isoDate(rr.move_out) : null;
    const st = rr ? fold(rr.status) : '';
    const vacant = rr && (!str(rr.tenant) || VACANT_NAME.test(fold(rr.tenant)) || VACANT.test(st));
    const leased = LEASED.test(st) && !NOT_LEASED.test(st);
    const notRentable = !!rr && NOT_RENTABLE.test(st);
    const open = !rr ? 'unknown' : vacant ? 'vacant' : moveOut && moveOut >= asOf && moveOut <= addDays(asOf, noticeDays) ? 'notice' : moveOut && moveOut < asOf ? 'vacant' : ON_NOTICE.test(st) && !moveOut ? 'notice' : 'occupied';
    // Vacant or on notice with the next lease already signed ("Vacant Rented", "Notice Leased"): nothing to advertise.
    const occupancy = notRentable ? 'not_rentable' : (open === 'vacant' || open === 'notice') && leased ? 'leased' : open;
    const active = u.ls.filter((l) => !INACTIVE.test(fold(l.status)));
    if ((occupancy === 'occupied' || occupancy === 'not_rentable') && !active.length) continue;
    const market = rr ? num(rr.market_rent) : null; const bb = rr ? bedBath(rr.bedrooms) : { beds: null, baths: null }; const sqft = rr ? num(rr.sqft) : null;
    const chans = active.map((l) => str(l.channel) || 'unnamed site');
    if (occupancy === 'vacant' || occupancy === 'notice') {
      if (!active.length) add('not_listed', `${occupancy === 'vacant' ? 'Vacant' : `On notice (move-out ${moveOut || 'date not given'})`} and not listed on any site.`);
      else { const miss = required.filter((c) => !chans.some((x) => fold(x).includes(c.f))).map((c) => c.name); if (miss.length) add('missing_on_channel', `Not listed on ${miss.join(', ')}.`); }
    }
    if (occupancy === 'leased' && active.length) add('listed_but_leased', `Already leased (rent roll status "${str(rr.status)}") but still listed on ${chans.join(', ')}.`);
    if (occupancy === 'not_rentable' && active.length) add('listed_not_rentable', `Rent roll status is "${str(rr.status)}", but the unit is listed on ${chans.join(', ')}.`);
    if (occupancy === 'occupied' && active.length) add('listed_while_occupied', `Occupied with no move-out in the next ${noticeDays} days, but listed on ${chans.join(', ')}.`);
    if (occupancy === 'unknown' && active.length) add('not_in_rent_roll', `Listed on ${chans.join(', ')} but the unit is not in the rent roll.`);
    const seen = new Map();
    for (const l of active) { const k = fold(l.channel); seen.set(k, (seen.get(k) || 0) + 1); }
    for (const [k, n] of seen) if (n > 1) add('duplicate_listing', `${n} active listings on ${active.find((l) => fold(l.channel) === k).channel || 'one site'}.`);
    const rents = active.map((l) => ({ ch: str(l.channel) || 'unnamed site', v: num(l.rent) })).filter((x) => x.v !== null && x.v > 0);
    if (market) for (const x of rents) { const rawGap = ((x.v - market) / market) * 100; const gap = r2(rawGap); if (Math.abs(rawGap) > tol + 1e-9) add('rent_differs', `${x.ch} asks ${x.v}; the rent roll's market rent is ${market} (${gap > 0 ? '+' : ''}${gap}%).`, { amount: r2(x.v - market) }); }
    if (new Set(rents.map((x) => x.v)).size > 1) add('rent_inconsistent', `Asking rent differs between sites: ${rents.map((x) => `${x.ch} ${x.v}`).join(', ')}.`);
    const deps = active.map((l) => ({ ch: str(l.channel), v: num(l.deposit) })).filter((x) => x.v !== null);
    if (new Set(deps.map((x) => x.v)).size > 1) add('deposit_inconsistent', `Deposit differs between sites: ${deps.map((x) => `${x.ch} ${x.v}`).join(', ')}.`);
    const staleBy = []; const early = [];
    for (const l of active) {
      const ch = str(l.channel) || 'unnamed site'; const diffs = [];
      const beds = num(l.bedrooms); const baths = num(l.bathrooms); const area = num(l.sqft);
      if (bb.beds !== null && beds !== null && beds !== bb.beds) diffs.push(`${beds} bed vs ${bb.beds}`);
      if (bb.baths !== null && baths !== null && baths !== bb.baths) diffs.push(`${baths} bath vs ${bb.baths}`);
      if (sqft && area && Math.abs(area - sqft) / sqft > 0.05) diffs.push(`${area} sq ft vs ${sqft}`);
      if (diffs.length) add('details_differ', `${ch}: ${diffs.join(', ')} in the rent roll.`);
      const avail = isoDate(l.available);
      if (avail && avail < addDays(asOf, -stale)) staleBy.push({ ch, avail });
      if (avail && occupancy === 'notice' && moveOut && avail <= moveOut) early.push({ ch, avail });
      const text = ` ${fold(`${str(l.title)} ${str(l.description)}`).replace(/[^\p{L}\p{N}'’ -]+/gu, ' ')} `;
      const hits = words.filter(([w]) => text.includes(/[\u3040-\u9fff\uac00-\ud7af]/.test(w) ? w : ` ${w} `)).map(([, o]) => o);
      if (hits.length) add('wording_review', `${ch} listing uses ${hits.map((h) => `"${h}"`).join(', ')}. A person should review the wording; Fairlease Listing Checks does not judge whether it is allowed.`);
    }
    const group = (xs) => [...new Set(xs.map((x) => x.avail))].map((d) => `${[...new Set(xs.filter((x) => x.avail === d).map((x) => x.ch))].join(', ')} ${d}`).join('; ');
    if (staleBy.length) add('available_date_stale', `Available date more than ${stale} days old: ${group(staleBy)}.`);
    if (early.length) add('available_before_move_out', `Available on or before the current resident's move-out ${moveOut}: ${group(early)}.`);
    const pets = new Set(active.map((l) => fold(l.pets)).filter(Boolean));
    if (pets.size > 1) add('pets_inconsistent', `Pet terms differ between sites: ${active.filter((l) => str(l.pets)).map((l) => `${str(l.channel)} "${str(l.pets)}"`).join(', ')}.`);
    const codes = findings.map((f) => f.code);
    const status = codes.some((c) => c !== 'wording_review') ? 'issue' : codes.length ? 'review' : 'ok';
    items.push({ unit: u.unit, property: u.property || null, occupancy, move_out: moveOut, market_rent: market, channels: chans, asking: rents.length ? rents[0].v : null, amount: rents.length ? rents[0].v : null, status, findings });
  }
  const order = { issue: 0, review: 1, ok: 2 };
  items.sort((a, b) => order[a.status] - order[b.status] || String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true }));
  const avail = items.filter((i) => ['vacant', 'notice'].includes(i.occupancy));
  const c = (code) => items.filter((i) => i.findings.some((f) => f.code === code)).length;
  const summary = `${avail.length} vacant or on-notice unit(s): ${avail.filter((i) => i.channels.length && !i.findings.some((f) => ['missing_on_channel', 'not_listed'].includes(f.code))).length} listed${required.length ? ' on every required site' : ''}, ${c('not_listed')} not listed, ${c('missing_on_channel')} missing a site. ${c('listed_while_occupied')} occupied unit(s) still listed, ${c('not_in_rent_roll')} listing(s) for units not in the rent roll. ${items.filter((i) => i.findings.some((f) => ['rent_differs', 'rent_inconsistent'].includes(f.code))).length} unit(s) with rent differences, ${c('details_differ')} with details that differ, ${c('wording_review')} with wording to review.`;
  return { summary, as_of: asOf, items };
}

/** Correction request to whoever manages the listings. */
export function correctionText(it, a = {}) {
  return `**To:** ${a.to || '[TO CONFIRM: leasing or marketing contact]'}

# Listing corrections: unit ${it.unit}${it.property ? `, ${it.property}` : ''}

${it.occupancy === 'vacant' ? 'Unit is vacant.' : it.occupancy === 'notice' ? `Current resident ${it.move_out ? `moves out ${it.move_out}` : 'has given notice'}.` : it.occupancy === 'occupied' ? 'Unit is occupied.' : it.occupancy === 'leased' ? 'Unit is already leased.' : it.occupancy === 'not_rentable' ? 'Unit is not for rent (model, down or staff unit).' : 'Unit is not in the rent roll.'}${it.market_rent ? ` Market rent in the rent roll: ${it.market_rent}.` : ''}

Please check and correct:

${it.findings.map((f) => `- ${f.detail}`).join('\n')}

Please confirm once the sites are updated${a.by ? ` by ${a.by}` : ''}.

${a.from || '[TO CONFIRM: your name and contact]'}
`;
}
