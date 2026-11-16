import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['flint_draft_notice'] });
  process.stdout.write(`Flint of Inspections demo (fictional units) in ${rt.root}\n`);
  const f = { inspections: 'inspections-2026.csv', policy: 'inspection-policy.json', rent_roll: 'rent-roll-2026-11.csv', work_orders: 'work-orders.csv', as_of: '2026-11-15' };
  const a = await rt.call('flint_check', f);
  printStep('Check 24 units: annual schedule, move-out against move-in, poor items followed up', a);
  for (const i of a.result.items.filter((x) => x.status !== 'ok')) process.stdout.write(`    ${String(i.unit).padEnd(5)} ${(i.tenant || (i.vacant ? '(vacant)' : '')).padEnd(18)} ${i.status.padEnd(9)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain unit 204 (move-out against move-in)', await rt.call('flint_explain', { ...f, unit: '204' }));
  printStep('Read a German inspection export (Einheit, Raum, Bauteil, Zustand, Einzug/Auszug)', await rt.call('flint_check', { inspections: 'exports/begehung-de.csv', policy: 'inspection-policy.json', as_of: '2026-11-15' }));
  printStep('Write the worklist', await rt.call('flint_write_report', f));
  const d = await rt.call('flint_draft_notice', { ...f, unit: '106', when: '2026-11-20, 10:00 to 12:00', from: 'Dana Manager (fictional)' });
  printStep('Draft a notice of entry for unit 106 (annual inspection overdue)', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('flint_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to charge the former resident of 204 for the carpet', await rt.call('post_tenant_charge', {}));
}
