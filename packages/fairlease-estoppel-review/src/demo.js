import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairlease-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['estoppels_draft_request'] });
  process.stdout.write(`Fairlease Estoppel Review demo (fictional sale of a fictional plaza) in ${rt.root}\n`);
  const f = { leases: 'leases.json', estoppels: 'estoppels-2026.csv', policy: 'estoppel-policy.json', indexes: 'indexes.json', as_of: '2026-11-15' };
  const a = await rt.call('estoppels_check', f);
  printStep('Check returned estoppels against the lease abstracts, closing 2026-12-15', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.unit.padEnd(10)} ${i.tenant.padEnd(24)} ${i.status.padEnd(11)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain Suite 140 (term and amendment differ)', await rt.call('estoppels_explain', { ...f, unit: 'Suite 140' }));
  printStep('Read a German confirmation log (Miete, Kaution, Einwendungen, Unterzeichnet am)', await rt.call('estoppels_check', { ...f, estoppels: 'exports/mieterbestaetigung-de.csv' }));
  printStep('Write the tracker', await rt.call('estoppels_write_report', f));
  const d = await rt.call('estoppels_draft_request', { ...f, unit: 'Suite 110', reply_by: '2026-12-01', purpose: 'The certificate is for the sale of the property to Example Buyer LLC (fictional) and its lender, who may rely on it.', from: 'Harbor Point Owner LLC (fictional)' });
  printStep('Draft a follow-up to Brightside Dental (stale, rent differs)', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('estoppels_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to upload tenant files to the buyer\'s data room', await rt.call('data_room_upload', {}));
}
