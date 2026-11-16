import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto' });
  process.stdout.write(`Jade of Escalations demo (fictional shopping center) in ${rt.root}\n`);
  const f = { leases: 'leases.json', ledger: 'rent-charges-2025.csv', from: '2025-01', to: '2026-01', indexes: 'indexes.json' };
  const a = await rt.call('jade_check', f);
  printStep('Check 13 months of rent charges against six escalation schedules', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.lease_id} ${i.tenant.padEnd(22)} expected ${String(i.expected_total).padStart(10)}  billed ${String(i.billed_total).padStart(10)}  ${String(i.net_difference).padStart(9)}  ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain Cobalt Fitness (CPI escalation with a 2% floor and 4% cap)', await rt.call('jade_explain', { ...f, lease: 'Cobalt Fitness' }));
  printStep('Read a French ledger (Bail, Lot, Loyer, 2 704,00)', await rt.call('jade_check', { ...f, ledger: 'exports/ledger-fr.csv', from: '2025-06', to: '2025-07' }));
  printStep('Rent changes in the next 120 days, as a calendar file', await rt.call('jade_upcoming', { leases: 'leases.json', indexes: 'indexes.json', as_of: '2026-01-15' }));
  printStep('Write the worklist', await rt.call('jade_write_report', f));
  printStep('Agent tries to bill the missed escalation itself', await rt.call('post_tenant_charge', {}));
}
