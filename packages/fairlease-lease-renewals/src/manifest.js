import { defineManifest, MODEL_PIN, LEASES_SCHEMA, RENT_ROLL_FIELDS, RENT_ROLL_PROFILES, standardTools, draftPair, refusedTools, isoDate, sameUnit } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { checkRenewals, offerText, RENEWAL_POLICY_SCHEMA, OFFER_FIELDS } from './renewals.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/renewals';
const props = {
  leases: { type: 'string', description: 'Leases JSON (leases schema): unit, tenant, lease end and current monthly rent' },
  policy: { type: 'string', description: 'Renewal policy JSON (renewal_policy schema): max_increase_pct and notice_days are required (your own cap and notice period, from your policy or local rules); min_increase_pct, round_to, due_soon_days' },
  rent_roll: { type: 'string', description: 'Optional rent roll with market rents (any layout Fairlease reads). Without it no rent is proposed' },
  offers: { type: 'string', description: 'Optional offers already made: unit, tenant, offered on, offered rent, term, status (pending, accepted, declined, notice to vacate)' },
  as_of: { type: 'string', description: 'Date to work from, YYYY-MM-DD (default today)' },
  horizon_days: { type: 'integer', minimum: 7, maximum: 730, description: 'How far ahead to look for lease ends, in days (default 120)' },
};
const run = (a, ctx) => {
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  return checkRenewals({ leases: ctx.readJson(a.leases, 'leases'), policy: ctx.readJson(a.policy, 'renewal_policy'), marketRows: a.rent_roll ? ctx.records(a.rent_roll, 'rent_roll') : null, offers: a.offers ? ctx.records(a.offers, 'offers') : [], asOf, horizonDays: a.horizon_days ?? 120 });
};
const std = standardTools({
  prefix: 'renewals', outDir: OUT, props, required: ['leases', 'policy'], run,
  check: { title: 'List the renewal pipeline', description: 'Every lease ending within the horizon (and every month-to-month one): the offer deadline from your notice period, a proposed rent moving toward market but never above your cap, and the offer already made. Flags overdue offers, offers over your cap or sent after the deadline, declines and notices to vacate.' },
  explain: { arg: 'unit', argDoc: 'Unit, tenant or lease id from renewals_check', key: (i) => [i.unit, i.tenant, i.lease_id], title: 'Explain one renewal', description: 'Show one lease\'s end, deadline, rent, market rent, proposed rent and offer.',
    describe: (i) => `${i.tenant} (unit ${i.unit}): lease ends ${i.lease_end}${i.deadline ? `, offer deadline ${i.deadline}` : ''}, rent ${i.rent}, market ${i.market_rent ?? 'unknown'}, proposed ${i.proposed ?? 'none'}${i.increase_pct !== null ? ` (${i.increase_pct}%)` : ''}${i.offered_rent !== null ? `, offered ${i.offered_rent}` : ''}; ${i.stage.replace(/_/g, ' ')}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'renewals', description: 'Write the renewal worklist',
    title: { en: 'Renewal pipeline', de: 'Vertragsverlängerungen', fr: 'Renouvellements de baux', es: 'Renovaciones de contratos', pt: 'Renovações de contratos', it: 'Rinnovi dei contratti', ja: '更新予定一覧', zh: '续租计划', ko: '갱신 예정 목록' },
    row: (i) => ({ unit: i.unit, tenant: i.tenant, lease_end: i.lease_end, deadline: i.deadline, rent: i.rent, market_rent: i.market_rent, scheduled: i.proposed, amount: i.offered_rent, stage: i.stage, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['unit', 'tenant', 'lease_end', 'deadline', 'rent', 'market_rent', 'scheduled', 'amount', 'stage', 'status', 'findings', 'reasons'],
    htmlColumns: ['unit', 'tenant', 'lease_end', 'deadline', 'rent', 'market_rent', 'scheduled', 'stage', 'status', 'reasons'],
    limits: ['files', 'lease', 'advice', { en: 'The cap and notice period are the ones in your policy file. Fairlease Lease Renewals does not know rent control or notice law where you are; check them before any offer goes out.', de: 'Kappung und Frist stammen aus Ihrer Richtliniendatei. Fairlease Lease Renewals kennt keine örtlichen Mietpreis- oder Fristregeln; prüfen Sie diese vor jedem Angebot.', fr: 'Plafond et préavis viennent de votre fichier. Fairlease Lease Renewals ne connaît pas l’encadrement des loyers ni les délais légaux locaux ; vérifiez-les avant toute offre.', es: 'El tope y el plazo son los de su archivo. Fairlease Lease Renewals no conoce el control de rentas ni los plazos legales locales; revíselos antes de ofrecer.', pt: 'Teto e prazo vêm do seu arquivo. O Fairlease Lease Renewals não conhece regras locais de reajuste ou aviso; confira antes de ofertar.', it: 'Tetto e preavviso vengono dal vostro file. Fairlease Lease Renewals non conosce le regole locali su canoni e preavvisi; verificatele prima di ogni offerta.', ja: '上限と通知期間はポリシーファイルの値です。Fairlease Lease Renewals は地域の家賃規制や通知のルールを知りません。提示前に確認してください。', zh: '上限和通知期取自您的规则文件。Fairlease Lease Renewals 不了解当地租金管制或通知规定，发出报价前请核实。', ko: '상한과 통지 기간은 정책 파일의 값입니다. Fairlease Lease Renewals은 지역의 임대료 규제나 통지 규정을 알지 못하므로 제안 전에 확인하세요.' }] },
});
const pair = draftPair({
  prefix: 'renewals', noun: 'offer', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/offer-<unit>.md: a renewal offer letter at the proposed rent (or offer_rent, which must be within your cap). Marked DRAFT; open items are [TO CONFIRM]. Sending goes through renewals_request_send (one click).',
  required: ['leases', 'policy', 'unit'],
  args: { ...props, unit: { type: 'string', description: 'Unit from renewals_check' }, offer_rent: { type: 'number', minimum: 0, description: 'Rent to offer instead of the proposed one (refused above your cap)' }, term_months: { type: 'integer', minimum: 1, maximum: 60, description: 'Renewal term in months' }, reply_by: { type: 'string', description: 'Date the tenant should reply by' }, to: { type: 'string', description: 'Tenant email or address' }, from: { type: 'string', description: 'Manager name and contact for the signature' }, extra: { type: 'string', maxLength: 500, description: 'One extra sentence (for example a renewal incentive)' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const it = r.items.find((i) => String(i.unit) === String(a.unit).trim() && i.stage !== 'renewed') || r.items.find((i) => sameUnit(i.unit, a.unit) && i.stage !== 'renewed');
    if (!it) throw new Error(`no renewal for unit ${a.unit} in the next ${r.horizon_days} days`);
    if (it.stage === 'notice') throw new Error(`${it.tenant} gave notice to vacate; no offer`);
    const pol = ctx.readJson(a.policy, 'renewal_policy');
    if (a.offer_rent !== undefined && it.rent && a.offer_rent > it.rent * (1 + pol.max_increase_pct / 100) + 0.004) throw new Error(`offer_rent ${a.offer_rent} is above your ${pol.max_increase_pct}% cap (${Math.round(it.rent * (1 + pol.max_increase_pct / 100) * 100) / 100})`);
    return { id: it.unit, to: a.to, amount: a.offer_rent ?? it.proposed ?? undefined, text: offerText(it, a) };
  },
});
const refused = refusedTools([
  { name: 'pm_system_update', category: 'production_deploy', description: 'Fairlease Lease Renewals never changes rents or lease records in the property management system.' },
  { name: 'esign_send', category: 'binding_send', description: 'Fairlease Lease Renewals never sends a renewal lease for signature.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairlease Lease Renewals never sends offers; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-lease-renewals', version: pkg.version,
  description: 'Lists leases coming up for renewal with offer deadlines from your notice period, proposes rents toward market within your own increase cap, checks offers already made (over the cap, late, declined, notice to vacate) and drafts renewal offers. Sending and signing are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { leases: LEASES_SCHEMA, renewal_policy: RENEWAL_POLICY_SCHEMA },
  sources: {
    rent_roll: { label: 'Rent roll with market rents', args: ['rent_roll'], fields: RENT_ROLL_FIELDS, profiles: RENT_ROLL_PROFILES },
    offers: { label: 'Renewal offers', args: ['offers'], fields: OFFER_FIELDS, profiles: [] },
  },
  prompts: [{
    name: 'renewal_pipeline', title: 'Work the renewal pipeline',
    description: 'Walks the host model through the renewal pipeline with Fairlease Lease Renewals.',
    arguments: [{ name: 'leases', description: 'Leases JSON', required: true }, { name: 'policy', description: 'Renewal policy JSON', required: true }, { name: 'rent_roll', description: 'Rent roll with market rents', required: false }],
    text: `You are helping a property manager with lease renewals using fairlease-lease-renewals. Leases: {{leases}}. Policy: {{policy}}. Rent roll: {{rent_roll}}.

Rules: Fairlease Lease Renewals never changes rents, sends offers or sends leases for signature; pm_system_update, esign_send and email_send are blocked. The increase cap and notice period come only from the person's policy file; do not state local law.

1. Call renewals_check. Lead with overdue offers and offers over the cap, then those due soon. Give the monthly uplift from the proposed rents.
2. Call renewals_explain for units the person asks about.
3. Call renewals_write_report and share the paths.
4. Offer renewals_draft_offer per unit and show [TO CONFIRM] markers.
5. Only when the person asks, call renewals_request_send for a reviewed draft. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease Lease Renewals allowlist.' }] },
});
