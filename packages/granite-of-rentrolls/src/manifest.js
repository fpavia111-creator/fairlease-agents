import { defineManifest, MODEL_PIN, LEASES_SCHEMA, INDEX_SCHEMA, RENT_ROLL_FIELDS, RENT_ROLL_PROFILES, CHARGE_KINDS, standardTools, refusedTools, memoryTools, isoDate } from 'keystone-core';
import { readFileSync } from 'node:fs';
import { checkRentRoll } from './rentroll.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/granite';
const props = {
  rent_roll: { type: 'string', description: 'Rent roll export under --root (CSV, Excel or JSON). AppFolio, Yardi (with lease charges), Buildium, Rent Manager, Entrata, OneSite and MRI layouts are recognised' },
  leases: { type: 'string', description: 'Leases JSON (leases schema): your lease abstracts with rent, steps, escalations, deposits and dates' },
  as_of: { type: 'string', description: 'Date the rent roll was run, as YYYY-MM-DD; rents are checked as of this date' },
  indexes: { type: 'string', description: 'Optional CPI-style index values JSON for CPI escalations ({"index name": {"YYYY-MM": value}}), copied from your source' },
  tolerance: { type: 'number', minimum: 0, maximum: 1000, description: 'Difference ignored for rents and deposits, in currency units (default 1)' },
};
const KINDS = Object.keys(CHARGE_KINDS);
const MEMORY_KINDS = {
  charge_code_kind: {
    description: 'What one of your system\'s charge codes means (for example "RNTCOM is rent", "CAMEST is CAM").',
    effect: 'reads that charge code as the given kind when a rent roll lists charges row by row; never changes a lease term or a tolerance',
    schema: { type: 'object', additionalProperties: false, required: ['code', 'kind'], properties: { code: { type: 'string', pattern: '^[A-Za-z0-9 _./-]{1,30}$' }, kind: { type: 'string', enum: KINDS } } },
  },
};
const run = (a, ctx) => {
  const asOf = isoDate(a.as_of); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  const aliases = Object.fromEntries(ctx.memoryFacts('charge_code_kind').map((f) => [f.value.code, f.value.kind]));
  return checkRentRoll({ rows: ctx.records(a.rent_roll, 'rent_roll'), leases: ctx.readJson(a.leases, 'leases'), asOf, indexes: a.indexes ? ctx.readJson(a.indexes, 'indexes') : {}, tolerance: a.tolerance ?? 1, aliases });
};
const std = standardTools({
  prefix: 'granite', outDir: OUT, props, required: ['rent_roll', 'leases', 'as_of'], run,
  check: { title: 'Check the rent roll against the leases', description: 'Compare every rent roll unit with the lease in force on as_of: rent after steps and escalations (fixed, amount or CPI), deposit, area, dates and tenant name; flag holdovers, units occupied with no lease, vacant units that have a lease, and leases missing from the rent roll.' },
  explain: { arg: 'unit', argDoc: 'Unit, tenant or lease id from granite_check', key: (i) => [i.unit, i.tenant, i.lease_id], title: 'Explain one unit', description: 'Show one unit\'s rent roll values, the lease values and every finding.',
    describe: (i) => `${i.unit} (${i.tenant}): ${i.status}. Rent roll ${i.rent_roll_rent ?? '-'}, lease ${i.lease_rent ?? '-'}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'granite-rent-roll', description: 'Write the rent roll audit worklist',
    title: { en: 'Rent roll against leases', de: 'Mieterliste gegen Mietverträge', fr: 'État locatif comparé aux baux', es: 'Rent roll frente a contratos', pt: 'Rent roll versus contratos', it: 'Rent roll rispetto ai contratti', ja: 'レントロールと賃貸借契約の照合', zh: '租金清单与租约核对', ko: '렌트롤과 임대차계약 대조' },
    row: (i) => ({ property: i.property, unit: i.unit, tenant: i.tenant, lease_id: i.lease_id || '', rent_roll_rent: i.rent_roll_rent, lease_rent: i.lease_rent, difference: i.difference, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['property', 'unit', 'tenant', 'lease_id', 'rent_roll_rent', 'lease_rent', 'difference', 'status', 'findings', 'reasons'],
    htmlColumns: ['unit', 'tenant', 'rent_roll_rent', 'lease_rent', 'difference', 'status', 'reasons'],
    sections: (r) => [{ title: { en: 'By finding', de: 'Nach Befund', fr: 'Par constat', es: 'Por hallazgo', pt: 'Por achado', it: 'Per rilievo', ja: '指摘別', zh: '按发现', ko: '발견 사항별' }, rows: Object.entries(r.by_finding).map(([code, count]) => ({ code, count })), columns: ['code', 'count'] }],
    limits: ['files', 'lease', 'advice'] },
});
const mem = memoryTools('granite', MEMORY_KINDS);
const refused = refusedTools([
  { name: 'pm_system_update', category: 'production_deploy', description: 'Granite never changes rents, deposits or lease dates in the property management system; a person corrects the record.' },
  { name: 'post_tenant_charge', category: 'move_money', description: 'Granite never bills a missed escalation; your accounting team does after review.' },
]);

export const manifest = defineManifest({
  name: 'granite-of-rentrolls', version: pkg.version,
  description: 'Checks a rent roll against your lease abstracts, unit by unit: rent after steps and fixed or CPI escalations, deposits, areas, dates and tenant names, plus holdovers, occupied units with no lease and leases missing from the rent roll. Correcting the system is a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { leases: LEASES_SCHEMA, indexes: INDEX_SCHEMA },
  sources: { rent_roll: { label: 'Rent roll', args: ['rent_roll'], fields: RENT_ROLL_FIELDS, profiles: RENT_ROLL_PROFILES } },
  memory: { prefix: 'granite', kinds: MEMORY_KINDS },
  prompts: [{
    name: 'rent_roll_audit', title: 'Audit a rent roll against the leases',
    description: 'Walks the host model through a rent roll audit with Granite.',
    arguments: [{ name: 'rent_roll', description: 'Rent roll export under --root', required: true }, { name: 'leases', description: 'Leases JSON', required: true }, { name: 'as_of', description: 'Rent roll date, YYYY-MM-DD', required: true }],
    text: `You are helping a property manager, asset manager or buyer audit a rent roll with granite-of-rentrolls. Rent roll: {{rent_roll}}. Leases: {{leases}}. As of: {{as_of}}.

Rules: Granite never changes the property management system and never bills anything; pm_system_update and post_tenant_charge are blocked. Findings compare the rent roll with the person's own lease abstracts; they are not a legal reading of any lease.

0. Call granite_recall for charge codes Granite has learned. If the person explains a charge code, call granite_learn (kind charge_code_kind) and say it waits for a named person to accept.
1. Call granite_check. Report units with issues, rent under the leases per month, holdovers and units with no lease.
2. For each unit with an issue, call granite_explain when the person wants detail.
3. Call granite_write_report and share the CSV and HTML paths.`,
  }],
  tools: [...std.tools, ...mem.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...mem.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Granite allowlist.' }] },
});
