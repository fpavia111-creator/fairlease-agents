// Rent roll against lease abstracts. Pure functions over rows already read.
import { r2, num, str, isoDate, inWindow, unitKey, sameParty, partyKey, rentAt, groupRentRoll } from 'keystone-core';

const near = (a, b, tol) => a !== null && b !== null && Math.abs(a - b) <= tol;

/** Compare each rent roll unit with the lease in force on as_of. */
export function checkRentRoll({ rows, leases, asOf, indexes = {}, tolerance = 1, aliases = {} }) {
  const units = groupRentRoll(rows, { aliases });
  const list = leases.leases || [];
  const used = new Set(); const items = [];
  for (const u of units) {
    const findings = []; const add = (code, detail, amount = null) => findings.push({ code, detail, ...(amount !== null ? { amount: r2(amount) } : {}) });
    const cands = list.filter((l) => unitKey(l.unit) === unitKey(u.unit) && (!u.property || !l.property || str(l.property).toLowerCase() === u.property.toLowerCase() || true));
    const inForce = cands.filter((l) => inWindow(asOf, l.start, l.end));
    let lease = inForce.find((l) => !u.tenant || sameParty(l.tenant, u.tenant)) || inForce[0] || null;
    const ended = !lease ? cands.filter((l) => l.end < asOf).sort((a, b) => b.end.localeCompare(a.end))[0] : null;
    let expected = null;
    if (lease) {
      used.add(lease.lease_id);
      if (u.vacant) add('vacant_with_lease', `Shown as ${u.status || 'vacant'}, but lease ${lease.lease_id} (${lease.tenant}) runs ${lease.start} to ${lease.end}.`);
      else {
        if (u.tenant && !sameParty(lease.tenant, u.tenant)) add('tenant_mismatch', `Rent roll says "${u.tenant}", the lease says "${lease.tenant}".`);
        expected = rentAt(lease, asOf, { indexes });
        if (expected === null && lease.escalation && lease.escalation.type === 'cpi') add('rent_needs_index', `CPI escalation needs the index months in the indexes file; rent not checked.`);
        else if (expected === null) add('rent_not_in_lease', 'The lease abstract has no rent for this date; rent not checked.');
        else if (u.rent === null) add('rent_missing', `No rent on the rent roll; the lease gives ${expected}.`, expected);
        else if (!near(u.rent, expected, tolerance)) add(u.rent < expected ? 'rent_under_lease' : 'rent_over_lease', `Rent roll ${u.rent}, lease ${expected} on ${asOf} (${u.rent < expected ? 'a missed escalation or step?' : 'billed above the lease'}).`, u.rent - expected);
        const cashDep = !lease.deposit_type || lease.deposit_type === 'cash' ? (lease.deposit ?? null) : 0;
        if (lease.deposit_type && lease.deposit_type !== 'cash' && lease.deposit) add('deposit_not_cash', `Security is a ${lease.deposit_type.replace(/_/g, ' ')} for ${lease.deposit}; no cash deposit expected.`);
        if (cashDep !== null && u.deposit !== null && !near(u.deposit, cashDep, tolerance)) add('deposit_mismatch', `Deposit held ${u.deposit}, the lease requires ${cashDep}.`, u.deposit - cashDep);
        if (u.sqft !== null && num(lease.sqft) !== null && Math.abs(u.sqft - lease.sqft) > 0.5) add('area_mismatch', `Area ${u.sqft} on the rent roll, ${lease.sqft} in the lease (shares and per-foot rents use the area).`);
        if (u.lease_start && u.lease_start !== lease.start) add('start_mismatch', `Start ${u.lease_start} on the rent roll, ${lease.start} in the lease.`);
        if (u.lease_end && u.lease_end !== lease.end) add('end_mismatch', `End ${u.lease_end} on the rent roll, ${lease.end} in the lease (renewal not recorded?).`);
      }
    } else if (!u.vacant) {
      if (ended) add('holdover', `Lease ${ended.lease_id} (${ended.tenant}) ended ${ended.end}; the unit is still shown occupied.`);
      else add('no_lease', `Occupied by "${u.tenant || '?'}" at ${u.rent ?? '?'}, but there is no lease for this unit in the leases file.`);
    }
    const status = findings.some((f) => /mismatch|under|over|missing|no_lease|holdover|vacant_with/.test(f.code)) ? 'issue' : findings.some((f) => /needs|not_in/.test(f.code)) ? 'review' : 'ok';
    items.push({ property: u.property, unit: u.unit, tenant: u.tenant || (u.vacant ? '(vacant)' : ''), lease_id: lease ? lease.lease_id : null, rent_roll_rent: u.rent, lease_rent: expected, difference: expected !== null && u.rent !== null ? r2(u.rent - expected) : null, deposit: u.deposit, vacant: u.vacant, status, findings });
  }
  for (const l of list) if (!used.has(l.lease_id) && inWindow(asOf, l.start, l.end) && !items.some((i) => unitKey(i.unit) === unitKey(l.unit))) items.push({ property: l.property || '', unit: l.unit, tenant: l.tenant, lease_id: l.lease_id, rent_roll_rent: null, lease_rent: rentAt(l, asOf, { indexes }), difference: null, deposit: null, vacant: false, status: 'issue', findings: [{ code: 'missing_from_rent_roll', detail: `Lease ${l.lease_id} (${l.tenant}) is in force on ${asOf} but the unit is not on the rent roll.` }] });
  const monthlyGap = r2(items.reduce((s, i) => s + (i.difference && i.difference < 0 ? -i.difference : 0), 0));
  const by = {}; for (const i of items) for (const f of i.findings) by[f.code] = (by[f.code] || 0) + 1;
  const summary = `${items.length} unit(s) as of ${asOf}: ${items.filter((i) => i.status === 'issue').length} with issues, ${items.filter((i) => i.status === 'review').length} to review, ${items.filter((i) => i.status === 'ok').length} match. Rent under the leases by ${monthlyGap} a month. Vacant: ${items.filter((i) => i.vacant).length}.`;
  return { summary, as_of: asOf, units: items.length, rent_roll_monthly: r2(items.reduce((s, i) => s + (i.rent_roll_rent || 0), 0)), under_lease_monthly: monthlyGap, by_finding: by, items };
}
