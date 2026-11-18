import { defineManifest, MODEL_PIN, TURN_FIELDS, standardTools, refusedTools, isoDate } from 'fairlease-core';
import { readFileSync } from 'node:fs';
import { checkTurns, TURN_POLICY_SCHEMA } from './turns.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/turns';
const props = {
  turns: { type: 'string', description: 'Turn lines (CSV, Excel or JSON): unit, move-out, ready, move-in, category or trade, vendor, cost, tenant chargeable (yes, no, partial) and market rent. One row per trade; rows with the same unit and move-out are one turn. AppFolio and Buildium work-order exports can be shaped into this' },
  policy: { type: 'string', description: 'Optional turn policy JSON: target_days (default 7), ready_to_lease_days (default 14), budget by bedroom count, default_budget, unit_bedrooms' },
  as_of: { type: 'string', description: 'Date to count to, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => { const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD'); return checkTurns({ rows: ctx.records(a.turns, 'turns'), policy: a.policy ? ctx.readJson(a.policy, 'turn_policy') : {}, asOf }); };
const std = standardTools({
  prefix: 'turns', outDir: OUT, props, required: ['turns'], run,
  check: { title: 'Check unit turns', description: 'For every turn: days from move-out to ready against your target, days vacant, cost by trade against your budget, the part chargeable to the former tenant and rent lost while vacant. Flags turns over target or budget, units ready but not leased, missing costs and vendors, and lines not marked chargeable or not.' },
  explain: { arg: 'unit', argDoc: 'Unit from turns_check', key: (i) => [i.unit], title: 'Explain one turn', description: 'Show one turn\'s dates, trades, costs and findings.',
    describe: (i) => `Unit ${i.unit}: moved out ${i.move_out}, ${i.stage.replace(/_/g, ' ')}${i.ready ? `, ready ${i.ready}` : ''}${i.move_in ? `, move-in ${i.move_in}` : ''}; ${i.days_to_ready} days to ready, cost ${i.cost}${i.budget !== null ? ` (budget ${i.budget})` : ''}, chargeable ${i.chargeable}, rent lost ${i.rent_lost ?? '?'}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'turns', description: 'Write the unit turn worklist',
    title: { en: 'Unit turns', de: 'Wohnungsübergaben und Instandsetzung', fr: 'Remises en état des logements', es: 'Rotación de unidades', pt: 'Preparação de unidades', it: 'Ripristino delle unità', ja: '原状回復と入居準備', zh: '房屋周转整备', ko: '세대 원상복구와 입주 준비' },
    row: (i) => ({ unit: i.unit, move_out: i.move_out, stage: i.stage, days: i.days_to_ready, days_vacant: i.days_vacant, total: i.cost, budget: i.budget, amount: i.chargeable, remaining: i.rent_lost, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['unit', 'move_out', 'stage', 'days', 'days_vacant', 'total', 'budget', 'amount', 'remaining', 'status', 'findings', 'reasons'],
    htmlColumns: ['unit', 'stage', 'days', 'days_vacant', 'total', 'budget', 'status', 'reasons'],
    limits: ['files', 'advice'] },
});
const refused = refusedTools([
  { name: 'vendor_dispatch', category: 'binding_send', description: 'Fairlease Unit Turns never dispatches or schedules a vendor.' },
  { name: 'approve_invoice', category: 'move_money', description: 'Fairlease Unit Turns never approves or pays a vendor invoice.' },
  { name: 'post_tenant_charge', category: 'move_money', description: 'Fairlease Unit Turns never bills a former tenant; chargeable items go on the deposit statement a person approves.' },
]);

export const manifest = defineManifest({
  name: 'fairlease-unit-turns', version: pkg.version,
  description: 'Tracks unit turns from move-out to make-ready to move-in: days against your target, cost by trade against your budget, items chargeable to the former tenant and rent lost while the unit sits. Dispatching vendors and paying invoices are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { turn_policy: TURN_POLICY_SCHEMA },
  sources: { turns: { label: 'Unit turn lines', args: ['turns'], fields: TURN_FIELDS, profiles: [] } },
  prompts: [{
    name: 'turn_review', title: 'Review unit turns',
    description: 'Walks the host model through a weekly make-ready review with Fairlease Unit Turns.',
    arguments: [{ name: 'turns', description: 'Turn lines', required: true }, { name: 'policy', description: 'Turn policy JSON', required: false }],
    text: `You are helping a maintenance or property manager review unit turns with fairlease-unit-turns. Turns: {{turns}}. Policy: {{policy}}.

Rules: Fairlease Unit Turns never dispatches vendors, approves invoices or bills former tenants; vendor_dispatch, approve_invoice and post_tenant_charge are blocked.

1. Call turns_check. Lead with turns still open past target, then units ready but not leased, then turns over budget. Give rent lost while vacant.
2. Call turns_explain for units the person asks about; point chargeable items to the deposit statement (Fairlease Security Deposits does that).
3. Call turns_write_report and share the paths.`,
  }],
  tools: [...std.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Fairlease Unit Turns allowlist.' }] },
});
