import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairlease-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto' });
  process.stdout.write(`Fairlease Trust Reconciliation demo (fictional trust account) in ${rt.root}\n`);
  const f = { bank: 'bank-statement-2026.csv', book: 'trust-register-2026.csv', ledgers: 'trust-ledgers-2026-10.csv', policy: 'trust-policy.json' };
  const a = await rt.call('trust_check', f);
  printStep('Three-way reconciliation at 2026-10-31', a);
  for (const i of a.result.items.filter((x) => x.status !== 'ok' || x.type !== 'three_way')) process.stdout.write(`    ${i.type.padEnd(19)} ${String(i.reference).padEnd(34)} ${String(i.amount).padStart(9)}  ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain check 2202 (entered twice?)', await rt.call('trust_explain', { ...f, reference: '2202' }));
  printStep('Read a German bank export (Buchungstag, Verwendungszweck, Betrag)', await rt.call('trust_check', { ...f, bank: 'exports/kontoauszug-de.csv', ledgers: undefined }));
  printStep('Write the reconciliation', await rt.call('trust_write_report', f));
  printStep('Agent tries to move money to cover the negative owner ledger', await rt.call('transfer_funds', {}));
}
