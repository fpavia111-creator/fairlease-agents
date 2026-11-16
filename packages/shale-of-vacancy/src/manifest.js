import { defineManifest, MODEL_PIN, RENT_ROLL_FIELDS, RENT_ROLL_PROFILES, standardTools, refusedTools, isoDate } from 'keystone-core';
import { readFileSync } from 'node:fs';
import { checkVacancy } from './vacancy.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/shale';
const props = {
  rent_roll: { type: 'string', description: 'Rent roll (CSV, Excel or JSON) with unit status, market rent, rent and move-out dates. AppFolio, Yardi (one row per charge too), Buildium, Rent Manager, Entrata, OneSite and MRI layouts are recognised' },
  as_of: { type: 'string', description: 'Date of the rent roll, YYYY-MM-DD (default today); days vacant count to it' },
  long_vacant_days: { type: 'integer', minimum: 1, maximum: 365, description: 'Days vacant after which a unit is flagged (default 30)' },
  off_market_pct: { type: 'number', minimum: 1, maximum: 100, description: 'Percent under or over market rent that is flagged (default 10)' },
};
const run = (a, ctx) => { const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD'); return checkVacancy({ rows: ctx.records(a.rent_roll, 'rent_roll'), asOf, longVacantDays: a.long_vacant_days ?? 30, offMarketPct: a.off_market_pct ?? 10 }); };
const std = standardTools({
  prefix: 'shale', outDir: OUT, props, required: ['rent_roll'], run,
  check: { title: 'Read occupancy, vacancy loss and loss to lease', description: 'From one rent roll: physical occupancy, leased percent, exposure (vacant plus on notice and not re-leased), gross potential rent at market, loss to lease, vacancy loss, concessions and economic occupancy, unit by unit. Flags long-vacant units, rents far under or over market, missing market rents and vacant units with no move-out date.' },
  explain: { arg: 'unit', argDoc: 'Unit or tenant from shale_check', key: (i) => [i.unit, i.tenant], title: 'Explain one unit', description: 'Show one unit\'s status, market rent, rent, loss to lease, days vacant and findings.',
    describe: (i) => `Unit ${i.unit} (${i.status.replace(/_/g, ' ')}${i.tenant ? `, ${i.tenant}` : ''}): market ${i.market_rent ?? 'unknown'}, rent ${i.rent ?? '-'}${i.loss_to_lease !== null ? `, loss to lease ${i.loss_to_lease}` : ''}${i.days_vacant !== null ? `, vacant ${i.days_vacant} days (${i.vacancy_loss_to_date} at market)` : ''}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'shale-vacancy', description: 'Write the vacancy and loss-to-lease worklist',
    title: { en: 'Vacancy and loss to lease', de: 'Leerstand und Mietabschlag', fr: 'Vacance et écart au marché', es: 'Vacancia y pérdida frente a mercado', pt: 'Vacância e perda frente ao mercado', it: 'Sfitto e scarto dal mercato', ja: '空室と市場賃料差', zh: '空置与租金折损', ko: '공실과 시장 대비 손실' },
    row: (i) => ({ unit: i.unit, tenant: i.tenant, status: i.status, market_rent: i.market_rent, rent: i.rent, loss_to_lease: i.loss_to_lease, days_vacant: i.days_vacant, amount: i.vacancy_loss_to_date, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['unit', 'tenant', 'status', 'market_rent', 'rent', 'loss_to_lease', 'days_vacant', 'amount', 'findings', 'reasons'],
    htmlColumns: ['unit', 'tenant', 'status', 'market_rent', 'rent', 'loss_to_lease', 'days_vacant', 'reasons'],
    limits: ['files', 'advice', { en: 'Market rents are the ones on your rent roll; Shale does not survey the market or set prices.', de: 'Marktmieten stammen aus Ihrer Mieterliste; Shale erhebt keine Marktdaten und setzt keine Preise.', fr: 'Les loyers de marché sont ceux de votre état locatif ; Shale n’étudie pas le marché et ne fixe pas de prix.', es: 'Las rentas de mercado son las de su rent roll; Shale no estudia el mercado ni fija precios.', pt: 'Os aluguéis de mercado são os do seu rent roll; o Shale não pesquisa o mercado nem define preços.', it: 'I canoni di mercato sono quelli del vostro rent roll; Shale non analizza il mercato né fissa prezzi.', ja: '市場賃料はレントロールの値です。Shale は市場調査や賃料設定をしません。', zh: '市场租金取自您的租金清单；Shale 不做市场调查，也不定价。', ko: '시장 임대료는 렌트롤의 값입니다. Shale은 시장 조사나 가격 결정을 하지 않습니다.' }] },
});
const refused = refusedTools([
  { name: 'pm_system_update', category: 'production_deploy', description: 'Shale never changes market rents, unit status or pricing in the property management system.' },
  { name: 'listing_publish', category: 'binding_send', description: 'Shale never posts or reprices a listing.' },
]);

export const manifest = defineManifest({
  name: 'shale-of-vacancy', version: pkg.version,
  description: 'Reads a rent roll and shows physical and economic occupancy, leased percent, exposure, vacancy loss, loss to lease and concessions unit by unit, with long-vacant units and rents far from market flagged. Pricing and listings are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  sources: { rent_roll: { label: 'Rent roll', args: ['rent_roll'], fields: RENT_ROLL_FIELDS, profiles: RENT_ROLL_PROFILES } },
  prompts: [{
    name: 'vacancy_review', title: 'Review vacancy and loss to lease',
    description: 'Walks the host model through a weekly vacancy review with Shale.',
    arguments: [{ name: 'rent_roll', description: 'Rent roll export', required: true }, { name: 'as_of', description: 'Date of the rent roll', required: false }],
    text: `You are helping a property manager review vacancy with shale-of-vacancy. Rent roll: {{rent_roll}} as of {{as_of}}.

Rules: Shale never changes prices or listings; pm_system_update and listing_publish are blocked. Market rents come from the rent roll; do not invent market data.

1. Call shale_check. Report occupancy, leased percent, exposure, vacancy loss and loss to lease, then each long-vacant unit with days and loss to date.
2. Call shale_explain for units the person asks about.
3. Call shale_write_report and share the paths.`,
  }],
  tools: [...std.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Shale allowlist.' }] },
});
