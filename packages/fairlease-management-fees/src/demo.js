import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairlease-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['fees_draft_credit'] });
  process.stdout.write(`Fairlease Management Fees demo (fictional owners and agreements) in ${rt.root}\n`);
  const f = { ledger: 'owner-ledger-2026.csv', agreements: 'agreements.json', rent_roll: 'rent-roll-2026-11.csv' };
  const a = await rt.call('fees_check', f);
  printStep('Recompute September and October fees for three owners from their agreements', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.period} ${i.property.padEnd(24)} ${String(i.overcharge).padStart(8)}  ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain Harbor Point (fee on CAM recoveries, charged twice)', await rt.call('fees_explain', { ...f, owner: 'Harbor Point Plaza' }));
  printStep('Read a French owner ledger (Propriétaire, Libellé, Recettes, Dépenses)', await rt.call('fees_check', { ledger: 'exports/grand-livre-fr.csv', agreements: 'exports/agreements-fr.json' }));
  printStep('Write the worklist', await rt.call('fees_write_report', f));
  const d = await rt.call('fees_draft_credit', { ...f, owner: 'Harbor Point Plaza', credit_on: 'The credit will appear on your November statement.', from: 'Dana Manager (fictional)' });
  printStep('Draft a fee correction note to Harbor Point Owner LLC', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('fees_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to post the credit itself', await rt.call('post_owner_credit', {}));
}
