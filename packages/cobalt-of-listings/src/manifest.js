import { defineManifest, MODEL_PIN, LISTING_FIELDS, RENT_ROLL_FIELDS, RENT_ROLL_PROFILES, standardTools, draftPair, refusedTools, isoDate } from 'keystone-core';
import { readFileSync } from 'node:fs';
import { checkListings, correctionText, LISTING_POLICY_SCHEMA } from './listings.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/cobalt';
const props = {
  listings: { type: 'string', description: 'Listings export (CSV, Excel or JSON), one row per site per unit: listing ID, site or channel, property, unit, beds, baths, size, rent, deposit, available date, pets, status, title, description. Local headers such as Référence annonce, Loyer, Disponible le, Verfügbar ab or 入居可能日 are read' },
  rent_roll: { type: 'string', description: 'Rent roll (CSV, Excel or JSON) with unit, tenant or status, BD/BA, size, market rent and move-out dates. AppFolio, Yardi, Buildium, Rent Manager, Entrata, OneSite and MRI layouts are recognised' },
  policy: { type: 'string', description: 'Optional listing policy JSON (listing_policy schema): required_channels, list_notice_days (default 30), rent_tolerance_pct (default 2), stale_days (default 14), review_words, ignore_units' },
  as_of: { type: 'string', description: 'Date to judge against, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => {
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  return checkListings({ listings: ctx.records(a.listings, 'listings'), rentRoll: ctx.records(a.rent_roll, 'rent_roll'), policy: a.policy ? ctx.readJson(a.policy, 'listing_policy') : {}, asOf });
};
const std = standardTools({
  prefix: 'cobalt', outDir: OUT, props, required: ['listings', 'rent_roll'], run,
  check: { title: 'Check listings against the rent roll', description: 'Vacant and on-notice units not listed or missing from a required site; occupied units still listed; listings for units not in the rent roll; asking rent off the rent roll\'s market rent or different between sites; deposits, pets, beds, baths and size that differ; available dates that are stale or before the move-out; duplicate listings on one site; and phrases in titles or descriptions for a person to review.' },
  explain: { arg: 'unit', argDoc: 'Unit from cobalt_check', key: (i) => [i.unit], title: 'Explain one unit', description: 'Show one unit\'s occupancy, market rent, the sites it is listed on and each finding.',
    describe: (i) => `Unit ${i.unit}${i.property ? `, ${i.property}` : ''}: ${i.occupancy}${i.move_out ? ` (move-out ${i.move_out})` : ''}, ${i.status}. Market rent ${i.market_rent ?? 'unknown'}; listed on ${i.channels.join(', ') || 'no site'}. ${i.findings.map((f) => f.detail).join(' ')}`.trim() },
  report: { base: 'cobalt-listings', description: 'Write the listings worklist',
    title: { en: 'Listings', de: 'Inserate', fr: 'Annonces', es: 'Anuncios', pt: 'Anúncios', it: 'Annunci', ja: '募集広告', zh: '房源广告', ko: '매물 광고' },
    row: (i) => ({ unit: i.unit, status: i.occupancy, channel: i.channels.join(', '), rent: i.asking ?? '', market_rent: i.market_rent ?? '', findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['unit', 'status', 'channel', 'rent', 'market_rent', 'findings', 'reasons'],
    htmlColumns: ['unit', 'status', 'channel', 'rent', 'reasons'],
    limits: ['files', 'advice', { en: 'Cobalt compares your listings export with your rent roll. It does not visit listing sites, and it flags wording for a person to review without judging whether any advertisement is lawful.', de: 'Cobalt vergleicht Ihren Inserate-Export mit der Mieterliste. Es besucht keine Portale und markiert Formulierungen zur Prüfung durch einen Menschen, ohne zu beurteilen, ob eine Anzeige zulässig ist.', fr: 'Cobalt compare votre export d’annonces à l’état locatif. Il ne consulte aucun site et signale des formulations à relire par une personne, sans juger si une annonce est licite.', es: 'Cobalt compara su exportación de anuncios con el rent roll. No visita portales y señala redacciones para que una persona las revise, sin juzgar si un anuncio es lícito.', pt: 'O Cobalt compara sua exportação de anúncios com o rent roll. Não visita portais e aponta redações para revisão humana, sem julgar se um anúncio é lícito.', it: 'Cobalt confronta l’esportazione degli annunci con il rent roll. Non visita i portali e segnala formulazioni da far rivedere a una persona, senza giudicare se un annuncio sia lecito.', ja: 'Cobalt は広告のエクスポートをレントロールと照合します。掲載サイトには接続せず、表現は人が確認するよう示すだけで、広告の適法性は判断しません。', zh: 'Cobalt 将房源导出与租金清单对照。不访问房源网站，只标出需要人工复核的措辞，不判断广告是否合法。', ko: 'Cobalt는 매물 내보내기를 렌트롤과 대조합니다. 매물 사이트에 접속하지 않으며, 사람이 검토할 문구를 표시할 뿐 광고의 적법성은 판단하지 않습니다.' }] },
});
const pair = draftPair({
  prefix: 'cobalt', noun: 'correction', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/correction-<unit>.md: a list of listing corrections for one unit, for your leasing or marketing contact or syndication vendor. Marked DRAFT; open items are [TO CONFIRM]. Sending goes through cobalt_request_send (one click).',
  required: ['listings', 'rent_roll', 'unit'],
  args: { ...props, unit: { type: 'string', description: 'Unit from cobalt_check' }, to: { type: 'string', description: 'Leasing, marketing or vendor contact' }, by: { type: 'string', description: 'Date the corrections are needed by' }, from: { type: 'string', description: 'Your name and contact' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const q = String(a.unit).trim().toLowerCase();
    const it = r.items.find((i) => String(i.unit).toLowerCase() === q);
    if (!it) throw new Error(`unit "${a.unit}" has nothing listed and nothing to list`);
    if (it.status === 'ok') throw new Error(`unit ${it.unit} has nothing to correct`);
    return { id: it.unit, to: a.to || undefined, text: correctionText(it, a) };
  },
});
const refused = refusedTools([
  { name: 'publish_listing', category: 'production_deploy', description: 'Cobalt never posts, edits or takes down a listing on any site.' },
  { name: 'change_asking_rent', category: 'production_deploy', description: 'Cobalt never changes asking rents in your system or on a site.' },
  { name: 'reply_to_prospect', category: 'binding_send', description: 'Cobalt never writes to prospects.' },
  { name: 'email_send', category: 'binding_send', description: 'Cobalt never sends corrections; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'cobalt-of-listings', version: pkg.version,
  description: 'Checks rental listings across your website and listing sites against the rent roll: vacant or soon-vacant units not listed, occupied units still listed, rent, deposit and unit details that differ, stale dates and duplicates, and wording for a person to review. Drafts correction requests. Posting and editing listings is a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { listing_policy: LISTING_POLICY_SCHEMA },
  sources: {
    listings: { label: 'Listings', args: ['listings'], fields: LISTING_FIELDS, profiles: [] },
    rent_roll: { label: 'Rent roll', args: ['rent_roll'], fields: RENT_ROLL_FIELDS, profiles: RENT_ROLL_PROFILES },
  },
  prompts: [{
    name: 'listing_audit', title: 'Check listings against the rent roll',
    description: 'Walks the host model through a weekly listing check with Cobalt.',
    arguments: [{ name: 'listings', description: 'Listings export', required: true }, { name: 'rent_roll', description: 'Rent roll', required: true }],
    text: `You are helping a leasing or marketing manager check listings with cobalt-of-listings. Listings: {{listings}}. Rent roll: {{rent_roll}}.

Rules: Cobalt never posts, edits or removes listings, changes rents, writes to prospects or sends anything; publish_listing, change_asking_rent, reply_to_prospect and email_send are blocked. For wording_review findings, say a person should review the wording; never say an advertisement is or is not lawful.

1. Call cobalt_check. Lead with vacant units not listed and occupied units still listed, then rent differences, then the rest.
2. Call cobalt_explain for units the person asks about.
3. Call cobalt_write_report and share the paths.
4. Offer cobalt_draft_correction per unit; only when the person asks, call cobalt_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Cobalt allowlist.' }] },
});
