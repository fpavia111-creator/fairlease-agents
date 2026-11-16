import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['garnet_draft_offer'] });
  process.stdout.write(`Garnet of Renewals demo (fictional 24-unit apartment building) in ${rt.root}\n`);
  const f = { leases: 'leases.json', policy: 'renewal-policy.json', rent_roll: 'rent-roll-2026-11.csv', offers: 'offers.csv', as_of: '2026-11-15' };
  const a = await rt.call('garnet_check', f);
  printStep('Renewals in the next 120 days, with a 5% cap and 60 days notice', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.unit} ends ${i.lease_end}  rent ${String(i.rent).padStart(6)}  market ${String(i.market_rent ?? '-').padStart(6)}  proposed ${String(i.proposed ?? '-').padStart(6)}  ${i.stage.padEnd(14)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain unit 402 (offer already sent above the cap)', await rt.call('garnet_explain', { ...f, unit: '402' }));
  printStep('Read offers in French (Lot, Locataire, Loyer proposé)', await rt.call('garnet_explain', { ...f, offers: 'exports/offres-fr.csv', unit: '402' }));
  printStep('Write the worklist', await rt.call('garnet_write_report', f));
  printStep('Draft an offer above the cap: refused', await rt.call('garnet_draft_offer', { ...f, unit: '206', offer_rent: 1950 }));
  const d = await rt.call('garnet_draft_offer', { ...f, unit: '206', term_months: 12, reply_by: '2026-12-15', from: 'Dana Manager, Maple Court office (fictional)' });
  printStep('Draft the renewal offer for unit 206 at the proposed rent', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('garnet_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to send the renewal lease for e-signature', await rt.call('esign_send', {}));
}
