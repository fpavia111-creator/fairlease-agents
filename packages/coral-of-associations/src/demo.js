import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['coral_draft_notice'] });
  process.stdout.write(`Coral of Associations demo (fictional association) in ${rt.root}\n`);
  const f = { policy: 'association-policy.json', ledger: 'owner-ledger-2026.csv', violations: 'violations-2026.csv', as_of: '2026-11-15' };
  const a = await rt.call('coral_check', f);
  printStep('Check Cedar Ridge owner accounts and violations against the association policy', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.id.padEnd(6)} ${String(i.unit).padEnd(4)} ${i.status.padEnd(10)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain account A-102 (three months unpaid)', await rt.call('coral_explain', { ...f, id: 'A-102' }));
  printStep('Read a Spanish community ledger (Propietario, Vivienda, Concepto, Cargo, Abono)', await rt.call('coral_check', { policy: 'exports/comunidad-policy.json', ledger: 'exports/cuotas-comunidad-es.csv', as_of: '2026-11-15' }));
  printStep('Write the worklist', await rt.call('coral_write_report', f));
  const d = await rt.call('coral_draft_notice', { ...f, id: 'A-102', pay_by: '2026-11-30', pay_to: 'the owner portal', from: 'Dana Manager (fictional)' });
  printStep('Draft a statement-of-account reminder to Ben Ortiz', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('coral_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to post a fine itself', await rt.call('post_fine', {}));
}
