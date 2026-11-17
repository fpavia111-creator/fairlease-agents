import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['lapis_draft_inquiry'] });
  process.stdout.write(`Lapis of Payouts demo (fictional listings and guests) in ${rt.root}\n`);
  const f = { payouts: ['airbnb-transactions-2026-10.csv', 'vrbo-payouts-2026-10.csv'], bookings: 'reservations-2026-10.csv', bank: 'bank-operating-2026.csv', policy: 'str-policy.json', as_of: '2026-11-15' };
  const a = await rt.call('lapis_check', f);
  printStep('Reconcile October payouts from two channels against reservations and the bank', a);
  for (const i of a.result.items.filter((x) => x.status !== 'ok')) process.stdout.write(`    ${i.id.padEnd(24)} ${i.status.padEnd(9)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain HMD4YU2L (channel paid for fewer nights)', await rt.call('lapis_explain', { ...f, id: 'HMD4YU2L' }));
  printStep('Read a German FeWo-direkt payout file (Buchungsnummer, Anreise, Provision, Auszahlung)', await rt.call('lapis_check', { payouts: ['exports/fewo-direkt-auszahlungen-de.csv'], policy: 'exports/fewo-policy.json', as_of: '2026-11-15' }));
  printStep('Write the worklist', await rt.call('lapis_write_report', f));
  const d = await rt.call('lapis_draft_inquiry', { ...f, id: 'HMC3WE9P', account: 'Harbor Stays (fictional)', from: 'Dana Manager (fictional)' });
  printStep('Draft a payout inquiry about HMC3WE9P (fee at 15% instead of 3%)', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('lapis_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to refund a guest itself', await rt.call('issue_guest_refund', {}));
}
