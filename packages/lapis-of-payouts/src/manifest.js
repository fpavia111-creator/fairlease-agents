import { defineManifest, MODEL_PIN, BOOKING_FIELDS, BOOKING_PROFILES, BANK_FIELDS, standardTools, draftPair, refusedTools, memoryTools, isoDate } from 'keystone-core';
import { readFileSync } from 'node:fs';
import { reconcilePayouts, inquiryText, channelOf, STR_POLICY_SCHEMA } from './payouts.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const OUT = 'keystone-out/lapis';
const MEMORY_KINDS = {
  listing_alias: {
    description: 'A channel\'s name for one of your listings (for example "Lakeview Cabin - Hot Tub & Dock" is "Lakeview Cabin").',
    effect: 'reads that channel listing name as your listing when matching cleaning fees and reservations; never changes an amount, fee rate or tolerance',
    schema: { type: 'object', additionalProperties: false, required: ['channel_name', 'listing'], properties: { channel_name: { type: 'string', minLength: 1, maxLength: 200 }, listing: { type: 'string', minLength: 1, maxLength: 200 } } },
  },
};
const props = {
  payouts: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'string', minLength: 1, maxLength: 400 }, description: 'Channel payout or transaction files under --root (CSV, Excel or JSON), one per channel: Airbnb transaction history, Vrbo payouts, or any file with a confirmation code and payout amount. The channel is read from the file name (airbnb, vrbo, booking, expedia) or a Channel column. Local headers such as Buchungsnummer, Anreise, Auszahlung or Llegada are read' },
  bookings: { type: 'string', description: 'Reservations from your PMS or channel manager (CSV, Excel or JSON): reservation ID, channel, listing, guest, check-in, check-out, nights, accommodation, cleaning fee, expected payout, status' },
  bank: { type: 'string', description: 'Bank statement for the payout account (CSV, Excel or JSON): date, description, amount or debit and credit' },
  policy: { type: 'string', description: 'Rates JSON (str_policy schema): per channel fee_pct, fee_base and payout_lag_days; per listing cleaning_fee and aliases; bank_lag_days; tolerance' },
  as_of: { type: 'string', description: 'Date to judge against, YYYY-MM-DD (default today)' },
};
const run = (a, ctx) => {
  const asOf = a.as_of ? isoDate(a.as_of) : new Date().toISOString().slice(0, 10); if (!asOf) throw new Error('as_of must be a date as YYYY-MM-DD');
  const policy = a.policy ? ctx.readJson(a.policy, 'str_policy') : {};
  const learned = Object.fromEntries(ctx.memoryFacts('listing_alias').map((f) => [f.value.channel_name, f.value.listing]));
  const files = (Array.isArray(a.payouts) ? a.payouts : [a.payouts]).map((p) => ({ path: p, channel: channelOf(String(p).split(/[\\/]/).pop().replace(/[-_.]/g, ' '), policy), rows: ctx.records(p, 'payouts') }));
  return reconcilePayouts({ payoutFiles: files, bookings: a.bookings ? ctx.records(a.bookings, 'bookings') : null, bank: a.bank ? ctx.records(a.bank, 'bank') : null, policy, asOf, learned });
};
const std = standardTools({
  prefix: 'lapis', outDir: OUT, props, required: ['payouts'], run,
  check: { title: 'Reconcile short-term rental payouts', description: 'Every reservation against the channel payout lines: payout missing after the channel\'s lag, short or over your expected payout, paid twice, paid while cancelled, channel fee off your rate, cleaning fee off your listing rate, nights or check-in that differ, and payouts for bookings not in your reservations. With a bank file, each channel payout is matched to a deposit and channel deposits with no payout are listed.' },
  explain: { arg: 'id', argDoc: 'Confirmation code or reservation ID from lapis_check, or a payout id', key: (i) => [i.id, i.booking_id], title: 'Explain one booking or payout', description: 'Show one reservation\'s expected and paid amounts, payout dates and each finding, or one payout\'s bank match.',
    describe: (i) => (i.kind === 'booking' ? `${i.booking_id} (${i.channel}, ${i.listing}, ${i.check_in || '?'} to ${i.check_out || '?'}): ${i.status}. Expected ${i.expected ?? 'unknown'}, paid ${i.paid} in ${i.lines} line(s)${i.payout_dates.length ? ` on ${i.payout_dates.join(', ')}` : ''}. ${i.findings.map((f) => f.detail).join(' ')}` : `${i.id}: ${i.status}${i.bank_date ? `, in the bank on ${i.bank_date}` : ''}. ${i.findings.map((f) => f.detail).join(' ')}`).trim() },
  report: { base: 'lapis-payouts', description: 'Write the payout reconciliation worklist',
    title: { en: 'Short-term rental payouts', de: 'Auszahlungen der Ferienvermietung', fr: 'Versements de location courte durée', es: 'Pagos de alquiler vacacional', pt: 'Repasses de aluguel por temporada', it: 'Accrediti degli affitti brevi', ja: '民泊・短期賃貸の入金', zh: '短租平台结算', ko: '단기 임대 정산' },
    row: (i) => ({ id: i.id, channel: i.channel, listing: i.listing || '', date: i.check_in || i.date || '', expected: i.expected ?? '', amount: i.kind === 'booking' ? i.paid : i.amount, status: i.status, findings: i.findings.map((f) => f.code).join(' '), reasons: i.findings.map((f) => f.detail).join(' ') }),
    columns: ['id', 'channel', 'listing', 'date', 'expected', 'amount', 'status', 'findings', 'reasons'],
    htmlColumns: ['id', 'channel', 'listing', 'date', 'amount', 'status', 'reasons'],
    limits: ['files', 'advice', { en: 'Lapis compares the channel files, reservations and bank statement you give it, using the rates in your policy file. It does not log in to any channel, see adjustments that are not in the files, or judge occupancy tax.', de: 'Lapis vergleicht die übergebenen Kanaldateien, Buchungen und Kontoauszüge mit den Sätzen aus Ihrer Richtliniendatei. Es meldet sich bei keinem Kanal an, sieht keine Anpassungen außerhalb der Dateien und beurteilt keine Beherbergungsabgaben.', fr: 'Lapis compare les fichiers des plateformes, les réservations et le relevé bancaire fournis, selon les taux de votre fichier de règles. Il ne se connecte à aucune plateforme, ne voit pas les ajustements absents des fichiers et ne juge pas la taxe de séjour.', es: 'Lapis compara los archivos de los canales, las reservas y el extracto bancario que usted indica, con las tarifas de su archivo de reglas. No inicia sesión en ningún canal, no ve ajustes que no estén en los archivos ni juzga impuestos de alojamiento.', pt: 'O Lapis compara os arquivos dos canais, as reservas e o extrato bancário informados, com as tarifas do seu arquivo de regras. Não entra em nenhum canal, não vê ajustes fora dos arquivos e não avalia impostos de hospedagem.', it: 'Lapis confronta i file dei canali, le prenotazioni e l’estratto conto forniti, con le tariffe del file di regole. Non accede ad alcun canale, non vede rettifiche assenti dai file e non valuta l’imposta di soggiorno.', ja: 'Lapis は指定されたチャネルのファイル、予約、銀行明細をポリシーファイルの料率で照合します。チャネルへのログイン、ファイルにない調整の確認、宿泊税の判断はしません。', zh: 'Lapis 按规则文件中的费率，对照您提供的平台文件、预订和银行流水。不登录任何平台，看不到文件以外的调整，也不判断住宿税。', ko: 'Lapis는 정책 파일의 요율로 제공된 채널 파일, 예약, 은행 거래내역을 대조합니다. 채널에 로그인하거나 파일에 없는 조정을 보거나 숙박세를 판단하지 않습니다.' }] },
});
const pair = draftPair({
  prefix: 'lapis', noun: 'inquiry', verb: 'send', category: 'binding_send', outDir: OUT, actor: 'a person on your team',
  description: 'Write drafts/inquiry-<booking>.md: a payout inquiry to the channel\'s host support for one booking, listing exactly what differs. Marked DRAFT; open items are [TO CONFIRM]. Sending goes through lapis_request_send (one click).',
  required: ['payouts', 'id'],
  args: { ...props, id: { type: 'string', description: 'Confirmation code or reservation ID from lapis_check' }, to: { type: 'string', description: 'Channel support address or case link' }, account: { type: 'string', maxLength: 200, description: 'Your host account name or ID' }, from: { type: 'string', description: 'Your name and contact' } },
  build: (a, ctx) => {
    const r = run(a, ctx); const q = String(a.id).trim().toLowerCase();
    const it = r.items.find((i) => i.kind === 'booking' && String(i.booking_id).toLowerCase() === q);
    if (!it) throw new Error(`no booking "${a.id}"`);
    if (!it.findings.some((f) => ['missing_payout', 'payout_short', 'payout_over', 'duplicate_payout', 'fee_rate_differs', 'cleaning_fee_differs', 'nights_differ', 'paid_while_cancelled'].includes(f.code))) throw new Error(`${it.booking_id} has no payout difference to ask the channel about`);
    return { id: it.booking_id, to: a.to || undefined, text: inquiryText(it, a) };
  },
});
const mem = memoryTools('lapis', MEMORY_KINDS);
const refused = refusedTools([
  { name: 'issue_guest_refund', category: 'move_money', description: 'Lapis never refunds a guest or sends money anywhere.' },
  { name: 'owner_payout', category: 'move_money', description: 'Lapis never pays owners; owner statements and payouts are a person\'s job.' },
  { name: 'channel_listing_update', category: 'production_deploy', description: 'Lapis never changes prices, fees or settings on a channel.' },
  { name: 'email_send', category: 'binding_send', description: 'Lapis never sends inquiries; a person sends the approved draft.' },
]);

export const manifest = defineManifest({
  name: 'lapis-of-payouts', version: pkg.version,
  description: 'Reconciles short-term rental payouts from Airbnb, Vrbo and other channels against your reservations and bank deposits: missing, short or duplicate payouts, channel and cleaning fees off your rates, nights that differ, and payouts that never reached the bank. Drafts payout inquiries. Refunds, owner payouts and channel changes are a person\'s job.',
  model: MODEL_PIN,
  caps: { maxSteps: 60, maxSpendUsd: 0 },
  configSchemas: { str_policy: STR_POLICY_SCHEMA },
  sources: {
    payouts: { label: 'Channel payouts', args: ['payouts'], fields: BOOKING_FIELDS, profiles: BOOKING_PROFILES },
    bookings: { label: 'Reservations', args: ['bookings'], fields: BOOKING_FIELDS, profiles: [] },
    bank: { label: 'Bank statement', args: ['bank'], fields: BANK_FIELDS, profiles: [] },
  },
  memory: { prefix: 'lapis', kinds: MEMORY_KINDS },
  prompts: [{
    name: 'payout_reconciliation', title: 'Reconcile short-term rental payouts',
    description: 'Walks the host model through a monthly payout reconciliation with Lapis.',
    arguments: [{ name: 'payouts', description: 'Channel payout files', required: true }, { name: 'bookings', description: 'Reservations', required: false }, { name: 'bank', description: 'Bank statement', required: false }],
    text: `You are helping a short-term rental manager reconcile payouts with lapis-of-payouts. Payout files: {{payouts}}. Reservations: {{bookings}}. Bank: {{bank}}.

Rules: Lapis never refunds guests, pays owners, changes channel settings or sends anything; issue_guest_refund, owner_payout, channel_listing_update and email_send are blocked. Do not say a channel owes money; say what the files show.

1. Call lapis_check. Lead with missing payouts and payouts not in the bank, then short or duplicate payouts, then fee differences.
2. Call lapis_explain for bookings the person asks about. If a channel names a listing differently, offer lapis_learn with a listing_alias; a person accepts it with lapis_accept_learning.
3. Call lapis_write_report and share the paths.
4. Offer lapis_draft_inquiry per booking; only when the person asks, call lapis_request_send. It needs one named human click.`,
  }],
  tools: [...std.tools, ...pair.tools, ...mem.tools, ...refused.tools],
  policy: { rules: [...std.rules, ...pair.rules, ...mem.rules, ...refused.rules, { tool: '*', decision: 'block', reason: 'Not on the Lapis allowlist.' }] },
});
