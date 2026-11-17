import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['cobalt_draft_correction'] });
  process.stdout.write(`Cobalt of Listings demo (fictional building) in ${rt.root}\n`);
  const f = { listings: 'listings-2026-11.csv', rent_roll: 'rent-roll-2026-11.csv', policy: 'listing-policy.json', as_of: '2026-11-15' };
  const a = await rt.call('cobalt_check', f);
  printStep('Check listings on three sites against the rent roll', a);
  for (const i of a.result.items) process.stdout.write(`    ${String(i.unit).padEnd(5)} ${i.occupancy.padEnd(9)} ${i.status.padEnd(7)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain unit 103', await rt.call('cobalt_explain', { ...f, unit: '103' }));
  printStep('Read a French listings export (Référence annonce, Loyer, Disponible le)', await rt.call('cobalt_check', { listings: 'exports/annonces-fr.csv', rent_roll: 'exports/lots-fr.csv', as_of: '2026-11-15' }));
  printStep('Write the worklist', await rt.call('cobalt_write_report', f));
  const d = await rt.call('cobalt_draft_correction', { ...f, unit: '106', by: '2026-11-18', from: 'Dana Manager (fictional)' });
  printStep('Draft corrections for unit 106', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('cobalt_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to change a listing itself', await rt.call('publish_listing', {}));
}
