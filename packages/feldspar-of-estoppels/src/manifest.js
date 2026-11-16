import { defineManifest, MODEL_PIN, LEASES_SCHEMA, INDEX_SCHEMA, ESTOPPEL_FIELDS, RENT_ROLL_FIELDS, RENT_ROLL_PROFILES, standardTools, draftPair, refusedTools, isoDate } from 'keystone-core';
import { readFileSync } from 'node:fs';
import { checkEstoppels, requestText, ESTOPPEL_POLICY_SCHEMA } from './estoppels.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/feldspar';
const props = {
  leases: { type: 'string', description: 'Leases JSON (leases schema): your lease abstracts, the record each estoppel is checked against' },
  estoppels: { type: 'string', description: 'Estoppel log (CSV, Excel or JSON), one row per returned certificate: lease or unit, tenant, rent, commencement, expiration, deposit, area, paid through, landlord defaults or claims, amendments, options, date signed. Local headers such as Miete, Einwendungen or Unterzeichnet am are read' },
  policy: { type: 'string', description: 'Optional estoppel policy JSON (estoppel_policy schema): closing date, max_age_days, required_pct of leased area, major_sqft, rent_tolerance' },
  rent_roll: { type: 'string', description: 'Optional rent roll, to show where the rent roll differs from the lease abstracts as well' },
  indexes: { type: 'string', description: 'Optional CPI-style index values JSON, needed only for leases whose rent escalates by CPI' },
  as_of: { type: 'string', description: 'Date to compute rent for and to decide which leases are in force, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => {
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  return checkEstoppels({ leases: ctx.readJson(a.leases, 'leases'), estoppels: ctx.records(a.estoppels, 'estoppels'), rentRoll: a.rent_roll ? ctx.records(a.rent_roll, 'rent_roll') : null, policy: a.policy ? ctx.readJson(a.policy, 'estoppel_policy') : {}, indexes: a.indexes ? ctx.readJson(a.indexes, 'indexes') : {}, asOf });
};
const std = standardTools({
  prefix: 'feldspar', outDir: OUT, props, required: ['leases', 'estoppels'], run,
  check: { title: 'Check estoppels', description: 'Every lease in force against the latest estoppel returned: not returned (major tenants first), unsigned or too old for closing, rent, commencement, expiration, deposit or area different from the abstract, landlord defaults or offsets claimed, amendments or options the lease file does not have, prepaid rent. Shows the share of leased area returned against your lender\'s requirement.' },
  explain: { arg: 'unit', argDoc: 'Unit, suite or lease ID from feldspar_check', key: (i) => [i.unit, i.lease_id, i.tenant], title: 'Explain one tenant', description: 'Show one tenant\'s estoppel against the lease abstract.',
    describe: (i) => `${i.unit} ${i.tenant} (lease ${i.lease_id}, ${i.sqft ?? '?'} sq ft${i.major ? ', major' : ''}): ${i.status.replace(/_/g, ' ')}. ${i.signed ? `Signed ${i.signed}. ` : ''}Rent per abstract ${i.expected_rent ?? 'not computable'}, per estoppel ${i.estoppel_rent ?? '-'}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'feldspar-estoppels', description: 'Write the estoppel tracker',
    title: { en: 'Tenant estoppels', de: 'Mieterbestätigungen', fr: 'Attestations des locataires', es: 'Certificados de los inquilinos', pt: 'Declarações dos locatários', it: 'Dichiarazioni dei conduttori', ja: 'テナント確認書', zh: '租户确认函', ko: '임차인 확인서' },
    row: (i) => ({ unit: i.unit, tenant: i.tenant, expected: i.expected_rent, actual: i.estoppel_rent, date: i.signed || '', status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['unit', 'tenant', 'expected', 'actual', 'date', 'status', 'findings', 'reasons'],
    htmlColumns: ['unit', 'tenant', 'expected', 'actual', 'date', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Feldspar compares the statements typed into your estoppel log with your lease abstracts. It does not read the signed certificates or the leases themselves; counsel reviews what a tenant\'s statement means for the deal.', de: 'Feldspar vergleicht die in Ihr Protokoll übertragenen Angaben mit Ihren Mietvertragsauszügen. Es liest weder die unterschriebenen Bestätigungen noch die Verträge selbst; was eine Angabe für die Transaktion bedeutet, prüft Ihre Rechtsberatung.', fr: 'Feldspar compare les déclarations saisies dans votre registre avec vos résumés de baux. Il ne lit ni les attestations signées ni les baux ; votre conseil apprécie la portée d’une déclaration pour l’opération.', es: 'Feldspar compara lo anotado en su registro con sus resúmenes de contratos. No lee los certificados firmados ni los contratos; su asesor legal valora qué significa cada declaración para la operación.', pt: 'O Feldspar compara o que foi registrado no seu controle com os resumos dos contratos. Não lê as declarações assinadas nem os contratos; seu advogado avalia o que cada declaração significa para a operação.', it: 'Feldspar confronta quanto riportato nel registro con gli estratti dei contratti. Non legge le dichiarazioni firmate né i contratti; il vostro legale valuta cosa significa ogni dichiarazione per l’operazione.', ja: 'Feldspar は確認書台帳に入力された内容を賃貸借契約の要約と照合します。署名済みの確認書や契約書そのものは読みません。取引上の意味は弁護士が判断します。', zh: 'Feldspar 将登记表中录入的陈述与租约摘要对照，不读取已签署的确认函或租约原文；其对交易的意义由律师判断。', ko: 'Feldspar는 대장에 입력된 진술을 임대차 요약과 대조합니다. 서명된 확인서나 계약서 자체는 읽지 않으며, 거래상의 의미는 변호사가 판단합니다.' }] },
});
const pair = draftPair({
  prefix: 'feldspar', noun: 'request', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/request-<unit>.md: a follow-up to a tenant to return, sign, re-date or correct their estoppel, listing each difference from the lease abstract. Marked DRAFT; deadline and purpose are [TO CONFIRM] unless given. Sending goes through feldspar_request_send (one click).',
  required: ['leases', 'estoppels', 'unit'],
  args: { ...props, unit: { type: 'string', description: 'Unit, suite or lease ID from feldspar_check' }, to: { type: 'string', description: 'Tenant notice address or email' }, reply_by: { type: 'string', description: 'Return-by date' }, purpose: { type: 'string', maxLength: 600, description: 'Purpose, for example the sale to a named buyer or a refinancing, and who may rely on the certificate' }, from: { type: 'string', description: 'Landlord name and contact' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const q = String(a.unit).trim().toLowerCase();
    const it = r.items.find((i) => [i.unit, i.lease_id].some((v) => String(v).toLowerCase() === q)) || r.items.find((i) => q.length >= 3 && `${i.unit} ${i.tenant}`.toLowerCase().includes(q));
    if (!it) throw new Error(`no lease in force for "${a.unit}"`);
    if (it.status === 'clean') throw new Error(`${it.unit} ${it.tenant}: the estoppel matches the lease abstract; nothing to follow up`);
    return { id: it.unit, to: a.to || undefined, text: requestText(it, a) };
  },
});
const refused = refusedTools([
  { name: 'esign_send', category: 'binding_send', description: 'Feldspar never sends a certificate for signature; a person does.' },
  { name: 'data_room_upload', category: 'binding_send', description: 'Feldspar never shares tenant files with a buyer, lender or data room.' },
  { name: 'pm_system_update', category: 'production_deploy', description: 'Feldspar never edits leases or the rent roll in your property management system.' },
  { name: 'email_send', category: 'binding_send', description: 'Feldspar never sends requests; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'feldspar-of-estoppels', version: pkg.version,
  description: 'Checks returned tenant estoppel certificates against your lease abstracts before a sale or refinancing: rent, dates, deposit, area, options, amendments and landlord defaults claimed. Tracks which are missing or too old for closing, and drafts follow-ups. Sending, signing and sharing with buyers are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { leases: LEASES_SCHEMA, indexes: INDEX_SCHEMA, estoppel_policy: ESTOPPEL_POLICY_SCHEMA },
  sources: {
    estoppels: { label: 'Estoppel log', args: ['estoppels'], fields: ESTOPPEL_FIELDS, profiles: [] },
    rent_roll: { label: 'Rent roll', args: ['rent_roll'], fields: RENT_ROLL_FIELDS, profiles: RENT_ROLL_PROFILES },
  },
  prompts: [{
    name: 'estoppel_review', title: 'Review tenant estoppels',
    description: 'Walks the host model through an estoppel review before closing with Feldspar.',
    arguments: [{ name: 'leases', description: 'Leases JSON', required: true }, { name: 'estoppels', description: 'Estoppel log', required: true }, { name: 'policy', description: 'Estoppel policy JSON', required: false }],
    text: `You are helping a landlord's team review tenant estoppels before a closing with feldspar-of-estoppels. Leases: {{leases}}. Estoppels: {{estoppels}}. Policy: {{policy}}.

Rules: Feldspar never sends, signs or shares documents; esign_send, data_room_upload, pm_system_update and email_send are blocked. Do not judge what a tenant's claim means legally; flag it for counsel.

1. Call feldspar_check. Lead with landlord defaults claimed and the share of area returned against the requirement, then rent, date and deposit discrepancies, then missing and stale certificates.
2. Call feldspar_explain for tenants the person asks about.
3. Call feldspar_write_report and share the paths.
4. Offer feldspar_draft_request per tenant; only when the person asks, call feldspar_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Feldspar allowlist.' }] },
});
