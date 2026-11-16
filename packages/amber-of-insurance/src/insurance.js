// Tenant insurance certificates against lease requirements. Pure functions.
import { num, str, isoDate, daysBetween, leaseFor, sameUnit, sameParty } from 'keystone-core';

const yes = (v) => /^(y|yes|true|1|x|named|ja|oui|sí|si|sim|はい|是|예)$/i.test(str(v));
const no = (v) => /^(n|no|false|0|nein|non|não|nao|いいえ|否|아니오)$/i.test(str(v));
const money = (v) => (v === null || v === undefined ? '-' : Number(v).toLocaleString('en-US'));

export function checkInsurance({ leases, certs, asOf, warnDays = 30 }) {
  const items = []; const used = new Set();
  const holdover = (l) => l.end && l.end < asOf && /month[- ]to[- ]month|holdover|mes a mes|monatlich|au mois/i.test(str(l.notes));
  const active = (leases.leases || []).filter((l) => l.start <= asOf && (!l.end || l.end >= asOf || holdover(l)));
  for (const l of active) {
    const req = l.insurance || {}; const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    if (holdover(l)) add('holdover', `Lease ended ${l.end}; treated as in force because its notes say month-to-month.`, { severity: 'note' });
    const mine = certs.map((c, i) => ({ c, i })).filter(({ c }) => (c.lease_id && str(c.lease_id) === l.lease_id) || (!str(c.lease_id) && sameUnit(c.unit, l.unit) && (!str(c.tenant) || sameParty(c.tenant, l.tenant))));
    mine.forEach(({ i }) => used.add(i));
    const latest = mine.map(({ c }) => c).sort((a, b) => String(isoDate(b.expires)).localeCompare(String(isoDate(a.expires))))[0];
    const needGl = num(req.gl_per_occurrence); const needAgg = num(req.gl_aggregate); const needRl = num(req.renters_liability);
    const required = needGl !== null || needAgg !== null || needRl !== null || req.additional_insured;
    if (!required) { items.push({ lease_id: l.lease_id, unit: l.unit, tenant: l.tenant, required: '', insurer: latest ? str(latest.insurer) : '', expires: latest ? isoDate(latest.expires) : null, liability: latest ? num(latest.liability) : null, status: 'ok', findings: [...findings, { code: 'no_requirement', detail: 'The leases file sets no insurance requirement for this lease.', severity: 'note' }] }); continue; }
    if (!latest) add('certificate_missing', 'No certificate on file.');
    else {
      const exp = isoDate(latest.expires); const left = exp ? daysBetween(asOf, exp) : null;
      if (!exp) add('expiry_missing', 'Certificate has no expiration date.');
      else if (left < 0) add('expired', `Expired ${exp} (${-left} days ago).`);
      else if (left <= warnDays) add('expiring', `Expires ${exp} (${left} days).`, { severity: 'soon' });
      const occ = num(latest.liability); const agg = num(latest.aggregate);
      const needOcc = needGl ?? needRl;
      if (needOcc !== null && (occ === null || occ < needOcc)) add('liability_below', `Liability ${money(occ)} is below the ${money(needOcc)} the lease requires.`);
      if (needAgg !== null && (agg === null || agg < needAgg)) add('aggregate_below', `Aggregate ${money(agg)} is below the ${money(needAgg)} the lease requires.`);
      if (req.additional_insured && !yes(latest.additional_insured)) add('additional_insured_missing', no(latest.additional_insured) ? 'Landlord is not named as additional insured, which the lease requires.' : 'Certificate does not show whether the landlord is named as additional insured.');
    }
    const hard = findings.filter((f) => !f.severity);
    items.push({ lease_id: l.lease_id, unit: l.unit, tenant: l.tenant, required: [needGl !== null ? `${money(needGl)} per occurrence` : '', needAgg !== null ? `${money(needAgg)} aggregate` : '', needRl !== null ? `${money(needRl)} liability` : '', req.additional_insured ? 'additional insured' : ''].filter(Boolean).join(', '), insurer: latest ? str(latest.insurer) : '', policy: latest ? str(latest.policy) : '', expires: latest ? isoDate(latest.expires) : null, liability: latest ? num(latest.liability) : null, status: hard.length ? 'issue' : findings.some((f) => f.severity === 'soon') ? 'due_soon' : 'ok', findings });
  }
  const orphans = certs.filter((c, i) => !used.has(i)).map((c) => { const l = leaseFor(leases, { lease_id: str(c.lease_id) || undefined, unit: c.unit, tenant: c.tenant }); return { unit: str(c.unit), tenant: str(c.tenant), expires: isoDate(c.expires), reason: l ? `lease ${l.lease_id} not in force on the date (${l.start} to ${l.end})` : 'matches no lease' }; });
  const rank = { issue: 0, due_soon: 1, ok: 2 };
  items.sort((a, b) => rank[a.status] - rank[b.status] || String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true }));
  const summary = `${items.length} lease(s) in force on ${asOf}: ${items.filter((i) => i.findings.some((f) => f.code === 'certificate_missing')).length} with no certificate, ${items.filter((i) => i.findings.some((f) => f.code === 'expired')).length} expired, ${items.filter((i) => i.findings.some((f) => /_below$|additional_insured/.test(f.code))).length} short of the lease's limits or wording, ${items.filter((i) => i.findings.some((f) => f.code === 'expiring')).length} expiring within ${warnDays} days.${orphans.length ? ` ${orphans.length} certificate(s) match no lease in force.` : ''}`;
  return { summary, as_of: asOf, unmatched_certificates: orphans, items };
}

export function requestText(it, a = {}) {
  return `**To:** ${a.to || '[TO CONFIRM: tenant notice address or email]'}

# Request for an updated certificate of insurance

${it.tenant} (${it.unit}, lease ${it.lease_id})

Our records show the following about your insurance certificate:

${it.findings.filter((f) => f.severity !== 'note').map((f) => `- ${f.detail}`).join('\n')}

Your lease requires: ${it.required || '[TO CONFIRM: requirement]'}.

Please send an updated certificate${a.holder ? ` naming ${a.holder} as certificate holder and additional insured` : ' [TO CONFIRM: certificate holder and additional insured wording]'} by ${a.reply_by || '[TO CONFIRM: date]'}.

${a.from || '[TO CONFIRM: name and contact]'}
`;
}
