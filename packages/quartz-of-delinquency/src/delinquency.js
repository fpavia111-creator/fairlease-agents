// Delinquency worklist from an aging report or a tenant ledger. Pure functions.
import { r2, num, str, isoDate, addDays, daysBetween, monthKey, chargeKind, agingBucket, AGING_BUCKETS, sameUnit, sameParty, leaseFor, unitKey, partyKey } from 'keystone-core';

const REVERSAL = /returned|reversal|reversed|bounced|chargeback|rücklast|rückbuch|impayé|rejet|devuelto|devolvido|insoluto|不渡|退票|부도/i;
const FEE_WORD = /\bfee\b|gebühr|frais|cargo|taxa|手数料|费|수수료/i;

export const POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    grace_days: { type: 'integer', minimum: 0, maximum: 31 },
    due_day: { type: 'integer', minimum: 1, maximum: 28 },
    late_fee: { type: 'object', additionalProperties: false, properties: { type: { type: 'string', enum: ['flat', 'pct'] }, amount: { type: 'number', minimum: 0 }, pct: { type: 'number', minimum: 0, maximum: 100 }, max: { type: 'number', minimum: 0 } } },
    min_balance: { type: 'number', minimum: 0 },
    stages: { type: 'array', maxItems: 10, items: { type: 'object', additionalProperties: false, required: ['days', 'name'], properties: { days: { type: 'integer', minimum: 0, maximum: 3650 }, name: { type: 'string', pattern: '^[a-z_]{2,40}$' } } } },
    payment_plans: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['until'], properties: { unit: { type: 'string' }, tenant: { type: 'string' }, lease_id: { type: 'string' }, until: { type: 'string' }, note: { type: 'string', maxLength: 300 } } } },
  },
});
export const DEFAULT_STAGES = Object.freeze([{ days: 1, name: 'reminder' }, { days: 15, name: 'second_reminder' }, { days: 30, name: 'manager_review' }]);

const keyOf = (leases, r) => {
  const l = leases ? leaseFor(leases, { lease_id: str(r.lease_id) || undefined, unit: r.unit, tenant: r.tenant }) || (leases.leases || []).find((x) => (r.lease_id && x.lease_id === str(r.lease_id)) || (sameUnit(x.unit, r.unit) && (!r.tenant || sameParty(x.tenant, r.tenant)))) : null;
  // Without a lease to hang it on, "Apt 101 / AIKO TANAKA" and "101 / Aiko Tanaka" are still one tenant.
  return { key: l ? l.lease_id : `${unitKey(r.unit) || str(r.unit)}|${partyKey(r.tenant) || str(r.tenant)}`, lease: l };
};

/**
 * Age a tenant ledger: payments and credits are applied to the oldest open charges first.
 * Also returns the late fees charged and the rent payment dates per month, for policy checks.
 */
export function ageLedger(rows, { leases = null, asOf, aliases = {} }) {
  const by = new Map();
  for (const r of rows) {
    const d = isoDate(r.date); if (!d || d > asOf) continue;
    const { key, lease } = keyOf(leases, r);
    const t = by.get(key) || { key, lease, unit: lease ? lease.unit : str(r.unit), tenant: lease ? lease.tenant : str(r.tenant), charges: [], credits: [], fees: [], reversals: [], lastPayment: null };
    let kind = chargeKind(r.charge_code || r.description, aliases);
    const charge = num(r.charge); const paid = num(r.payment); const amt = num(r.amount);
    // A bounced payment: a negative payment, or a "returned payment" line in the charges column. It takes the payment back out,
    // so the rent it had covered is open again from its own due date. The NSF fee itself is a charge, but not a late fee.
    const text = `${str(r.charge_code)} ${str(r.description)}`; const bounce = REVERSAL.test(text) && !FEE_WORD.test(text);
    if (paid !== null && paid < 0) { t.reversals.push({ date: d, amount: r2(-paid) }); by.set(key, t); continue; }
    if (bounce && kind !== 'payment' && (charge ?? amt) > 0) { t.reversals.push({ date: d, amount: r2(charge ?? amt) }); by.set(key, t); continue; }
    if (bounce && kind === 'payment' && amt !== null && amt > 0 && paid === null && charge === null) { t.reversals.push({ date: d, amount: r2(amt) }); by.set(key, t); continue; }
    if (kind === 'late_fee' && /\bnsf\b/i.test(text)) kind = 'nsf_fee';
    const debit = charge ?? (amt !== null && amt > 0 && kind !== 'payment' ? amt : null);
    const credit = paid ?? (amt !== null && (amt < 0 || kind === 'payment') ? Math.abs(amt) : null);
    if (debit && debit > 0) { t.charges.push({ date: d, kind, amount: r2(debit), open: r2(debit) }); if (kind === 'late_fee') t.fees.push({ date: d, amount: r2(debit) }); }
    else if (debit && debit < 0) t.credits.push({ date: d, amount: r2(-debit), kind });
    if (credit && credit > 0) { t.credits.push({ date: d, amount: r2(credit), kind: 'payment' }); if (!t.lastPayment || d > t.lastPayment) t.lastPayment = d; }
    by.set(key, t);
  }
  const out = [];
  for (const t of by.values()) {
    t.charges.sort((a, b) => a.date.localeCompare(b.date)); t.credits.sort((a, b) => a.date.localeCompare(b.date));
    for (const rv of t.reversals) {
      // Take back the payment it reverses: the latest earlier payment of that amount, else the latest earlier payments up to the amount.
      const prior = t.credits.map((c, i) => ({ c, i })).filter(({ c }) => c.kind === 'payment' && c.date <= rv.date);
      const exact = prior.filter(({ c }) => Math.abs(c.amount - rv.amount) < 0.005).at(-1);
      if (exact) { t.credits.splice(exact.i, 1); continue; }
      let left = rv.amount; for (const { c } of prior.reverse()) { if (left <= 0.004) break; const use = Math.min(c.amount, left); c.amount = r2(c.amount - use); left = r2(left - use); }
      if (left > 0.004) t.charges.push({ date: rv.date, kind: 'returned_payment', amount: left, open: left });
    }
    t.credits = t.credits.filter((c) => c.amount > 0.004); t.charges.sort((a, b) => a.date.localeCompare(b.date));
    t.lastPayment = t.credits.filter((c) => c.kind === 'payment').map((c) => c.date).sort().at(-1) || null;
    const rentPaid = new Map(); // month -> date the month's rent was fully covered
    let pool = 0; let ci = 0;
    const credits = [...t.credits];
    for (const c of t.charges) {
      while (c.open > 0.004) {
        if (pool <= 0.004) { if (ci >= credits.length) break; pool += credits[ci].amount; c.coveredOn = credits[ci].date; ci++; continue; }
        const use = Math.min(pool, c.open); c.open = r2(c.open - use); pool = r2(pool - use);
        if (c.open <= 0.004) c.coveredOn = credits[ci - 1] ? credits[ci - 1].date : c.date;
      }
      if (c.kind === 'rent') rentPaid.set(monthKey(c.date), c.open <= 0.004 ? (c.coveredOn > c.date ? c.coveredOn : c.date) : null);
    }
    while (ci < credits.length) pool += credits[ci++].amount;
    const buckets = Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0]));
    const open = t.charges.filter((c) => c.open > 0.004).map((c) => ({ date: c.date, kind: c.kind, open: c.open, days: daysBetween(c.date, asOf) }));
    for (const c of open) { const b = agingBucket(c.days); buckets[b] = r2(buckets[b] + c.open); }
    const owed = r2(open.reduce((s, c) => s + c.open, 0));
    out.push({ key: t.key, lease: t.lease, unit: t.unit, tenant: t.tenant, balance: r2(owed - pool), buckets, open, oldest_days: open.length ? Math.max(...open.map((c) => c.days)) : 0, last_payment: t.lastPayment, fees: t.fees, rent_paid: rentPaid, charges: t.charges });
  }
  return out;
}

/** Tenants from an aging report (balance and bucket columns as exported). */
export function fromAging(rows, { leases = null }) {
  const out = [];
  for (const r of rows) {
    const bal = num(r.balance); if (bal === null) continue;
    const { key, lease } = keyOf(leases, r);
    const b = { current: 0, '1-30': r2(num(r.current) || 0), '31-60': r2(num(r.d30) || 0), '61-90': r2(num(r.d60) || 0), '90+': r2(num(r.d90) || 0) };
    const oldest = b['90+'] > 0 ? 91 : b['61-90'] > 0 ? 61 : b['31-60'] > 0 ? 31 : b['1-30'] > 0 ? 1 : 0;
    out.push({ key, lease, unit: lease ? lease.unit : str(r.unit), tenant: lease ? lease.tenant : str(r.tenant), balance: r2(bal), buckets: b, open: [], oldest_days: oldest, last_payment: isoDate(r.last_payment), status_text: str(r.status), in_collections: str(r.in_collections), deposit_held: num(r.deposit), fees: [], rent_paid: null, charges: [] });
  }
  return out;
}

// A plan belongs to the tenant it names: every field it gives has to fit (a plan for the last tenant of unit 101 is not the new tenant's).
const planFor = (policy, t) => (policy.payment_plans || []).find((p) => (p.lease_id || p.unit || p.tenant) && (!p.lease_id || (t.lease && p.lease_id === t.lease.lease_id)) && (!p.unit || sameUnit(p.unit, t.unit)) && (!p.tenant || sameParty(p.tenant, t.tenant)));

/** The delinquency worklist. Either `ledgerRows` or `agingRows`. */
export function checkDelinquency({ ledgerRows = null, agingRows = null, leases = null, policy = {}, asOf, aliases = {} }) {
  const tenants = ledgerRows ? ageLedger(ledgerRows, { leases, asOf, aliases }) : fromAging(agingRows || [], { leases });
  const stages = [...(policy.stages && policy.stages.length ? policy.stages : DEFAULT_STAGES)].sort((a, b) => a.days - b.days);
  const minBal = policy.min_balance ?? 0; const grace = policy.grace_days; const lf = policy.late_fee;
  const items = [];
  for (const t of tenants) {
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const deposit = t.lease ? num(t.lease.deposit) : t.deposit_held ?? null;
    const plan = planFor(policy, t); const onPlan = plan && isoDate(plan.until) >= asOf;
    // Late-fee checks need the ledger, a grace period and a fee rule from your policy.
    if (ledgerRows && grace !== undefined && lf) {
      const rentByMonth = new Map(t.charges.filter((c) => c.kind === 'rent').map((c) => [monthKey(c.date), c]));
      const monthly = t.lease && t.lease.rent ? num(t.lease.rent.monthly) : null;
      const cap = lf.type === 'pct' && monthly ? r2((monthly * (lf.pct || 0)) / 100) : lf.amount ?? null;
      const limits = [cap, lf.max].filter((v) => v !== null && v !== undefined); const max = limits.length ? Math.min(...limits) : null; // the lower of the two
      for (const f of t.fees) {
        const m = monthKey(f.date); const rc = rentByMonth.get(m); const lastGrace = rc ? addDays(rc.date, grace) : null;
        if (max !== null && f.amount > max + 0.004) add('late_fee_over_policy', `Late fee ${f.amount} on ${f.date} is above your policy's ${max}.`, { amount: r2(f.amount - max) });
        if (lastGrace && f.date <= lastGrace) add('late_fee_in_grace', `Late fee on ${f.date} was charged inside the ${grace}-day grace period (rent due ${rc.date}).`, { amount: f.amount });
        else if (lastGrace && t.rent_paid.get(m) && t.rent_paid.get(m) <= lastGrace) add('late_fee_in_grace', `Late fee on ${f.date}, but ${m} rent was paid on ${t.rent_paid.get(m)}, inside the grace period.`, { amount: f.amount });
      }
      const unfeed = [];
      for (const [m, rc] of rentByMonth) {
        const paid = t.rent_paid.get(m); const lastGrace = addDays(rc.date, grace);
        const late = (paid && paid > lastGrace) || (!paid && asOf > lastGrace);
        if (late && !t.fees.some((f) => monthKey(f.date) === m)) unfeed.push(paid ? `${m} (paid ${paid})` : `${m} (still open)`);
      }
      if (unfeed.length && !onPlan && !(t.balance > 0 && t.balance < minBal)) add('late_fee_not_charged', `Rent late after the ${grace}-day grace period with no late fee charged: ${unfeed.join(', ')}. Your policy charges one; a person decides whether to.`, { severity: 'note' });
    }
    let status;
    if (t.balance < -0.004) { status = 'credit'; add('credit_balance', `Credit balance of ${Math.abs(t.balance)} (prepaid or overpaid).`, { severity: 'note' }); }
    else if (t.balance <= 0.004) status = 'current';
    else if (t.balance < minBal) { status = 'below_minimum'; add('below_minimum', `Balance ${t.balance} is under your ${minBal} minimum; no action.`, { severity: 'note' }); }
    else status = 'delinquent';
    let stage = null;
    if (status === 'delinquent') {
      stage = (stages.filter((s) => s.days <= t.oldest_days).at(-1) || { name: 'not_yet_late' }).name;
      if (plan && !onPlan) add('payment_plan_ended', `The payment plan ended ${plan.until} and a balance of ${t.balance} remains; reminders are no longer paused.`, { severity: 'note' });
      if (onPlan) { stage = 'on_plan'; add('on_payment_plan', `On a payment plan until ${plan.until}${plan.note ? ` (${plan.note})` : ''}; reminders paused.`, { severity: 'note' }); }
      if (deposit !== null && t.balance > deposit) add('balance_over_deposit', `Balance ${t.balance} is more than the ${deposit} deposit held.`);
      if (t.buckets['61-90'] + t.buckets['90+'] > 0) add('over_60_days', `${r2(t.buckets['61-90'] + t.buckets['90+'])} is more than 60 days old.`);
    }
    if (t.lease && t.lease.end < asOf && !/month-to-month/i.test(t.lease.notes || '')) add('lease_ended', `Lease ended ${t.lease.end}; check whether the tenant has moved out (a former-tenant balance may need different handling).`, { severity: 'note' });
    if (/past|former|moved out|evict/i.test(t.status_text || '')) add('former_tenant', `Status "${t.status_text}" in the aging report.`, { severity: 'note' });
    if (t.in_collections && /^(y|yes|true|1)$/i.test(t.in_collections)) add('in_collections', 'Already marked as in collections; no reminder.', { severity: 'note' });
    const fixes = findings.filter((f) => ['late_fee_over_policy', 'late_fee_in_grace'].includes(f.code));
    items.push({
      lease_id: t.lease ? t.lease.lease_id : null, unit: t.unit, tenant: t.tenant, balance: t.balance, ...Object.fromEntries(AGING_BUCKETS.map((b) => [`b_${b}`, t.buckets[b]])),
      oldest_days: t.oldest_days, last_payment: t.last_payment, deposit, stage, status: fixes.length && status !== 'delinquent' ? 'issue' : status, fee_adjustment: r2(fixes.reduce((s, f) => s + (f.amount || 0), 0)), findings, open: t.open,
    });
  }
  const order = { delinquent: 0, issue: 1, below_minimum: 2, credit: 3, current: 4 };
  items.sort((a, b) => (order[a.status] - order[b.status]) || b.balance - a.balance);
  const del = items.filter((i) => i.status === 'delinquent');
  const total = r2(del.reduce((s, i) => s + i.balance, 0));
  const buckets = Object.fromEntries(AGING_BUCKETS.map((b) => [b, r2(del.reduce((s, i) => s + i[`b_${b}`], 0))]));
  const scheduled = leases ? r2((leases.leases || []).filter((l) => l.start <= asOf && l.end >= addDays(asOf, -31)).reduce((s, l) => s + (num(l.rent && l.rent.monthly) || 0), 0)) : null;
  const byStage = {}; for (const i of del) byStage[i.stage] = (byStage[i.stage] || 0) + 1;
  const feeIssues = items.filter((i) => i.findings.some((f) => ['late_fee_over_policy', 'late_fee_in_grace'].includes(f.code)));
  const summary = `${del.length} delinquent tenant(s) owe ${total} as of ${asOf}${scheduled ? ` (${r2((total / scheduled) * 100)}% of monthly scheduled rent ${scheduled})` : ''}; ${Object.entries(byStage).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`).join(', ') || 'none'}. Over 60 days: ${r2(buckets['61-90'] + buckets['90+'])}.${feeIssues.length ? ` Late fees to look at for ${feeIssues.length} tenant(s) (${r2(feeIssues.reduce((s, i) => s + i.fee_adjustment, 0))}).` : ''}`;
  return { summary, as_of: asOf, total_delinquent: total, buckets, scheduled_rent: scheduled, by_stage: byStage, stages, items };
}

/** A friendly payment reminder. It is not a legal notice and says so. */
export function reminderText(it, a = {}) {
  const fmt = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lines = it.open.length ? it.open.map((c) => `| ${c.date} | ${c.kind.replace(/_/g, ' ')} | ${fmt(c.open)} |`).join('\n') : `| | balance from the aging report | ${fmt(it.balance)} |`;
  return `**To:** ${a.to || '[TO CONFIRM: tenant email or address]'}
**Unit:** ${it.unit}

# Payment reminder

Dear ${it.tenant},

Our records show a balance of **${fmt(it.balance)}** on your account for unit ${it.unit} as of ${a.as_of}.

| Date | Charge | Open |
|---|---|---:|
${lines}

If you have already paid, thank you, and please ignore this message. If you cannot pay in full, please contact us to talk about options. ${a.pay_note || '[TO CONFIRM: how to pay]'}

This is a courtesy reminder, not a legal notice.

${a.from || '[TO CONFIRM: manager name and contact]'}
`;
}
