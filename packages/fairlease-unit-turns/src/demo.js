import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairlease-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto' });
  process.stdout.write(`Fairlease Unit Turns demo (fictional apartment building) in ${rt.root}\n`);
  const f = { turns: 'turns-2026.csv', policy: 'turn-policy.json', as_of: '2026-11-15' };
  const a = await rt.call('turns_check', f);
  printStep('Check five turns against a 7-day target and budgets by bedroom count', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.unit} ${i.stage.padEnd(12)} ${String(i.days_to_ready).padStart(3)} days  cost ${String(i.cost).padStart(7)}  budget ${String(i.budget).padStart(6)}  ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain unit 204 (still open after 46 days)', await rt.call('turns_explain', { ...f, unit: '204' }));
  printStep('Read Italian turn lines (Unità, Data uscita, Costo)', await rt.call('turns_check', { ...f, turns: 'exports/turns-it.csv' }));
  printStep('Write the worklist', await rt.call('turns_write_report', f));
  printStep('Agent tries to dispatch the flooring vendor itself', await rt.call('vendor_dispatch', {}));
}
