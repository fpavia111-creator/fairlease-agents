// Tenant estoppel certificates against the lease abstracts, before a sale or refinancing. Pure functions.
import { r2, num, str, isoDate, daysBetween, rentAt, sameUnit, sameParty, leaseFor, monthEnd, foldText } from 'fairlease-core';

export const ESTOPPEL_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    closing: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    max_age_days: { type: 'integer', minimum: 1, maximum: 365 },
    required_pct: { type: 'number', minimum: 0, maximum: 100 },
    major_sqft: { type: 'number', minimum: 0 },
    rent_tolerance: { type: 'number', minimum: 0 },
  },
});

const NONE = /^(none|no|n|nil|n\/a|n a|na|-|0|keine|kein|nein|aucune?|rien|non|ningun[oa]?|nada|no hay|nenhum|nenhuma|não|nao|nessuno|nessuna|nulla|なし|無し|无|没有|없음)\.?$/i;
// Short ways of saying "nothing to report". Anything longer or different is quoted as the tenant's statement.
const NO_CLAIM = /^(none( known| at this time| to (the )?(best of )?(tenant s|tenants|our|its|my) knowledge)?|no (known )?(defaults?|claims?|offsets?|disputes?|amendments?|options?|modifications?)( known| exist| at this time)?|(tenant is |we are |i am )?not aware of any( defaults?| claims?)?|not applicable)$/;
const said = (v) => { const t = str(v); const f = foldText(t).trim(); return t && !NONE.test(f) && !NO_CLAIM.test(f) ? t : ''; };
const idKey = (v) => str(v).toLowerCase().replace(/\s+/g, '');
const holdover = (l, asOf) => l.end && l.end < asOf && /month[- ]to[- ]month|holdover|mes a mes|monatlich|au mois/i.test(str(l.notes));

export function checkEstoppels({ leases, estoppels, rentRoll = null, policy = {}, indexes = {}, asOf }) {
  const tol = policy.rent_tolerance ?? 1; const maxAge = policy.max_age_days ?? 30; const ref = policy.closing || asOf;
  const inForce = (leases.leases || []).filter((l) => l.start <= asOf && (!l.end || l.end >= asOf || holdover(l, asOf)));
  const used = new Set(); const items = [];
  for (const l of inForce) {
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const mine = estoppels.map((e, i) => ({ e, i })).filter(({ e }) => (str(e.lease_id) && idKey(e.lease_id) === idKey(l.lease_id)) || (!str(e.lease_id) && sameUnit(e.unit, l.unit) && (!str(e.tenant) || sameParty(e.tenant, l.tenant))));
    mine.forEach(({ i }) => used.add(i));
    const e = mine.map(({ e: x }) => x).sort((a, b) => String(isoDate(b.signed) || isoDate(b.received) || '').localeCompare(String(isoDate(a.signed) || isoDate(a.received) || '')))[0];
    const sqft = num(l.sqft); const major = policy.major_sqft !== undefined && sqft !== null && sqft >= policy.major_sqft;
    const expected = rentAt(l, asOf, { indexes });
    if (!e) { add(major ? 'major_tenant_missing' : 'not_returned', `No estoppel returned${major ? ` from a major tenant (${sqft} sq ft)` : ''}.`); }
    else {
      const signed = isoDate(e.signed);
      if (holdover(l, asOf)) add('holdover', `Lease ended ${l.end}; treated as in force because its notes say month-to-month.`, { severity: 'note' });
      if (str(e.tenant) && !sameParty(e.tenant, l.tenant)) add('tenant_differs', `The estoppel is from ${str(e.tenant)}; the tenant on the lease is ${l.tenant}. Check for an assignment or a sublease.`);
      if (!signed) add('unsigned', 'No signature date on the estoppel; it may not be signed.');
      else if (signed > asOf) add('signed_in_future', `Signature date ${signed} is after ${asOf}; check the date.`);
      else if (daysBetween(signed, ref) > maxAge) add('stale', `Signed ${signed}, ${daysBetween(signed, ref)} days before ${policy.closing ? `closing ${ref}` : ref}; your limit is ${maxAge} days.`);
      const rent = num(e.rent);
      if (rent === null) add('rent_missing', 'Estoppel states no rent.');
      else if (expected === null) add('rent_not_computable', `Estoppel states ${rent}; the lease file cannot compute rent for ${asOf}${l.escalation && l.escalation.type === 'cpi' ? ' (CPI escalation: give index values)' : ''}.`, { severity: 'note' });
      else if (Math.abs(rent - expected) > tol) add('rent_differs', `Estoppel states rent ${rent}; the lease abstract gives ${expected} for ${asOf} (${r2(rent - expected)}).`, { amount: r2(rent - expected) });
      for (const [k, lk, name] of [['lease_start', 'start', 'commencement'], ['lease_end', 'end', 'expiration']]) { const v = isoDate(e[k]); if (v && v !== l[lk]) add(k === 'lease_end' ? 'expiration_differs' : 'commencement_differs', `Estoppel states ${name} ${v}; the lease abstract has ${l[lk]}.`); }
      const dep = num(e.deposit); const ldep = num(l.deposit);
      if (dep !== null && ldep !== null && Math.abs(dep - ldep) > 0.004) add('deposit_differs', `Estoppel states deposit ${dep}; the lease abstract has ${ldep}.`, { amount: r2(dep - ldep) });
      const area = num(e.sqft); if (area !== null && sqft !== null && Math.abs(area - sqft) > 0.5) add('area_differs', `Estoppel states ${area} sq ft; the lease abstract has ${sqft}.`);
      const claim = said(e.defaults); if (claim) add('default_claimed', `Tenant states: "${claim}".`);
      const amend = said(e.amendments); const known = (l.amendments || []).length;
      if (!amend && str(e.amendments) && known) add('amendment_not_confirmed', `Lease file has ${known} amendment(s); the estoppel says none.`);
      if (amend && !known) add('amendment_not_in_file', `Tenant lists amendments the lease file does not have: "${amend}".`);
      const opts = said(e.options); const lopts = (l.options || []).length;
      if (opts && !lopts) add('option_not_in_file', `Tenant states options the lease file does not have: "${opts}".`);
      else if (!opts && str(e.options) && lopts) add('option_not_confirmed', `Lease file has ${lopts} option(s); the estoppel says none.`);
      const pt = isoDate(e.paid_through); if (pt && pt > monthEnd(asOf.slice(0, 7))) add('rent_prepaid', `Rent paid through ${pt}, beyond the current month; prepaid rent is usually credited at closing.`, { severity: 'note' });
    }
    if (rentRoll) {
      const rr = rentRoll.find((r) => sameUnit(r.unit, l.unit)); const rrRent = rr ? num(rr.rent) : null;
      if (rrRent !== null && expected !== null && Math.abs(rrRent - expected) > tol) add('rent_roll_differs', `Rent roll shows ${rrRent}; the lease abstract gives ${expected}.`, { amount: r2(rrRent - expected) });
    }
    const hard = findings.filter((f) => !f.severity);
    const status = !e ? 'missing' : hard.some((f) => ['default_claimed', 'tenant_differs', 'rent_differs', 'expiration_differs', 'deposit_differs', 'amendment_not_in_file', 'option_not_in_file'].includes(f.code)) ? 'discrepancy' : hard.length ? 'follow_up' : 'clean';
    items.push({ lease_id: l.lease_id, unit: l.unit, tenant: l.tenant, sqft, major, expected_rent: expected, estoppel_rent: e ? num(e.rent) : null, signed: e ? isoDate(e.signed) : null, status, findings });
  }
  const orphans = estoppels.filter((x, i) => !used.has(i)).map((x) => { const l = leaseFor(leases, { lease_id: str(x.lease_id) || undefined, unit: x.unit, tenant: x.tenant }); return { unit: str(x.unit), tenant: str(x.tenant), reason: l ? `lease ${l.lease_id} not in force on ${asOf}` : 'matches no lease' }; });
  const rank = { discrepancy: 0, missing: 1, follow_up: 2, clean: 3 };
  items.sort((a, b) => rank[a.status] - rank[b.status] || String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true }));
  const total = items.reduce((s, i) => s + (i.sqft || 0), 0); const back = items.filter((i) => i.status !== 'missing').reduce((s, i) => s + (i.sqft || 0), 0);
  const pct = total ? r2((back / total) * 100) : null;
  const coverage = { leases: items.length, returned: items.filter((i) => i.status !== 'missing').length, clean: items.filter((i) => i.status === 'clean').length, sqft_total: total, sqft_returned: back, pct_returned: pct, required_pct: policy.required_pct ?? null, meets_requirement: policy.required_pct === undefined || pct === null ? null : pct >= policy.required_pct };
  const summary = `${coverage.returned} of ${coverage.leases} estoppel(s) returned, ${pct ?? '?'}% of leased area${coverage.required_pct !== null ? ` (${coverage.meets_requirement ? 'meets' : 'below'} the ${coverage.required_pct}% required)` : ''}. ${items.filter((i) => i.status === 'discrepancy').length} with discrepancies against the lease abstracts, ${items.filter((i) => i.findings.some((f) => f.code === 'default_claimed')).length} claiming a landlord default, ${items.filter((i) => i.status === 'follow_up').length} to follow up (unsigned, stale or minor differences), ${coverage.clean} clean.${orphans.length ? ` ${orphans.length} estoppel(s) match no lease in force.` : ''}`;
  return { summary, as_of: asOf, closing: policy.closing || null, coverage, unmatched_estoppels: orphans, items };
}

/** Follow-up request to a tenant: return, sign, re-date or correct their estoppel. */
export function requestText(it, a = {}) {
  const ask = it.status === 'missing' ? 'Please complete, sign and return the enclosed tenant estoppel certificate.'
    : it.findings.some((f) => f.code === 'stale' || f.code === 'unsigned') && it.status !== 'discrepancy' ? 'Please sign and date a fresh copy of the tenant estoppel certificate; the one we hold is unsigned or too old for closing.'
      : 'Thank you for returning your tenant estoppel certificate. Some statements differ from our lease records; please review the points below and confirm or send a corrected certificate.';
  const pts = it.findings.filter((f) => !f.severity && !['not_returned', 'major_tenant_missing', 'rent_roll_differs'].includes(f.code));
  return `**To:** ${a.to || `${it.tenant} [TO CONFIRM: notice address under the lease]`}

# Tenant estoppel certificate: ${it.tenant} (${it.unit}, lease ${it.lease_id})

${ask}
${pts.length ? `\n${pts.map((f) => `- ${f.detail}`).join('\n')}\n` : ''}
Please return it by ${a.reply_by || '[TO CONFIRM: date, as your lease\'s estoppel clause allows]'}. ${a.purpose || '[TO CONFIRM: purpose, for example a sale or refinancing, and who may rely on it]'}

${a.from || '[TO CONFIRM: landlord name and contact]'}
`;
}
