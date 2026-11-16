// Occupancy, exposure, vacancy loss and loss to lease from a rent roll. Pure functions.
import { r2, num, str, isoDate, daysBetween, groupRentRoll } from 'keystone-core';

const RENTED = /(vacant|vacío|vacante|leer)[-\s]*(rented|leased|preleased|vermietet|alquilad|loué)/i;

export function checkVacancy({ rows, asOf, longVacantDays = 30, offMarketPct = 10, aliases = {} }) {
  const units = groupRentRoll(rows, { aliases });
  const items = [];
  for (const u of units) {
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const rented = RENTED.test(u.status);
    const vacant = u.vacant || rented; const market = u.market_rent;
    const lastOut = u.move_out && u.move_out <= asOf ? u.move_out : null;
    const daysVacant = vacant && lastOut ? daysBetween(lastOut, asOf) : null;
    const daily = market !== null ? (market * 12) / 365 : null;
    const lostSoFar = vacant && daily !== null && daysVacant !== null ? r2(daily * daysVacant) : null;
    const rent = vacant ? null : u.rent;
    const concession = u.charges && u.charges.credit ? r2(-u.charges.credit) : 0;
    const ltl = !vacant && market !== null && rent !== null ? r2(market - rent) : null;
    if (market === null) add('market_rent_missing', 'No market rent for this unit; loss to lease and vacancy loss cannot be worked out.');
    if (vacant) {
      if (daysVacant === null) add('vacant_since_unknown', 'Vacant, but the rent roll has no move-out date, so days vacant are unknown.', { severity: 'note' });
      else if (daysVacant > longVacantDays) add('long_vacant', `Vacant ${daysVacant} days (since ${lastOut}), longer than ${longVacantDays}.`, { amount: lostSoFar });
      if (rented) add('vacant_rented', `Pre-leased${u.move_in ? `: move-in ${u.move_in}` : ''}.`, { severity: 'note' });
    } else {
      if (rent === null) add('rent_missing', 'Occupied, but no rent on the rent roll.');
      if (ltl !== null && market && ltl / market * 100 > offMarketPct) add('below_market', `Rent ${rent} is ${r2(ltl / market * 100)}% under market ${market}; look at it at renewal.`, { amount: ltl, severity: 'note' });
      if (ltl !== null && market && -ltl / market * 100 > offMarketPct) add('above_market', `Rent ${rent} is ${r2(-ltl / market * 100)}% over market ${market}; check the market rent or the rent (a typo, or a renewal risk).`);
      if (u.on_notice) add('notice_unrented', `On notice${u.move_out ? `, moving out ${u.move_out}` : ''}; not yet re-leased.`, { severity: 'note' });
      if (u.lease_end && u.lease_end < asOf && !u.on_notice) add('month_to_month', `Lease ended ${u.lease_end}; month to month.`, { severity: 'note' });
    }
    if (concession) add('concession', `Concession of ${concession} a month on the rent roll.`, { severity: 'note', amount: concession });
    const blocking = findings.filter((f) => f.severity !== 'note');
    items.push({ property: u.property, unit: u.unit, tenant: vacant && !rented ? '' : u.tenant, status: rented ? 'vacant_rented' : vacant ? 'vacant' : u.on_notice ? 'notice' : 'occupied', status_text: u.status, market_rent: market, rent, loss_to_lease: ltl, concession, days_vacant: daysVacant, vacancy_loss_to_date: lostSoFar, review: blocking.length > 0, findings });
  }
  const n = items.length; const occ = items.filter((i) => i.status === 'occupied' || i.status === 'notice');
  const vac = items.filter((i) => i.status === 'vacant'); const pre = items.filter((i) => i.status === 'vacant_rented'); const notice = items.filter((i) => i.status === 'notice');
  const gpr = r2(items.reduce((s, i) => s + (i.market_rent || 0), 0));
  const ltl = r2(occ.reduce((s, i) => s + (i.loss_to_lease || 0), 0));
  const vacLoss = r2([...vac, ...pre].reduce((s, i) => s + (i.market_rent || 0), 0));
  const conc = r2(items.reduce((s, i) => s + i.concession, 0));
  const t = {
    units: n, occupied: occ.length, vacant: vac.length + pre.length, pre_leased: pre.length, on_notice: notice.length,
    physical_occupancy_pct: n ? r2(occ.length / n * 100) : 0, leased_pct: n ? r2((occ.length - notice.length + pre.length) / n * 100) : 0, exposure_units: vac.length + notice.length,
    gross_potential_rent: gpr, loss_to_lease: ltl, vacancy_loss_monthly: vacLoss, concessions: conc, economic_occupancy_pct: gpr ? r2((gpr - ltl - vacLoss - conc) / gpr * 100) : null,
    vacancy_loss_to_date: r2(items.reduce((s, i) => s + (i.vacancy_loss_to_date || 0), 0)),
  };
  const order = { vacant: 0, vacant_rented: 1, notice: 2, occupied: 3 };
  items.sort((a, b) => (b.review - a.review) || order[a.status] - order[b.status] || String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true }));
  const summary = `${n} unit(s) as of ${asOf}: ${t.physical_occupancy_pct}% occupied, ${t.leased_pct}% leased, exposure ${t.exposure_units} unit(s). Market rent ${gpr} a month; loss to lease ${ltl}, vacancy ${vacLoss}, concessions ${conc} (economic occupancy ${t.economic_occupancy_pct}%). ${items.filter((i) => i.findings.some((f) => f.code === 'long_vacant')).length} long vacant; ${items.filter((i) => i.review).length} unit(s) to review.`;
  return { summary, as_of: asOf, totals: t, items };
}
