// CAM / operating expense reconciliation. Pure functions over rows already read.
import { r2, num, str, isoDate, overlapDays, shareOf, grossUp, capLimit, chargeKind, sameUnit, sameParty } from 'keystone-core';

/** "6600 - Property insurance" → "6600"; "6600" → "6600". */
export const acctCode = (v) => { const m = /^\s*([A-Za-z0-9][A-Za-z0-9.]*)/.exec(str(v)); return m ? m[1] : ''; };
const accountMatches = (pattern, code) => { const p = str(pattern); return p.endsWith('*') ? code.startsWith(p.slice(0, -1)) : p === code; };

/** Sum GL rows into pools. learned: [{ account, pool }] accepted memory facts. */
export function poolTotals(gl, cam, learned = []) {
  const pools = cam.pools.map((p) => ({ ...p, accounts: [...p.accounts], learned_accounts: [], total: 0, rows: 0 }));
  for (const f of learned) { const p = pools.find((x) => x.name === f.pool); if (p && !p.accounts.includes(f.account)) { p.accounts.push(f.account); p.learned_accounts.push(f.account); } }
  const excluded = new Map(); const unmapped = new Map(); let read = 0;
  for (const r of gl) {
    const code = acctCode(r.account); if (!code) continue;
    const amt = num(r.amount) ?? ((num(r.debit) || 0) - (num(r.credit) || 0));
    if (!amt) continue; read++;
    if ((cam.excluded_accounts || []).some((a) => accountMatches(a, code))) { const e = excluded.get(code) || { account: code, name: str(r.account_name) || str(r.account).replace(/^\S+\s*-?\s*/, ''), amount: 0 }; e.amount = r2(e.amount + amt); excluded.set(code, e); continue; }
    const pool = pools.find((p) => p.accounts.some((a) => accountMatches(a, code)));
    if (!pool) { const u = unmapped.get(code) || { account: code, name: str(r.account_name) || str(r.account).replace(/^\S+\s*-?\s*/, ''), amount: 0, rows: 0 }; u.amount = r2(u.amount + amt); u.rows++; unmapped.set(code, u); continue; }
    pool.total = r2(pool.total + amt); pool.rows++;
  }
  return { pools, excluded: [...excluded.values()], unmapped: [...unmapped.values()], rows_read: read };
}

const yearDays = (y) => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365);

/**
 * Reconcile every lease in force during cam.year.
 * billedRows: ledger rows (CAM charges billed as estimates); when none are given the lease's
 * monthly_estimate × months occupied is used and the item says so.
 */
export function reconcile({ leases, cam, gl, billedRows = null, learned = [] }) {
  const y = cam.year; const from = `${y}-01-01`, to = `${y}-12-31`; const days = yearDays(y);
  const pt = poolTotals(gl, cam, learned);
  const occ = cam.occupancy_pct ?? null; const target = cam.gross_up_to_pct ?? null;
  const pools = pt.pools.map((p) => ({ ...p, grossed: p.variable && occ !== null && target !== null ? grossUp(p.total, occ, target) : p.total }));
  const total = r2(pools.reduce((s, p) => s + p.total, 0));
  const priorYear = (cam.prior_years || []).find((p) => p.year === y - 1) || null;
  const items = [];
  for (const l of (leases.leases || [])) {
    const occDays = overlapDays(l.start, l.end, from, to); if (!occDays) continue;
    const c = l.cam || {}; const findings = [];
    const add = (code, detail, amount = null) => findings.push({ code, detail, ...(amount !== null ? { amount: r2(amount) } : {}) });
    const share = shareOf(l, cam.rentable_sqft);
    const frac = occDays / days;
    const base = { lease_id: l.lease_id, tenant: l.tenant, unit: l.unit, sqft: num(l.sqft), share_pct: share, occupied_days: occDays };
    if (share === null) { add('no_share', 'The lease has no share_pct and no sqft, so its share cannot be worked out.'); items.push({ ...base, status: 'review', findings, total_due: null, billed: null, balance: null }); continue; }
    const excludedPools = (c.excluded_pools || []);
    for (const ep of excludedPools) if (!pools.some((p) => p.name === ep)) add('unknown_excluded_pool', `The lease excludes "${ep}", which is not a pool in the CAM file; check the pool name.`);
    const lines = []; let gross = 0, controllable = 0, grossedUpBy = 0;
    for (const p of pools) {
      if (excludedPools.includes(p.name)) { if (p.total) add('pool_excluded', `${p.name} (${p.total}) is excluded by the lease.`); continue; }
      const basis = c.gross_up === false ? p.total : p.grossed;
      const amt = r2(basis * (share / 100) * frac);
      if (basis !== p.total) grossedUpBy += (basis - p.total) * (share / 100) * frac;
      lines.push({ pool: p.name, pool_total: p.total, basis: r2(basis), amount: amt, controllable: !!p.controllable });
      gross += amt; if (p.controllable) controllable += amt;
    }
    gross = r2(gross); controllable = r2(controllable);
    if (grossedUpBy > 0.005) add('gross_up_applied', `Variable pools grossed up from ${occ}% to ${target}% occupancy (+${r2(grossedUpBy)} for this tenant).`, grossedUpBy);
    let recoverable = gross;
    // Base year / expense stop: the tenant pays its share above the base-year amount.
    if (c.base_amount !== undefined) {
      const stop = r2(c.base_amount * (share / 100) * frac);
      recoverable = r2(Math.max(0, gross - stop));
      add('expense_stop', `Base year ${c.base_year ?? '?'}: tenant pays its share above ${c.base_amount} (its share of the stop is ${stop}).`, gross - recoverable);
    }
    // Cap on controllable expenses.
    let capReduction = 0;
    if (c.cap) {
      const prior = priorYear && priorYear.tenants ? priorYear.tenants[l.lease_id] : undefined;
      const limit = capLimit(c.cap, y, prior);
      if (limit === null) add('cap_needs_data', c.cap.type === 'noncumulative' ? `Non-cumulative ${c.cap.pct}% cap needs last year's capped charge for ${l.lease_id} in prior_years; the cap was not applied.` : 'The cap has no base_year and base_amount; the cap was not applied.');
      else {
        const lim = r2(limit * frac);
        if (controllable > lim) { capReduction = r2(controllable - lim); add('cap_applied', `Controllable share ${controllable} is over the ${c.cap.pct}% ${c.cap.type || 'cumulative'} cap (${lim}); reduced by ${capReduction}.`, capReduction); }
      }
    }
    recoverable = r2(recoverable - capReduction);
    const adminPct = c.admin_fee_pct ?? cam.admin_fee_pct ?? 0;
    const adminBase = cam.admin_fee_on_pools ? lines.filter((x) => cam.admin_fee_on_pools.includes(x.pool)).reduce((s, x) => s + x.amount, 0) * (gross ? recoverable / gross : 0) : recoverable;
    const admin = r2(adminBase * adminPct / 100);
    const totalDue = r2(recoverable + admin);
    // Estimates billed.
    let billed = 0, billedFrom = 'ledger'; const monthsBilled = new Set();
    if (billedRows) {
      for (const b of billedRows) {
        const d = isoDate(b.date); if (!d || d < from || d > to) continue;
        const mine = (b.lease_id && str(b.lease_id) === l.lease_id) || (!b.lease_id && sameUnit(b.unit, l.unit) && (!b.tenant || sameParty(b.tenant, l.tenant)));
        if (!mine) continue;
        const kind = chargeKind(b.charge_code || b.description);
        if (kind !== 'cam') continue;
        billed += num(b.charge) ?? num(b.amount) ?? 0; monthsBilled.add(d.slice(0, 7));
      }
      billed = r2(billed);
      const monthsOccupied = new Set(); for (let m = 1; m <= 12; m++) { const k = `${y}-${String(m).padStart(2, '0')}`; if (overlapDays(l.start, l.end, `${k}-01`, `${k}-28`)) monthsOccupied.add(k); }
      const gap = [...monthsOccupied].filter((k) => !monthsBilled.has(k));
      if (!billed) add('no_estimates_found', 'No CAM estimate charges were found for this lease in the ledger for the year.');
      else if (gap.length && c.monthly_estimate) add('estimate_months_missing', `No CAM estimate was billed for ${gap.join(', ')}; about ${r2(gap.length * c.monthly_estimate)} of the balance comes from months not billed. Check the recurring charge.`, gap.length * c.monthly_estimate);
    } else {
      const months = Math.round((occDays / days) * 12);
      billed = c.monthly_estimate ? r2(c.monthly_estimate * months) : 0; billedFrom = 'lease monthly_estimate';
      add('estimates_from_lease', `No ledger given: billed estimates taken as monthly_estimate × ${months} months.`);
    }
    const balance = r2(totalDue - billed);
    const review = findings.some((f) => ['cap_needs_data', 'no_estimates_found', 'unknown_excluded_pool'].includes(f.code));
    items.push({ ...base, status: review ? 'review' : 'ok', lines, gross_share: gross, controllable_share: controllable, cap_reduction: capReduction, admin_fee_pct: adminPct, admin_fee: admin, total_due: totalDue, billed, billed_from: billedFrom, balance, direction: balance > 0.005 ? 'tenant owes' : balance < -0.005 ? 'credit to tenant' : 'even', findings });
  }
  // Recovery: what share of the pools the tenants carry; the rest is the owner's (vacancy, caps, stops).
  const recovered = r2(items.reduce((s, i) => s + (i.total_due || 0) - (i.admin_fee || 0), 0));
  const property_findings = [];
  if (pt.unmapped.length) property_findings.push({ code: 'unmapped_accounts', detail: `${pt.unmapped.length} GL account(s) are in no pool and were left out: ${pt.unmapped.map((u) => `${u.account} ${u.name} (${u.amount})`).join(', ')}. Add them to a pool, exclude them, or teach marble with marble_learn.`, amount: r2(pt.unmapped.reduce((s, u) => s + u.amount, 0)) });
  const sharesTotal = r2(items.reduce((s, i) => s + (i.share_pct || 0), 0));
  if (sharesTotal > 100.005) property_findings.push({ code: 'shares_over_100', detail: `Tenant shares add up to ${sharesTotal}%, more than 100%.` });
  const summary = `${y} CAM for ${cam.property}: pools ${total} (${pools.length} pools), ${items.length} lease(s). Tenants owe ${r2(items.filter((i) => i.balance > 0).reduce((s, i) => s + i.balance, 0))}, credits ${r2(-items.filter((i) => i.balance < 0).reduce((s, i) => s + i.balance, 0))}. Recovered ${recovered} of ${total} (${total ? r2((recovered / total) * 100) : 0}%). ${items.filter((i) => i.status === 'review').length} need review.${pt.unmapped.length ? ` ${pt.unmapped.length} GL account(s) unmapped.` : ''}`;
  return { summary, year: y, property: cam.property, pools: pools.map((p) => ({ name: p.name, total: p.total, grossed_up: p.grossed, variable: !!p.variable, controllable: !!p.controllable, accounts: p.accounts, learned_accounts: p.learned_accounts })), pools_total: total, excluded: pt.excluded, unmapped: pt.unmapped, recovered, recovery_pct: total ? r2((recovered / total) * 100) : 0, shares_total_pct: sharesTotal, property_findings, items };
}

/** Text of one tenant's reconciliation statement (Markdown). */
export function statementText(it, r, a) {
  const L = [];
  L.push(`# ${r.year} operating expense reconciliation`, '', `**To:** ${a.to || '[TO CONFIRM: tenant notice address]'}`, `**Tenant:** ${it.tenant}  `, `**Premises:** ${it.unit}${it.sqft ? `, ${it.sqft} sq ft` : ''}  `, `**Lease:** ${it.lease_id}  `, `**Your share:** ${it.share_pct}%${it.occupied_days < 365 ? ` for ${it.occupied_days} days of occupancy` : ''}`, '');
  L.push('| Expense pool | Pool total | Basis | Your share |', '|---|---:|---:|---:|');
  for (const x of it.lines) L.push(`| ${x.pool} | ${x.pool_total} | ${x.basis} | ${x.amount} |`);
  L.push('');
  for (const f of it.findings.filter((f) => ['gross_up_applied', 'expense_stop', 'cap_applied', 'pool_excluded'].includes(f.code))) L.push(`- ${f.detail}`);
  L.push('', '| | Amount |', '|---|---:|', `| Your share after stops and caps | ${r2(it.total_due - it.admin_fee)} |`, `| Administrative fee (${it.admin_fee_pct}%) | ${it.admin_fee} |`, `| **Total for ${r.year}** | **${it.total_due}** |`, `| Estimates billed during ${r.year} | ${it.billed} |`, `| **${it.balance >= 0 ? 'Balance due from you' : 'Credit to you'}** | **${Math.abs(it.balance)}** |`, '');
  L.push(`Supporting detail is available on request under the audit terms of your lease. ${a.due_note || '[TO CONFIRM: payment or credit timing under the lease]'}`, '', a.from || '[TO CONFIRM: landlord or manager name]');
  if (it.status === 'review') L.push('', `[CHECK: ${it.findings.filter((f) => ['cap_needs_data', 'no_estimates_found', 'unknown_excluded_pool'].includes(f.code)).map((f) => f.detail).join(' ')}]`);
  return L.join('\n');
}
