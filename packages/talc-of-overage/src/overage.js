// Percentage (overage) rent from tenant sales reports. Pure functions.
import { r2, num, str, isoDate, addDays, addMonths, monthEnd, monthKey, monthsInRange, daysBetween, periodKey, rentForMonth, naturalBreakpoint, percentageRent, chargeKind, sameUnit, sameParty, overlapDays } from 'keystone-core';

/** The lease year that starts in `year` (YYYY) at the lease's year_start_month: { from, to, months }. */
export function leaseYear(lease, year) {
  const sm = (lease.percentage_rent && lease.percentage_rent.year_start_month) || 1;
  const from = `${year}-${String(sm).padStart(2, '0')}-01`; const to = addDays(addMonths(from, 12), -1);
  return { from, to, months: monthsInRange(from, to) };
}

const flat = (v) => str(v).toLowerCase().replace(/[^a-z0-9]/g, '');
const matchLease = (leases, r, m) => (leases.leases || []).find((x) => (r.lease_id && flat(r.lease_id) === flat(x.lease_id)) || (!r.lease_id && ((r.unit && sameUnit(x.unit, r.unit)) || (!r.unit && r.tenant)) && (!r.tenant || sameParty(x.tenant, r.tenant)) && (!m || overlapDays(x.start, x.end, `${m}-01`, monthEnd(`${m}-01`)))));

/** Sales reports by lease and month. Several reports for one month: the latest received wins (a revision). */
export function salesByMonth(rows, leases) {
  const out = new Map(); const unmatched = []; const unreadable = [];
  for (const r of rows) {
    const m = periodKey(r.period); const gross = num(r.gross_sales);
    if (!m || gross === null) { unreadable.push({ row: r.__row ?? null, period: str(r.period), tenant: str(r.tenant || r.lease_id) }); continue; }
    const l = matchLease(leases, r, m);
    if (!l) { unmatched.push({ tenant: str(r.tenant), unit: str(r.unit), period: m, gross_sales: gross }); continue; }
    // Exclusions are deductions whichever sign the export gives them.
    const rec = { month: m, gross_sales: r2(gross), exclusions: r2(Math.abs(num(r.exclusions) || 0)), reported_on: isoDate(r.reported_on), first_reported_on: isoDate(r.reported_on) };
    const k = `${l.lease_id}|${m}`; const was = out.get(k);
    if (!was) { out.set(k, { ...rec, versions: 1 }); continue; }
    const later = (rec.reported_on || '') >= (was.reported_on || '');
    const same = rec.gross_sales === was.gross_sales && rec.exclusions === was.exclusions;
    // A revision is not a late report: lateness is judged on the first report received.
    const first = !rec.reported_on || !was.first_reported_on ? null : (rec.reported_on < was.first_reported_on ? rec.reported_on : was.first_reported_on);
    out.set(k, { ...(later ? rec : was), first_reported_on: first, versions: was.versions + 1, conflict: was.conflict || (!same && rec.reported_on === was.reported_on), revised_from: same ? was.revised_from : r2((later ? was : rec).gross_sales) });
  }
  return { sales: out, unmatched, unreadable };
}

/** Percentage rent billed per lease within [from, to] (charges whose kind is percentage_rent). */
export function billedPercentageRent(rows, leases, from, to, aliases = {}) {
  const out = new Map();
  for (const r of rows || []) {
    if (chargeKind(r.charge_code || r.description, aliases) !== 'percentage_rent' && chargeKind(r.description, aliases) !== 'percentage_rent') continue;
    if (num(r.charge) === null && num(r.payment) !== null) continue; // a payment line, not a charge
    const d = isoDate(r.date); if (!d || d < from || d > to) continue;
    const amt = num(r.charge) ?? num(r.amount); if (amt === null) continue;
    const l = matchLease(leases, r, null); if (!l) continue;
    out.set(l.lease_id, r2((out.get(l.lease_id) || 0) + amt));
  }
  return out;
}

/**
 * Percentage rent for every lease with a percentage_rent clause, for the lease year starting in `year`.
 * Natural breakpoint = scheduled base rent in force that year (before free rent) / rate.
 * A fixed breakpoint is prorated by days in force in a partial year unless prorate_partial_year is false.
 */
export function computeOverage({ leases, rows, year, billedRows = null, billedThrough = null, asOf = null, indexes = {}, tolerance = 1, aliases = {} }) {
  const { sales, unmatched, unreadable } = salesByMonth(rows, leases);
  const items = []; const today = isoDate(asOf) || new Date().toISOString().slice(0, 10);
  for (const l of leases.leases || []) {
    const pr = l.percentage_rent; if (!pr) continue;
    const ly = leaseYear(l, year);
    const inForce = ly.months.filter((m) => overlapDays(l.start, l.end, `${m}-01`, monthEnd(`${m}-01`)) > 0);
    if (!inForce.length) continue;
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const noFree = { ...l, free_rent: [] };
    const baseByMonth = inForce.map((m) => rentForMonth(noFree, m, { indexes }));
    const baseRent = baseByMonth.some((v) => v === null) ? null : r2(baseByMonth.reduce((s, v) => s + v, 0));
    const daysIn = overlapDays(l.start, l.end, ly.from, ly.to); const daysYear = daysBetween(ly.from, ly.to) + 1;
    let breakpoint = null; let basis = '';
    if (pr.breakpoint === 'natural' || pr.breakpoint === undefined) {
      if (baseRent === null) add('base_rent_unknown', 'Base rent for the year is unknown (a CPI month has no index value), so the natural breakpoint cannot be worked out.');
      else { breakpoint = naturalBreakpoint(baseRent, pr.rate_pct); basis = `natural: base rent ${baseRent} / ${pr.rate_pct}%`; }
    } else if (daysIn < daysYear && pr.prorate_partial_year !== false) {
      breakpoint = r2((pr.breakpoint * daysIn) / daysYear); basis = `fixed ${pr.breakpoint} prorated for ${daysIn} of ${daysYear} days`;
      add('breakpoint_prorated', `Partial lease year: the ${pr.breakpoint} breakpoint is prorated to ${breakpoint} (${daysIn} of ${daysYear} days). Check that your lease prorates it.`, { severity: 'note' });
    } else { breakpoint = pr.breakpoint; basis = `fixed ${pr.breakpoint}`; }

    const lines = []; const missing = []; const late = [];
    for (const m of inForce) {
      const s = sales.get(`${l.lease_id}|${m}`);
      const due = pr.report_due_days !== undefined ? addDays(monthEnd(`${m}-01`), pr.report_due_days) : null;
      // With no deadline in the lease, a month cannot be missing before it has ended.
      const waitUntil = due || monthEnd(`${m}-01`);
      if (!s) { if (waitUntil < today) missing.push(m); lines.push({ month: m, gross_sales: null, exclusions: null, net_sales: null, reported_on: null, due, status: waitUntil >= today ? 'not_due' : 'missing' }); continue; }
      const firstOn = s.versions > 1 ? s.first_reported_on : s.reported_on;
      const isLate = !!(due && firstOn && firstOn > due);
      if (isLate) late.push({ month: m, days: daysBetween(due, firstOn) });
      if (s.exclusions > s.gross_sales + 0.004 || s.gross_sales < 0) add('exclusions_exceed_sales', s.gross_sales < 0 ? `${m}: gross sales are negative (${s.gross_sales}); check the report.` : `${m}: exclusions ${s.exclusions} are more than gross sales ${s.gross_sales}; check the report.`, { month: m });
      if (s.conflict) add('conflicting_reports', `${m}: two different sales reports with the same date; the figures used may be wrong.`, { month: m });
      else if (s.versions > 1 && s.revised_from !== undefined) add('sales_revised', `${m}: report revised from ${s.revised_from} to ${s.gross_sales} (latest report used).`, { month: m, severity: 'note' });
      lines.push({ month: m, gross_sales: s.gross_sales, exclusions: s.exclusions, net_sales: r2(s.gross_sales - s.exclusions), reported_on: s.reported_on, due, status: isLate ? 'late' : 'ok' });
    }
    const reported = lines.filter((x) => x.net_sales !== null);
    const netSales = r2(reported.reduce((s, x) => s + x.net_sales, 0));
    const exclusions = r2(reported.reduce((s, x) => s + x.exclusions, 0));
    if (missing.length) add('sales_missing', `No sales report for ${missing.join(', ')}; percentage rent is not final.`, { months: missing });
    if (lines.some((x) => x.status === 'not_due')) add('reports_not_due', `Reports not yet due for ${lines.filter((x) => x.status === 'not_due').map((x) => x.month).join(', ')}.`, { severity: 'note' });
    if (late.length) add('report_late', `Sales reported late: ${late.map((x) => `${x.month} (${x.days} days)`).join(', ')}.`, { months: late.map((x) => x.month) });
    if (exclusions > 0 && netSales > 0 && exclusions / (netSales + exclusions) > 0.1) add('exclusions_high', `Exclusions are ${r2((exclusions / (netSales + exclusions)) * 100)}% of gross sales; check them against the lease's list of allowed deductions.`, { severity: 'note' });

    const complete = !missing.length && !lines.some((x) => x.status === 'not_due');
    const owedSoFar = breakpoint === null ? null : percentageRent(netSales, breakpoint, pr.rate_pct);
    const owed = complete ? owedSoFar : null;
    const billedFrom = ly.from; const billedTo = isoDate(billedThrough) && isoDate(billedThrough) > ly.to ? isoDate(billedThrough) : ly.to;
    const billed = billedRows ? (billedPercentageRent(billedRows, leases, billedFrom, billedTo, aliases).get(l.lease_id) || 0) : null;
    const balance = owed === null || billed === null ? (owed === null ? null : owed) : r2(owed - billed);
    if (breakpoint !== null && complete && netSales < breakpoint && netSales >= breakpoint * 0.95) add('near_breakpoint', `Sales are ${r2(breakpoint - netSales)} below the breakpoint (within 5%).`, { severity: 'note' });
    if (breakpoint !== null && !complete && netSales < breakpoint) add('below_so_far', `With ${reported.length} of ${inForce.length} months reported, sales are ${r2(breakpoint - netSales)} below the breakpoint; the missing months decide whether rent is owed.`, { severity: 'note' });

    const prior = leaseYear(l, year - 1).months.map((m) => sales.get(`${l.lease_id}|${m}`)).filter(Boolean);
    let yoy = null;
    if (complete && prior.length === 12) {
      const p = r2(prior.reduce((s, x) => s + x.gross_sales - x.exclusions, 0)); yoy = p ? r2(((netSales - p) / p) * 100) : null;
      if (yoy !== null && yoy <= -15) add('sales_drop', `Net sales are down ${Math.abs(yoy)}% on the prior year; a sign to watch (co-tenancy, credit).`, { severity: 'note' });
    }
    const blocking = findings.filter((f) => f.severity !== 'note');
    let status;
    if (owed === null) status = 'review';
    else if (blocking.some((f) => ['conflicting_reports', 'base_rent_unknown', 'exclusions_exceed_sales'].includes(f.code))) status = 'review';
    else if (balance !== null && balance > tolerance) status = 'owes';
    else if (balance !== null && balance < -tolerance) status = 'credit';
    else status = blocking.length ? 'issue' : 'ok';
    items.push({
      lease_id: l.lease_id, tenant: l.tenant, unit: l.unit, lease_year: `${ly.from} to ${ly.to}`, months_in_force: inForce.length, months_reported: reported.length,
      rate_pct: pr.rate_pct, breakpoint, breakpoint_basis: basis, base_rent: baseRent, gross_sales: r2(reported.reduce((s, x) => s + x.gross_sales, 0)), exclusions, net_sales: netSales,
      over_breakpoint: breakpoint === null ? null : r2(Math.max(0, netSales - breakpoint)), owed, owed_so_far: owedSoFar, billed, balance, yoy_pct: yoy,
      direction: balance === null ? 'unknown' : balance > tolerance ? 'tenant owes' : balance < -tolerance ? 'credit due' : 'settled', status, findings, lines,
    });
  }
  const owes = items.filter((i) => i.status === 'owes'); const review = items.filter((i) => i.status === 'review');
  const totalOwed = r2(items.reduce((s, i) => s + (i.owed || 0), 0)); const totalBal = r2(items.reduce((s, i) => s + Math.max(0, i.balance || 0), 0));
  const summary = `${items.length} lease(s) with percentage rent, lease year ${year}: ${owes.length} owe ${totalBal} in total${billedRows ? ' after amounts billed' : ' (no billing file, so nothing billed is subtracted)'}; ${review.length} to review${review.length ? ` (${review.map((i) => i.tenant).join(', ')})` : ''}. Percentage rent earned ${totalOwed}.${unmatched.length ? ` ${unmatched.length} sales row(s) matched no lease.` : ''}${unreadable.length ? ` ${unreadable.length} row(s) had no readable month or sales.` : ''}`;
  return { summary, year, as_of: today, total_owed: totalOwed, total_balance_due: totalBal, unmatched, unreadable, items };
}

/** Plain-text percentage rent statement (or a request for the missing reports). */
export function statementText(it, r, a = {}) {
  const fmt = (v) => (v === null || v === undefined ? '[TO CONFIRM]' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const rows = it.lines.map((x) => `| ${x.month} | ${x.gross_sales === null ? '[TO CONFIRM: report missing]' : fmt(x.gross_sales)} | ${x.exclusions === null ? '' : fmt(x.exclusions)} | ${x.net_sales === null ? '' : fmt(x.net_sales)} |`).join('\n');
  const head = `**To:** ${a.to ? a.to : '[TO CONFIRM: tenant notice address]'}\n**Tenant:** ${it.tenant} (${it.unit}, lease ${it.lease_id})\n**Lease year:** ${it.lease_year}\n\n`;
  const table = `| Month | Gross sales | Exclusions | Net sales |\n|---|---:|---:|---:|\n${rows}\n| **Total** | **${fmt(it.gross_sales)}** | **${fmt(it.exclusions)}** | **${fmt(it.net_sales)}** |\n\n`;
  const sign = `\n${a.from || '[TO CONFIRM: landlord or manager name]'}\n`;
  if (it.owed === null) {
    const miss = (it.findings.find((f) => f.code === 'sales_missing') || {}).months || [];
    return `# Request for sales reports\n\n${head}Our records show no sales report for ${miss.length ? miss.join(', ') : 'some months'} of the lease year. Under the percentage rent clause of your lease (${it.rate_pct}% of sales over the breakpoint), please send the missing report(s) so the year can be reconciled.\n\nSales received so far:\n\n${table}${it.breakpoint !== null ? `Breakpoint for the year: ${fmt(it.breakpoint)} (${it.breakpoint_basis}).\n` : ''}${sign}`;
  }
  const lines = [
    `Breakpoint: ${fmt(it.breakpoint)} (${it.breakpoint_basis})`,
    `Net sales over the breakpoint: ${fmt(it.over_breakpoint)}`,
    `Percentage rent at ${it.rate_pct}%: ${fmt(it.owed)}`,
    `Percentage rent already billed: ${it.billed === null ? '[TO CONFIRM: amounts billed]' : fmt(it.billed)}`,
    `${it.balance > 0 ? 'Balance due from tenant' : it.balance < 0 ? 'Credit due to tenant' : 'Balance'}: ${fmt(Math.abs(it.balance ?? 0))}`,
  ];
  return `# Percentage rent statement\n\n${head}${table}${lines.map((x) => `- ${x}`).join('\n')}\n\n${a.due_note || '[TO CONFIRM: payment or credit timing under the lease]'}\n${it.findings.filter((f) => f.code === 'report_late').map((f) => `\nNote: ${f.detail}\n`).join('')}${sign}`;
}
