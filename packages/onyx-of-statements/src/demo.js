import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['onyx_draft_request'] });
  process.stdout.write(`Onyx of Statements demo (fictional owners) in ${rt.root}\n`);
  const f = { statements: 'owner-statements-2026.csv', ledger: 'owner-ledger-2026-10.csv', policy: 'statement-policy.json' };
  const a = await rt.call('onyx_check', f);
  printStep('Check three owners\' statements, August to October', a);
  for (const i of a.result.items.filter((x) => x.status !== 'ok')) process.stdout.write(`    ${i.period} ${i.property.padEnd(24)} ${i.status.padEnd(6)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain the Harbor Point statement', await rt.call('onyx_explain', { ...f, owner: 'Harbor Point Plaza' }));
  printStep('Read Spanish owner statements (Saldo inicial, Honorarios de gestión, Saldo final)', await rt.call('onyx_check', { statements: 'exports/liquidaciones-es.csv', policy: 'statement-policy.json' }));
  printStep('Write the worklist', await rt.call('onyx_write_report', f));
  const d = await rt.call('onyx_draft_request', { ...f, owner: 'Pine Street Duplex', reason: 'October water heater replacement, 1,180 (fictional).', due: '2026-11-25', from: 'Dana Manager (fictional)' });
  printStep('Draft a contribution request to Pine Street Partners', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('onyx_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to pay Maple Court\'s October distribution itself', await rt.call('owner_distribution', {}));
}
