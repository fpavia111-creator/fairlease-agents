import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairlease-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto' });
  process.stdout.write(`Fairlease Lease Abstracts demo (fictional leases) in ${rt.root}\n`);
  const a = await rt.call('abstracts_abstract', { text: 'lease-acme-bagels.docx', lease_id: 'L-101' });
  printStep('Abstract a Word lease with a citation for every term', a);
  for (const [k, t] of Object.entries(a.result.terms).slice(0, 12)) process.stdout.write(`    ${k.padEnd(22)} ${JSON.stringify(t.value).padEnd(28)} ${t.citation}\n`);
  printStep('Abstract a short lease with an amendment, a gap and planted text aimed at an AI', await rt.call('abstracts_abstract', { text: 'lease-delta-phone.txt', lease_id: 'L-104' }));
  printStep('Check the leases file against the lease text', await rt.call('abstracts_compare', { text: 'lease-acme-bagels.txt', leases: 'leases-with-errors.json', lease_id: 'L-101' }));
  printStep('Write the abstract (Markdown, JSON entry, citations CSV)', await rt.call('abstracts_write_abstract', { text: 'lease-acme-bagels.txt', lease_id: 'L-101' }));
  printStep('Agent tries to enter the lease into the system itself', await rt.call('pm_system_update', {}));
}
