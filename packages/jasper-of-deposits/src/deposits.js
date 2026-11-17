// Security deposit disposition at move-out, against the buyer's own rules. Pure functions.
import { r2, num, str, isoDate, addDays, daysBetween, chargeKind, sameUnit, sameParty, leaseFor } from 'keystone-core';

const D = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
export const MOVE_OUTS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['rules', 'move_outs'],
  properties: {
    rules: { type: 'object', additionalProperties: false, required: ['return_days'], properties: {
      return_days: { type: 'integer', minimum: 1, maximum: 120 },
      interest_pct: { type: 'number', minimum: 0, maximum: 20 },
      deduct_unpaid_balance: { type: 'boolean' },
      require_evidence: { type: 'boolean' },
      due_soon_days: { type: 'integer', minimum: 0, maximum: 60 },
      wear_words: { type: 'array', maxItems: 100, items: { type: 'string', minLength: 2, maxLength: 60 } },
    } },
    move_outs: { type: 'array', minItems: 1, maxItems: 20000, items: { type: 'object', additionalProperties: false, required: ['unit', 'move_out'], properties: {
      unit: { type: 'string', minLength: 1 }, tenant: { type: 'string' }, lease_id: { type: 'string' }, move_out: D, move_in: D,
      deposit_held: { type: 'number', minimum: 0 }, forwarding_address: { type: 'string', maxLength: 300 }, returned_on: D, returned_amount: { type: 'number' }, notes: { type: 'string', maxLength: 2000 },
    } } },
  },
});

const DEFAULT_WEAR = ['nail holes', 'touch-up', 'touch up', 'faded', 'minor scuffs', 'normal wear', 'carpet wear', 'worn carpet', 'repaint entire', 'full repaint'];

/** Balance per move-out from a final ledger: charges up to the move-out date less payments and credits up to `asOf` (deposits ignored).
 * Charges posted after move-out are left out, since move-out charges belong in the deductions file. Negative means a credit balance. */
export function unpaidAt(rows, mo, aliases = {}, asOf = null) {
  let bal = 0;
  for (const r of rows || []) {
    if (!sameUnit(r.unit, mo.unit) || (r.tenant && mo.tenant && !sameParty(r.tenant, mo.tenant))) continue;
    const d = isoDate(r.date); if (!d) continue;
    const kind = chargeKind(r.charge_code || r.description, aliases); if (kind === 'deposit') continue;
    const amt = num(r.amount) || 0; const isPay = kind === 'payment';
    // One signed Amount column: a payment may be written as a positive number.
    const charge = (num(r.charge) || 0) + (isPay ? 0 : Math.max(0, amt)); const paid = (num(r.payment) || 0) + (isPay ? Math.abs(amt) : Math.max(0, -amt));
    if (d <= mo.move_out) bal += charge;
    if (d <= (asOf && asOf > mo.move_out ? asOf : mo.move_out)) bal -= paid;
  }
  return r2(bal);
}

export function checkDeposits({ config, deductions, leases = null, ledger = null, asOf, aliases = {} }) {
  const rules = config.rules; const wear = (rules.wear_words && rules.wear_words.length ? rules.wear_words : DEFAULT_WEAR).map((w) => w.toLowerCase());
  const soon = rules.due_soon_days ?? 7; const items = []; const used = new Set();
  // A deduction with no tenant name, in a unit with several move-outs, goes to the latest move-out only.
  const latest = new Map(); for (const m of config.move_outs) { const cur = config.move_outs.filter((x) => sameUnit(x.unit, m.unit)); latest.set(m, cur.length > 1 ? cur.reduce((a, b) => (b.move_out > a.move_out ? b : a)) : null); }
  for (const mo of config.move_outs) {
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const lease = leases ? leaseFor(leases, { lease_id: mo.lease_id, unit: mo.unit, tenant: mo.tenant, date: mo.move_out }) : null;
    const tenant = mo.tenant || (lease && lease.tenant) || '';
    const leaseDep = lease ? num(lease.deposit) : null;
    const deposit = mo.deposit_held ?? leaseDep;
    if (deposit === null || deposit === undefined) add('deposit_unknown', 'No deposit amount in the move-out file or the leases file.');
    else if (leaseDep !== null && mo.deposit_held !== undefined && Math.abs(leaseDep - mo.deposit_held) > 0.004) add('deposit_mismatch', `Deposit held ${mo.deposit_held} differs from the lease's ${leaseDep}.`);
    const moveIn = mo.move_in || (lease && lease.start) || null; const backwards = !!moveIn && moveIn > mo.move_out;
    if (backwards) add('dates_out_of_order', `Move-in ${moveIn} is after move-out ${mo.move_out}; check the dates.`);
    if (mo.returned_on && mo.returned_on < mo.move_out) add('dates_out_of_order', `Returned on ${mo.returned_on}, before the move-out date ${mo.move_out}; check the dates.`);
    const interest = rules.interest_pct && deposit && moveIn && !backwards ? r2((deposit * rules.interest_pct / 100) * (daysBetween(moveIn, mo.move_out) / 365)) : 0;
    if (rules.interest_pct && !moveIn) add('interest_unknown', 'Your rules pay interest but the move-in date is unknown.');
    const lines = []; let assumed = 0;
    deductions.forEach((d, i) => {
      if (!sameUnit(d.unit, mo.unit) || (d.tenant && tenant && !sameParty(d.tenant, tenant))) return;
      if (!str(d.tenant) && latest.get(mo)) { if (latest.get(mo) !== mo) return; assumed++; }
      used.add(i);
      const amount = num(d.amount); const item = str(d.item); const text = `${item} ${str(d.category)}`.toLowerCase();
      const line = { item, category: str(d.category), charged: amount, allowed: amount, evidence: str(d.evidence), notes: [] };
      if (amount === null) { line.allowed = null; line.notes.push('no amount'); }
      const age = num(d.age_years), life = num(d.useful_life_years);
      if (amount !== null && age !== null && life) { line.allowed = r2(amount * Math.max(0, 1 - age / life)); line.notes.push(`prorated for age ${age} of ${life} years`); }
      if (wear.some((w) => text.includes(w))) { line.wear = true; line.notes.push('may be normal wear and tear'); }
      if (rules.require_evidence !== false && !line.evidence) { line.no_evidence = true; line.notes.push('no photo, invoice or receipt'); }
      lines.push(line);
    });
    if (assumed) add('deduction_tenant_assumed', `${assumed} deduction line(s) for unit ${mo.unit} name no tenant and the unit has more than one move-out; they were put on this, the latest one. Confirm.`);
    const seen = new Map(); for (const l of lines) { const k = `${l.item.toLowerCase()}|${l.charged}`; seen.set(k, (seen.get(k) || 0) + 1); }
    const dups = [...seen].filter(([, n]) => n > 1);
    if (dups.length) add('duplicate_deduction', `Entered more than once with the same amount: ${dups.map(([k, n]) => `${k.split('|')[0]} (${n} times)`).join('; ')}. Both are counted until you remove one.`);
    const prorated = lines.filter((l) => l.allowed !== null && l.charged !== null && l.allowed < l.charged);
    if (prorated.length) add('useful_life_proration', `Prorated by useful life: ${prorated.map((l) => `${l.item} ${l.charged} → ${l.allowed}`).join('; ')}.`, { amount: r2(prorated.reduce((s, l) => s + l.charged - l.allowed, 0)) });
    const wearLines = lines.filter((l) => l.wear);
    if (wearLines.length) add('possible_normal_wear', `May be normal wear and tear (many rules do not let a deposit cover it): ${wearLines.map((l) => `${l.item} (${l.allowed})`).join('; ')}. A person decides.`, { amount: r2(wearLines.reduce((s, l) => s + (l.allowed || 0), 0)) });
    const noEv = lines.filter((l) => l.no_evidence);
    if (noEv.length) add('no_evidence', `No photo, invoice or receipt for: ${noEv.map((l) => l.item).join('; ')}.`);
    if (lines.some((l) => l.allowed === null)) add('amount_missing', 'A deduction has no amount.');
    const deducted = r2(lines.reduce((s, l) => s + (l.allowed || 0), 0));
    const bal = ledger ? unpaidAt(ledger, { ...mo, tenant }, aliases, asOf) : 0;
    const unpaid = rules.deduct_unpaid_balance !== false ? Math.max(0, bal) : 0; const credit = r2(Math.max(0, -bal));
    if (unpaid > 0) add('unpaid_balance', `Unpaid balance at move-out: ${unpaid}.`);
    if (credit > 0) add('credit_balance', `The ledger shows a credit balance of ${credit}; it is added to the refund.`);
    const refund = deposit === null || deposit === undefined ? null : r2(deposit + interest - deducted - unpaid + credit);
    if (refund !== null && refund < 0) add('tenant_owes', `Deductions exceed the deposit; the former tenant owes ${Math.abs(refund)}.`);
    const deadline = addDays(mo.move_out, rules.return_days); const left = daysBetween(asOf, deadline);
    if (!mo.forwarding_address && !mo.returned_on) add('no_forwarding_address', 'No forwarding address on file; the statement has nowhere to go.');
    if (mo.returned_on) {
      if (mo.returned_on > deadline) add('returned_late', `Statement or refund sent ${mo.returned_on}, ${daysBetween(deadline, mo.returned_on)} days after the ${deadline} deadline.`);
      if (mo.returned_amount !== undefined && refund !== null && Math.abs(mo.returned_amount - Math.max(0, refund)) > 0.004) add('refund_differs', `Refunded ${mo.returned_amount}; this check works out ${Math.max(0, refund)}.`);
    } else if (left < 0) add('deadline_passed', `The ${rules.return_days}-day deadline was ${deadline}, ${-left} days ago, and nothing is recorded as sent.`);
    else if (left <= soon) add('deadline_soon', `Deadline ${deadline}: ${left} day(s) left.`);
    const blocking = findings.filter((f) => !['useful_life_proration', 'deadline_soon', 'unpaid_balance', 'credit_balance', 'tenant_owes'].includes(f.code));
    const status = findings.some((f) => f.code === 'deadline_passed') ? 'overdue' : mo.returned_on && !blocking.length ? 'done' : blocking.length ? 'review' : 'ready';
    items.push({ unit: mo.unit, tenant, lease_id: lease ? lease.lease_id : mo.lease_id || null, move_out: mo.move_out, deadline: mo.returned_on ? null : deadline, days_left: mo.returned_on ? null : left, deposit, interest, charged: r2(lines.reduce((s, l) => s + (l.charged || 0), 0)), deducted, unpaid, credit, refund, status, forwarding_address: mo.forwarding_address || null, findings, lines });
  }
  const orphan = deductions.map((d, i) => ({ d, i })).filter(({ i }) => !used.has(i)).map(({ d }) => ({ unit: str(d.unit), tenant: str(d.tenant), item: str(d.item), amount: num(d.amount) }));
  const order = { overdue: 0, review: 1, ready: 2, done: 3 }; items.sort((a, b) => order[a.status] - order[b.status] || (a.days_left ?? 999) - (b.days_left ?? 999));
  const summary = `${items.length} move-out(s): ${items.filter((i) => i.status === 'overdue').length} past the deadline, ${items.filter((i) => i.status === 'review').length} to review, ${items.filter((i) => i.status === 'ready').length} ready. Deposits ${r2(items.reduce((s, i) => s + (i.deposit || 0), 0))}, deductions ${r2(items.reduce((s, i) => s + i.deducted, 0))} after proration, refunds ${r2(items.reduce((s, i) => s + Math.max(0, i.refund || 0), 0))}.${orphan.length ? ` ${orphan.length} deduction line(s) matched no move-out.` : ''}`;
  return { summary, as_of: asOf, return_days: rules.return_days, unmatched_deductions: orphan, items };
}

/** Itemised deposit statement for the former tenant. */
export function statementText(it, a = {}) {
  const fmt = (v) => (v === null || v === undefined ? '[TO CONFIRM]' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const rows = it.lines.map((l) => `| ${l.item} | ${fmt(l.allowed)} | ${l.evidence || '[TO CONFIRM: photo or invoice]'} |${l.wear ? ' [TO CONFIRM: wear and tear?]' : ''}`).join('\n') || '| No deductions | 0.00 | |';
  return `**To:** ${a.to || it.forwarding_address || '[TO CONFIRM: forwarding address]'}

# Security deposit statement

Former tenant: ${it.tenant}
Unit: ${it.unit}
Move-out date: ${it.move_out}

| Deduction | Amount | Support |
|---|---:|---|
${rows}

- Deposit held: ${fmt(it.deposit)}${it.interest ? `\n- Interest: ${fmt(it.interest)}` : ''}
- Deductions: ${fmt(it.deducted)}${it.unpaid ? `\n- Unpaid balance at move-out: ${fmt(it.unpaid)}` : ''}${it.credit ? `\n- Credit balance on your account: ${fmt(it.credit)}` : ''}
- ${it.refund === null ? 'Refund: [TO CONFIRM]' : it.refund >= 0 ? `Refund to you: ${fmt(it.refund)}` : `Amount you owe: ${fmt(-it.refund)}`}

${a.payment_note || '[TO CONFIRM: how and when the refund is paid, or how to pay the balance]'}

Copies of photos and invoices are available on request.

${a.from || '[TO CONFIRM: manager name and contact]'}
`;
}
