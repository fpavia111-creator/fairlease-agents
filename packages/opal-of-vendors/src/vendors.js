// Vendor compliance against the buyer's requirements, and payments made while out of compliance. Pure functions.
import { r2, num, str, isoDate, addDays, daysBetween, maskId, sameParty } from 'keystone-core';

const REQ = { type: 'object', additionalProperties: false, properties: { gl: { type: 'boolean' }, wc: { type: 'boolean' }, auto: { type: 'boolean' }, license: { type: 'boolean' }, tax_id: { type: 'boolean' }, w9: { type: 'boolean' } } };
export const REQUIREMENTS_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false, required: ['default'],
  properties: {
    warn_days: { type: 'integer', minimum: 0, maximum: 365 },
    default: REQ,
    trades: { type: 'object', additionalProperties: REQ },
    exempt: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string', enum: ['gl', 'wc', 'auto', 'license', 'tax_id', 'w9'] } } },
  },
});
const LABEL = { gl: 'liability insurance', wc: "workers' comp", auto: 'auto insurance', license: 'licence' };
const yes = (v) => /^(y|yes|true|1|x|on file|received|ja|oui|sí|si|sim|はい|是|예)$/i.test(str(v));

export function checkVendors({ rows, req, payments = null, asOf }) {
  const warn = req.warn_days ?? 30; const items = [];
  for (const r of rows) {
    const vendor = str(r.vendor); if (!vendor) continue;
    const trade = str(r.trade);
    const tradeReq = Object.entries(req.trades || {}).find(([t]) => trade.toLowerCase().includes(t.toLowerCase()));
    const need = { ...req.default, ...(tradeReq ? tradeReq[1] : {}) };
    const exempt = new Set(Object.entries(req.exempt || {}).find(([v]) => sameParty(v, vendor))?.[1] || []);
    const findings = []; const add = (code, detail, extra = {}) => findings.push({ code, detail, ...extra });
    const lapses = [];
    for (const k of ['gl', 'wc', 'auto', 'license']) {
      if (!need[k] || exempt.has(k)) continue;
      const exp = isoDate(r[`${k === 'license' ? 'license' : k}_expires`]);
      if (!exp) { add(`${k}_missing`, `No ${LABEL[k]} expiry date on file; your requirements need it.`); lapses.push({ k, from: '0000-01-01' }); continue; }
      const left = daysBetween(asOf, exp);
      if (left < 0) { add(`${k}_expired`, `${LABEL[k][0].toUpperCase() + LABEL[k].slice(1)} expired ${exp} (${-left} days ago).`); lapses.push({ k, from: addDays(exp, 1) }); }
      else if (left <= warn) add(`${k}_expiring`, `${LABEL[k][0].toUpperCase() + LABEL[k].slice(1)} expires ${exp} (${left} days).`, { severity: 'soon' });
    }
    if (need.tax_id && !exempt.has('tax_id') && !str(r.tax_id)) add('tax_id_missing', 'No tax ID on file.');
    if (need.w9 && !exempt.has('w9') && r.w9_on_file !== undefined && !yes(r.w9_on_file)) add('w9_missing', 'W-9 (or your tax form) not marked as on file.');
    let paid = 0; const late = [];
    if (payments) for (const p of payments) {
      if (!sameParty(p.payee, vendor)) continue; const d = isoDate(p.date); const amt = num(p.amount); if (!d || amt === null) continue;
      const lapse = lapses.filter((l) => d >= l.from);
      if (lapse.length) { paid = r2(paid + amt); late.push(`${d} ${amt}${p.reference ? ` (${str(p.reference)})` : ''}`); }
    }
    if (late.length) add('paid_while_noncompliant', `Paid ${paid} while out of compliance: ${late.join(', ')}.`, { amount: paid });
    const hard = findings.filter((f) => f.severity !== 'soon');
    items.push({ vendor, trade, tax_id: str(r.tax_id) ? maskId(r.tax_id) : '', email: str(r.email), gl_expires: isoDate(r.gl_expires), wc_expires: isoDate(r.wc_expires), license_expires: isoDate(r.license_expires), status: hard.length ? 'issue' : findings.length ? 'due_soon' : 'ok', paid_while_noncompliant: paid, findings });
  }
  items.sort((a, b) => ({ issue: 0, due_soon: 1, ok: 2 }[a.status] - { issue: 0, due_soon: 1, ok: 2 }[b.status]) || a.vendor.localeCompare(b.vendor));
  const summary = `${items.length} vendor(s) as of ${asOf}: ${items.filter((i) => i.status === 'issue').length} out of compliance, ${items.filter((i) => i.findings.some((f) => f.severity === 'soon')).length} with something expiring within ${warn} days.${payments ? ` Paid ${r2(items.reduce((s, i) => s + i.paid_while_noncompliant, 0))} to vendors while out of compliance.` : ''}`;
  return { summary, as_of: asOf, items };
}

export function requestText(it, a = {}) {
  const need = it.findings.filter((f) => /_(expired|expiring|missing)$/.test(f.code)).map((f) => `- ${f.detail}`);
  return `**To:** ${a.to || it.email || '[TO CONFIRM: vendor email]'}

# Request for updated documents

Hello ${it.vendor},

To keep you active as a vendor${a.company ? ` for ${a.company}` : ''}, please send us the following:

${need.join('\n') || '- [TO CONFIRM: what is needed]'}

${a.holder_note || '[TO CONFIRM: certificate holder and additional insured wording from your requirements]'}

Please reply by ${a.reply_by || '[TO CONFIRM: date]'}. Thank you.

${a.from || '[TO CONFIRM: name and contact]'}
`;
}
