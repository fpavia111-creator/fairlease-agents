import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto' });
  process.stdout.write(`Agate of Work Orders demo (fictional apartment building) in ${rt.root}\n`);
  const f = { work_orders: 'work-orders-appfolio.csv', policy: 'workorder-policy.json', as_of: '2026-11-15' };
  const a = await rt.call('agate_check', f);
  printStep('Age 20 work orders from an AppFolio export against your targets', a);
  for (const i of a.result.items.filter((x) => x.status === 'issue')) process.stdout.write(`    ${i.work_order} unit ${i.unit.padEnd(4)} ${i.priority.padEnd(7)} ${String(i.days_open).padStart(3)} days  ${i.findings.map((x) => x.code).join(', ')}\n`);
  process.stdout.write('    Vendor scorecard:\n'); for (const v of a.result.vendors) process.stdout.write(`      ${v.vendor.padEnd(32)} ${v.count} orders, ${v.on_time_pct ?? '-'}% on time, avg ${v.average_days ?? '-'} days\n`);
  printStep('Explain 4104 (a ceiling leak filed as normal)', await rt.call('agate_explain', { ...f, work_order: '4104' }));
  printStep('Read German orders (Auftragsnummer, Einheit, Priorität, "tropft")', await rt.call('agate_check', { work_orders: 'exports/auftraege-de.csv', as_of: '2026-11-15' }));
  printStep('Write the worklist', await rt.call('agate_write_report', f));
  printStep('Agent tries to dispatch a plumber itself', await rt.call('vendor_dispatch', {}));
}
