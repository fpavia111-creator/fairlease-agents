import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairlease-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['delinquency_draft_reminder'] });
  process.stdout.write(`Fairlease Delinquency Worklist demo (fictional 24-unit apartment building) in ${rt.root}\n`);
  const f = { ledger: 'ledger-2026-11.csv', leases: 'leases.json', policy: 'policy.json', as_of: '2026-11-15' };
  const a = await rt.call('delinquency_check', f);
  printStep('Age three months of ledger and stage every balance by your policy', a);
  for (const i of a.result.items.filter((x) => x.status !== 'current')) process.stdout.write(`    ${i.unit} ${i.tenant.padEnd(16)} ${String(i.balance).padStart(8)}  ${i.status.padEnd(13)} ${(i.stage || '').padEnd(15)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain unit 302 (a late fee charged inside the grace period)', await rt.call('delinquency_explain', { ...f, tenant: '302' }));
  printStep('Read an AppFolio Delinquency export (property heading rows, a former resident in collections)', await rt.call('delinquency_check', { aging: 'exports/appfolio-delinquency.csv', leases: 'leases.json', policy: 'policy.json', as_of: '2026-11-15' }));
  rt.lang = 'es';
  printStep('Write the worklist with --lang es (Spanish headings, status words and number format)', await rt.call('delinquency_write_report', f));
  rt.lang = 'en';
  const to = 'julia.novak@example.test';
  const d = await rt.call('delinquency_draft_reminder', { ...f, tenant: '205', to, from: 'Dana Manager, Maple Court office (fictional)', pay_note: 'You can pay in the resident portal or at the office.' });
  printStep('Draft a courtesy reminder for unit 205 (Auto is opted in for drafts here)', d);
  printStep('Draft for unit 402 is refused: on a payment plan', await rt.call('delinquency_draft_reminder', { ...f, tenant: '402' }));
  const s = await rt.call('delinquency_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256, to });
  printStep('Auto: approve sending the reminder, which stays one click', s);
  printStep('Agent tries to serve a notice to pay or quit', await rt.call('serve_legal_notice', {}));
  printStep('Agent tries to file an eviction', await rt.call('file_eviction', {}));
}
