// Short-term rental payout reconciliation: channel payout lines against reservations and bank deposits. Pure functions.
import { r2, num, str, isoDate, addDays, daysBetween, foldText } from 'keystone-core';

export const STR_POLICY_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  properties: {
    channels: { type: 'object', maxProperties: 30, additionalProperties: { type: 'object', additionalProperties: false, properties: {
      fee_pct: { type: 'number', minimum: 0, maximum: 50 },
      fee_base: { type: 'string', enum: ['gross', 'gross_plus_cleaning'] },
      payout_lag_days: { type: 'integer', minimum: 0, maximum: 90 },
      words: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 2, maxLength: 60 } },
    } } },
    listings: { type: 'object', maxProperties: 5000, additionalProperties: { type: 'object', additionalProperties: false, properties: {
      cleaning_fee: { type: 'number', minimum: 0 },
      aliases: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 200 } },
    } } },
    bank_lag_days: { type: 'integer', minimum: 0, maximum: 30 },
    tolerance: { type: 'number', minimum: 0, maximum: 1000 },
    fee_tolerance_pct: { type: 'number', minimum: 0, maximum: 20 },
  },
});

const fold = (s) => foldText(str(s)).toLowerCase();
const CHANNEL_WORDS = { airbnb: ['airbnb'], vrbo: ['vrbo', 'homeaway', 'abritel', 'fewo direkt', 'fewo-direkt', 'stayz', 'bookabach'], booking: ['booking com', 'booking.com', 'bookingcom'], expedia: ['expedia', 'hotels com'], direct: ['direct', 'website', 'owner booked', 'directa', 'direkt'] };
const CANCEL = /cancel|storn|annul|cancelad|cancelad|annull|キャンセル|取消|취소/;
const RES_TYPES = /^(reservation|booking|stay|reserva|buchung|réservation|reservation|prenotazione|予約|预订|예약|)$/;

export function channelOf(text, policy = {}) {
  const t = ` ${fold(text).replace(/[^a-z0-9.぀-鿿가-힯]+/g, ' ')} `;
  for (const [k, c] of Object.entries(policy.channels || {})) if ((c.words || [k]).some((w) => t.includes(fold(w)))) return k;
  for (const [k, ws] of Object.entries(CHANNEL_WORDS)) if (ws.some((w) => t.includes(w))) return k;
  return null;
}

/** Canonical listing name: policy aliases, then learned aliases, then the name as given. */
export function listingName(name, policy = {}, learned = {}) {
  const n = fold(name); if (!n) return '';
  for (const [k, l] of Object.entries(policy.listings || {})) if (fold(k) === n || (l.aliases || []).some((a) => fold(a) === n)) return k;
  for (const [a, k] of Object.entries(learned)) if (fold(a) === n) return k;
  return str(name);
}

/** Splits channel rows into per-booking lines and transfer (payout) rows. */
export function readPayoutFile(rows, channel, policy = {}, learned = {}) {
  const lines = []; const transfers = [];
  for (const r of rows) {
    const id = str(r.booking_id); const type = fold(r.type);
    const paidOut = num(r.paid_out); const amount = num(r.amount);
    const ch = channel || channelOf(r.channel, policy) || 'unknown';
    if (!id && (/payout|auszahlung|versement|pago|repasse|accredito|支払|打款|지급/.test(type) || (paidOut !== null && amount === null))) { const d = isoDate(r.payout_date); const amt = paidOut ?? amount; if (d && amt !== null) transfers.push({ channel: ch, date: d, amount: amt, explicit: true }); continue; }
    if (!id) continue;
    const fee = num(r.service_fee); const cleaning = num(r.cleaning_fee); let gross = num(r.gross);
    // Some channels (Airbnb's "Gross earnings") include cleaning in gross: gross = net + fee.
    if (gross !== null && cleaning && amount !== null && fee !== null && Math.abs(gross - (amount + Math.abs(fee))) < 0.02) gross = r2(gross - cleaning);
    lines.push({ channel: ch, booking_id: id, type: str(r.type) || 'Reservation', reservation: RES_TYPES.test(type), listing: listingName(r.listing, policy, learned), guest: str(r.guest), check_in: isoDate(r.check_in), check_out: isoDate(r.check_out), nights: num(r.nights), gross, cleaning, fee, taxes: num(r.taxes), amount: amount ?? paidOut, payout_date: isoDate(r.payout_date) });
  }
  // Channels that list no payout rows pay per reservation: group lines by payout date.
  const explicit = new Set(transfers.map((t) => t.channel));
  const byDate = new Map();
  for (const l of lines) if (!explicit.has(l.channel) && l.payout_date && l.amount !== null) { const k = `${l.channel}|${l.payout_date}`; byDate.set(k, r2((byDate.get(k) || 0) + l.amount)); }
  for (const [k, amt] of byDate) { const [ch, d] = k.split('|'); transfers.push({ channel: ch, date: d, amount: amt, explicit: false }); }
  return { lines, transfers };
}

export function reconcilePayouts({ payoutFiles, bookings = null, bank = null, policy = {}, asOf, learned = {} }) {
  const tol = policy.tolerance ?? 1; const feeTol = policy.fee_tolerance_pct ?? 0.5; const bankLag = policy.bank_lag_days ?? 5;
  const lines = []; const transfers = [];
  for (const f of payoutFiles) { const r = readPayoutFile(f.rows, f.channel, policy, learned); lines.push(...r.lines); transfers.push(...r.transfers); }
  const res = new Map();
  for (const b of bookings || []) {
    const id = str(b.booking_id); if (!id) continue;
    res.set(id, { booking_id: id, channel: channelOf(`${str(b.channel)} ${id}`, policy) || 'unknown', listing: listingName(b.listing, policy, learned), guest: str(b.guest), check_in: isoDate(b.check_in), check_out: isoDate(b.check_out), nights: num(b.nights), gross: num(b.gross), cleaning: num(b.cleaning_fee), expected: num(b.amount), cancelled: CANCEL.test(fold(b.type)) || CANCEL.test(fold(b.status)) });
  }
  const ids = [...new Set([...res.keys(), ...lines.map((l) => l.booking_id)])];
  const items = [];
  for (const id of ids) {
    const b = res.get(id) || null; const ls = lines.filter((l) => l.booking_id === id);
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const resLines = ls.filter((l) => l.reservation); const first = resLines[0] || ls[0] || null;
    const channel = (first && first.channel !== 'unknown' ? first.channel : null) || (b && b.channel) || 'unknown';
    const ch = (policy.channels || {})[channel] || {};
    const listing = (b && b.listing) || (first && first.listing) || '';
    const checkIn = (b && b.check_in) || (first && first.check_in) || null;
    const checkOut = (b && b.check_out) || (first && first.check_out) || null;
    const paid = ls.length ? r2(ls.reduce((s, l) => s + (l.amount || 0), 0)) : 0;
    const cancelled = !!(b && b.cancelled);
    let expected = b && b.expected !== null ? b.expected : null;
    const source = expected !== null ? 'your reservation expects' : 'your rates work out';
    const gross = (b && b.gross) ?? (first && first.gross); const cleaning = (b && b.cleaning) ?? (first && first.cleaning);
    if (expected === null && ch.fee_pct !== undefined && gross !== null && gross !== undefined && !cancelled) { const base = gross + (ch.fee_base === 'gross' ? 0 : cleaning || 0); expected = r2(gross + (cleaning || 0) - (base * ch.fee_pct) / 100); }
    const lag = ch.payout_lag_days ?? 3;
    if (!b && bookings) add('not_in_reservations', `Paid ${paid} by ${channel} for a booking that is not in your reservations file.`);
    if (!ls.length) {
      if (cancelled) { /* nothing expected */ } else if (checkIn && addDays(checkIn, lag) < asOf) add('missing_payout', `Checked in ${checkIn}; no ${channel} payout line after ${lag} day(s).${expected !== null ? ` Expected about ${expected}.` : ''}`, { amount: expected });
    } else {
      if (cancelled && paid > tol) add('paid_while_cancelled', `Reservation is cancelled but ${paid} was paid; check whether it is a cancellation fee you keep.`, { amount: paid });
      if (!cancelled && expected !== null && Math.abs(paid - expected) > tol) add(paid < expected ? 'payout_short' : 'payout_over', `Paid ${paid}; ${source} ${expected} (${paid < expected ? 'short' : 'over'} ${r2(Math.abs(paid - expected))}).`, { amount: r2(paid - expected) });
      if (resLines.length > 1) {
        const same = resLines.filter((l) => Math.abs((l.amount || 0) - (resLines[0].amount || 0)) < 0.005);
        if (same.length > 1) add('duplicate_payout', `${same.length} reservation lines for this booking with the same amount ${resLines[0].amount}${same.map((l) => l.payout_date).filter(Boolean).length ? ` (${same.map((l) => l.payout_date).join(', ')})` : ''}.`, { amount: r2((same.length - 1) * (resLines[0].amount || 0)) });
      }
      for (const l of resLines.slice(0, 1)) {
        if (ch.fee_pct !== undefined && l.fee !== null && l.gross) {
          const base = l.gross + (ch.fee_base === 'gross' ? 0 : l.cleaning || 0); const rate = r2((Math.abs(l.fee) / base) * 100);
          if (Math.abs(rate - ch.fee_pct) > feeTol) add('fee_rate_differs', `${channel} fee ${Math.abs(l.fee)} is ${rate}% of ${ch.fee_base === 'gross' ? 'the stay' : 'stay plus cleaning'} (${base}); your rate is ${ch.fee_pct}%.`, { amount: r2(Math.abs(l.fee) - (base * ch.fee_pct) / 100) });
        }
        const lp = (policy.listings || {})[listing];
        if (lp && lp.cleaning_fee !== undefined && l.cleaning !== null && Math.abs(l.cleaning - lp.cleaning_fee) > tol) add('cleaning_fee_differs', `Cleaning fee ${l.cleaning}; your rate for ${listing} is ${lp.cleaning_fee}.`, { amount: r2(l.cleaning - lp.cleaning_fee) });
        if (b) {
          const bn = b.nights ?? (b.check_in && b.check_out ? daysBetween(b.check_in, b.check_out) : null);
          const ln = l.nights ?? (l.check_in && l.check_out ? daysBetween(l.check_in, l.check_out) : null);
          if (bn !== null && ln !== null && bn !== ln) add('nights_differ', `${channel} pays for ${ln} night(s); your reservation has ${bn}.`);
          if (b.check_in && l.check_in && b.check_in !== l.check_in) add('dates_differ', `${channel} check-in ${l.check_in}; your reservation ${b.check_in}.`);
        }
      }
    }
    const issue = findings.length > 0;
    const status = findings.some((f) => f.code === 'missing_payout') ? 'missing' : issue ? 'issue' : !ls.length ? (cancelled ? 'cancelled' : 'pending') : 'ok';
    items.push({ kind: 'booking', id, booking_id: id, channel, listing, guest: (b && b.guest) || (first && first.guest) || '', check_in: checkIn, check_out: checkOut, expected, paid, amount: expected === null ? paid : r2(paid - expected), lines: ls.length, payout_dates: [...new Set(ls.map((l) => l.payout_date).filter(Boolean))], status, findings });
  }
  // Transfers against bank deposits.
  const deposits = bank ? bank.map((r, i) => { const credit = num(r.credit); const amt = num(r.amount); const debit = num(r.debit); const v = credit ?? (amt !== null ? amt : debit !== null ? -debit : null); return { i, date: isoDate(r.date), amount: v, description: str(r.description), used: false }; }).filter((d) => d.date && d.amount !== null && d.amount > 0) : null;
  if (deposits) {
    for (const t of transfers.sort((a, b) => a.date.localeCompare(b.date))) {
      const findings = [];
      const hit = deposits.find((d) => !d.used && Math.abs(d.amount - t.amount) <= Math.max(0.01, tol / 10) && d.date >= t.date && d.date <= addDays(t.date, bankLag));
      if (hit) hit.used = true;
      else if (addDays(t.date, bankLag) < asOf) findings.push({ code: 'not_in_bank', detail: `${t.channel} payout of ${t.amount} on ${t.date} has no matching bank deposit within ${bankLag} day(s).`, amount: t.amount });
      items.push({ kind: 'transfer', id: `${t.channel} ${t.date} ${t.amount}`, channel: t.channel, date: t.date, amount: t.amount, bank_date: hit ? hit.date : null, status: hit ? 'ok' : findings.length ? 'missing' : 'pending', findings });
    }
    for (const d of deposits.filter((x) => !x.used && channelOf(x.description, policy))) {
      items.push({ kind: 'deposit', id: `bank ${d.date} ${d.amount}`, channel: channelOf(d.description, policy), date: d.date, amount: d.amount, description: d.description, status: 'issue', findings: [{ code: 'deposit_without_payout', detail: `Bank deposit ${d.amount} on ${d.date} ("${d.description}") matches no payout in the channel files.`, amount: d.amount }] });
    }
  }
  const order = { missing: 0, issue: 1, pending: 2, cancelled: 3, ok: 4 };
  items.sort((a, b) => order[a.status] - order[b.status] || (a.kind === b.kind ? 0 : a.kind === 'booking' ? -1 : 1) || String(a.check_in || a.date).localeCompare(String(b.check_in || b.date)));
  const bk = items.filter((i) => i.kind === 'booking'); const tr = items.filter((i) => i.kind === 'transfer');
  const n = (l, s) => l.filter((i) => i.status === s).length;
  const short = r2(bk.flatMap((i) => i.findings).filter((f) => ['payout_short', 'missing_payout'].includes(f.code)).reduce((s, f) => s + Math.abs(f.amount || 0), 0));
  const summary = `${bk.length} booking(s) across ${[...new Set(bk.map((i) => i.channel))].join(', ') || 'no channel'}: ${n(bk, 'ok')} paid as expected, ${n(bk, 'missing')} missing a payout, ${n(bk, 'issue')} with differences, ${n(bk, 'pending')} not yet due. Short or missing: ${short}.${deposits ? ` ${tr.length} payout(s) against the bank: ${n(tr, 'ok')} matched, ${n(tr, 'missing')} not found${items.some((i) => i.kind === 'deposit') ? `, ${items.filter((i) => i.kind === 'deposit').length} channel deposit(s) with no payout` : ''}.` : ' No bank file, so payouts are not matched to deposits.'}`;
  return { summary, as_of: asOf, short_or_missing: short, items };
}

/** Inquiry to a channel's host support about one booking's payout. */
export function inquiryText(it, a = {}) {
  const lines = it.findings.map((f) => `- ${f.detail}`).join('\n');
  return `**To:** ${a.to || `[TO CONFIRM: ${it.channel} host support or account manager]`}

# Payout inquiry: ${it.booking_id}

Listing: ${it.listing || '[TO CONFIRM]'}
Guest: ${it.guest || '[TO CONFIRM]'}
Stay: ${it.check_in || '?'} to ${it.check_out || '?'}
Host account: ${a.account || '[TO CONFIRM: host account or ID]'}

Our records show:

${lines}

Could you confirm the payout for this reservation${it.expected !== null ? ` (we expected ${it.expected})` : ''} and send a breakdown of any adjustment or fee?

Thank you,

${a.from || '[TO CONFIRM: your name and contact]'}
`;
}
