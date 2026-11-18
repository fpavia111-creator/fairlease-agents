import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairlease-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto' });
  process.stdout.write(`Fairlease Rent Roll Audit demo (fictional shopping center) in ${rt.root}\n`);
  const f = { rent_roll: 'rent-roll-2026-01.csv', leases: 'leases.json', as_of: '2026-01-31', indexes: 'indexes.json' };
  const a = await rt.call('rentroll_check', f);
  printStep('Check the January 2026 rent roll against six leases', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.unit.padEnd(10)} ${String(i.tenant).padEnd(22)} ${String(i.rent_roll_rent ?? '').padStart(9)} ${String(i.lease_rent ?? '').padStart(9)}  ${i.status.padEnd(6)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain Suite 110 (a rent step the rent roll missed)', await rt.call('rentroll_explain', { ...f, unit: 'Suite 110' }));
  printStep('Read a Yardi rent roll that lists charges row by row', await rt.call('rentroll_check', { ...f, rent_roll: 'exports/yardi-rent-roll-charges.csv' }));
  printStep('Learn that charge code MERCH (merchants association dues) counts as CAM (waits for a person)', await rt.call('rentroll_learn', { kind: 'charge_code_kind', value: { code: 'MERCH', kind: 'cam' } }));
  printStep('Read a German rent roll (Objekt, Einheit, Nettokaltmiete)', await rt.call('rentroll_check', { ...f, rent_roll: 'exports/rent-roll-de.csv' }));
  printStep('Write the worklist', await rt.call('rentroll_write_report', f));
  printStep('Agent tries to fix the rent in the system itself', await rt.call('pm_system_update', {}));
}
