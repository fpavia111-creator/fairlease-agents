import { defineManifest, MODEL_PIN, LEASES_SCHEMA, TENANT_INSURANCE_FIELDS, standardTools, draftPair, refusedTools, isoDate } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { checkInsurance, requestText } from './insurance.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/coi';
const props = {
  leases: { type: 'string', description: 'Leases JSON (leases schema). Each lease\'s insurance block sets what the tenant must carry: gl_per_occurrence, gl_aggregate, renters_liability, additional_insured' },
  certificates: { type: 'string', description: 'Tenant certificates of insurance (CSV, Excel or JSON): lease or unit, tenant, insurer, policy, liability per occurrence, aggregate, additional insured, expiration date. Local headers such as Aseguradora, Responsabilidad or Vencimiento are read' },
  as_of: { type: 'string', description: 'Date to judge expiry against, YYYY-MM-DD (default today)' },
  warn_days: { type: 'integer', minimum: 0, maximum: 180, description: 'Flag certificates expiring within this many days (default 30)' },
};
const run = (a, ctx) => {
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  return checkInsurance({ leases: ctx.readJson(a.leases, 'leases'), certs: ctx.records(a.certificates, 'certificates'), asOf, warnDays: a.warn_days ?? 30 });
};
const std = standardTools({
  prefix: 'coi', outDir: OUT, props, required: ['leases', 'certificates'], run,
  check: { title: 'Check tenant insurance', description: 'Every lease in force against its own insurance clause: certificate missing, expired, expiring within warn_days, liability or aggregate below the lease, landlord not named as additional insured. Lists certificates that match no lease in force.' },
  explain: { arg: 'unit', argDoc: 'Unit, suite or lease ID from coi_check', key: (i) => [i.unit, i.lease_id, i.tenant], title: 'Explain one tenant', description: 'Show one lease\'s requirement, the certificate on file and each finding.',
    describe: (i) => `${i.unit} ${i.tenant} (lease ${i.lease_id}): ${i.status.replace(/_/g, ' ')}. Requires ${i.required || 'nothing'}; on file ${i.insurer || 'no certificate'}${i.expires ? `, expires ${i.expires}` : ''}${i.liability !== null && i.liability !== undefined ? `, liability ${i.liability}` : ''}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'coi-insurance', description: 'Write the tenant insurance worklist',
    title: { en: 'Tenant insurance', de: 'Versicherungsnachweise der Mieter', fr: 'Assurances des locataires', es: 'Seguros de inquilinos', pt: 'Seguros dos inquilinos', it: 'Assicurazioni dei conduttori', ja: 'テナントの保険', zh: '租户保险', ko: '임차인 보험' },
    row: (i) => ({ unit: i.unit, tenant: i.tenant, required: i.required, expires: i.expires || '', amount: i.liability, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['unit', 'tenant', 'required', 'expires', 'amount', 'status', 'findings', 'reasons'],
    htmlColumns: ['unit', 'tenant', 'required', 'expires', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Fairlease Tenant Insurance compares the fields in your certificate log with the insurance clause in your leases file. It does not read certificates, verify policies with an insurer or judge whether coverage is adequate.', de: 'Fairlease Tenant Insurance vergleicht die Felder Ihrer Nachweisliste mit der Versicherungsklausel in Ihrer Mietvertragsdatei. Es liest keine Nachweise, prüft keine Policen beim Versicherer und beurteilt nicht, ob der Schutz ausreicht.', fr: 'Fairlease Tenant Insurance compare les champs de votre registre d’attestations à la clause d’assurance de vos baux. Il ne lit pas les attestations, ne vérifie pas les polices auprès d’un assureur et ne juge pas si la couverture suffit.', es: 'Fairlease Tenant Insurance compara los campos de su registro de certificados con la cláusula de seguro de sus contratos. No lee certificados, no verifica pólizas con la aseguradora ni juzga si la cobertura es suficiente.', pt: 'O Fairlease Tenant Insurance compara os campos do seu registro de certificados com a cláusula de seguro dos contratos. Não lê certificados, não verifica apólices com a seguradora nem avalia se a cobertura é suficiente.', it: 'Fairlease Tenant Insurance confronta i campi del registro dei certificati con la clausola assicurativa dei contratti. Non legge i certificati, non verifica le polizze con l’assicuratore e non valuta se la copertura è adeguata.', ja: 'Fairlease Tenant Insurance は証明書台帳の項目を賃貸借契約ファイルの保険条項と照合します。証明書の読み取り、保険会社への確認、補償が十分かの判断はしません。', zh: 'Fairlease Tenant Insurance 将保险凭证登记表中的字段与租约文件的保险条款对照，不读取凭证、不向保险公司核实保单，也不判断保障是否充足。', ko: 'Fairlease Tenant Insurance는 증명서 대장의 항목을 임대차 파일의 보험 조항과 대조합니다. 증명서를 읽거나 보험사에 확인하거나 보장이 충분한지 판단하지 않습니다.' }] },
});
const pair = draftPair({
  prefix: 'coi', noun: 'request', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/request-<unit>.md: a request to the tenant for an updated certificate, listing exactly what is missing, expired or short of the lease. Marked DRAFT; open items are [TO CONFIRM]. Sending goes through coi_request_send (one click).',
  required: ['leases', 'certificates', 'unit'],
  args: { ...props, unit: { type: 'string', description: 'Unit, suite or lease ID from coi_check' }, to: { type: 'string', description: 'Tenant email or notice address' }, holder: { type: 'string', maxLength: 300, description: 'Certificate holder and additional insured name, for example the owner entity' }, reply_by: { type: 'string', description: 'Reply-by date' }, from: { type: 'string', description: 'Your name and contact' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const q = String(a.unit).trim().toLowerCase();
    const it = r.items.find((i) => [i.unit, i.lease_id].some((v) => String(v).toLowerCase() === q)) || r.items.find((i) => q.length >= 3 && `${i.unit} ${i.tenant}`.toLowerCase().includes(q));
    if (!it) throw new Error(`no lease in force for "${a.unit}"`);
    if (it.status === 'ok') throw new Error(`${it.unit} ${it.tenant} has nothing missing, expired or short of the lease`);
    return { id: it.unit, to: a.to || undefined, text: requestText(it, a) };
  },
});
const refused = refusedTools([
  { name: 'force_place_insurance', category: 'move_money', description: 'Fairlease Tenant Insurance never buys insurance on a tenant\'s behalf or charges them for it.' },
  { name: 'post_tenant_charge', category: 'move_money', description: 'Fairlease Tenant Insurance never posts a non-compliance fee or any charge to a tenant ledger.' },
  { name: 'serve_default_notice', category: 'binding_send', description: 'Fairlease Tenant Insurance never serves a notice of default; that is a person\'s decision.' },
  { name: 'email_send', category: 'binding_send', description: 'Fairlease Tenant Insurance never sends requests; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-tenant-insurance', version: pkg.version,
  description: 'Checks every tenant\'s certificate of insurance against the limits, additional insured wording and dates their own lease requires, and drafts requests for updated certificates. Charging, force-placing cover and default notices are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { leases: LEASES_SCHEMA },
  sources: { certificates: { label: 'Tenant certificates of insurance', args: ['certificates'], fields: TENANT_INSURANCE_FIELDS, profiles: [] } },
  prompts: [{
    name: 'tenant_insurance', title: 'Check tenant insurance',
    description: 'Walks the host model through a monthly tenant insurance check with Fairlease Tenant Insurance.',
    arguments: [{ name: 'leases', description: 'Leases JSON', required: true }, { name: 'certificates', description: 'Certificate log', required: true }],
    text: `You are helping a property manager check tenant insurance with fairlease-tenant-insurance. Leases: {{leases}}. Certificates: {{certificates}}.

Rules: Fairlease Tenant Insurance never charges tenants, buys cover or serves notices; force_place_insurance, post_tenant_charge, serve_default_notice and email_send are blocked. Do not say a tenant is insured or covered; say what the certificate log shows.

1. Call coi_check. Lead with missing and expired certificates, then limits or additional insured short of the lease, then those expiring soon.
2. Call coi_explain for tenants the person asks about.
3. Call coi_write_report and share the paths.
4. Offer coi_draft_request per tenant; only when the person asks, call coi_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease Tenant Insurance allowlist.' }] },
});
