import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['tourmaline_draft_punchlist'] });
  process.stdout.write(`Tourmaline of Migration demo (fictional property) in ${rt.root}\n`);
  const f = { before: 'rent-roll-old-system.csv', after: 'rent-roll-new-system.csv', policy: 'migration-policy.json' };
  const a = await rt.call('tourmaline_check', f);
  printStep('Compare the old and new systems\' rent rolls at cutover', a);
  for (const i of a.result.items.filter((x) => x.status !== 'ok')) process.stdout.write(`    ${String(i.unit).padEnd(6)} ${i.status.padEnd(8)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  for (const t of a.result.totals.filter((x) => !x.ties)) process.stdout.write(`    total ${t.item.padEnd(15)} old ${String(t.expected).padStart(8)}  new ${String(t.actual).padStart(8)}\n`);
  printStep('Explain unit 103 (deposit dropped a zero)', await rt.call('tourmaline_explain', { ...f, unit: '103' }));
  printStep('Compare two German tenant lists (Whg.-Nr., Kaltmiete, Kaution, Saldo)', await rt.call('tourmaline_check', { before: 'exports/mieterliste-alt-de.csv', after: 'exports/mieterliste-neu-de.csv' }));
  printStep('Write the worklist with the totals', await rt.call('tourmaline_write_report', f));
  const d = await rt.call('tourmaline_draft_punchlist', { ...f, owner: 'the operations director (fictional)', by: '2026-11-08', from: 'Dana Manager (fictional)' });
  printStep('Draft the punch list for the implementation team', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('tourmaline_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to sign off go-live itself', await rt.call('approve_go_live', {}));
}
