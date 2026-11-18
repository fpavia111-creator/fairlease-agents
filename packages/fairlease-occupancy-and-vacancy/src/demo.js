import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairlease-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto' });
  process.stdout.write(`Fairlease Occupancy and Vacancy demo (fictional 24-unit apartment building) in ${rt.root}\n`);
  const f = { rent_roll: 'rent-roll-2026-11.csv', as_of: '2026-11-15' };
  const a = await rt.call('vacancy_check', f);
  printStep('Read an AppFolio rent roll: occupancy, exposure, vacancy loss, loss to lease', a);
  for (const i of a.result.items.filter((x) => x.findings.length)) process.stdout.write(`    ${i.unit} ${i.status.padEnd(14)} market ${String(i.market_rent ?? '-').padStart(6)}  rent ${String(i.rent ?? '-').padStart(6)}  ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain unit 204 (vacant 46 days)', await rt.call('vacancy_explain', { ...f, unit: '204' }));
  printStep('Read a Yardi rent roll with one row per charge (a concession, a VACANT row)', await rt.call('vacancy_check', { ...f, rent_roll: 'exports/yardi-rent-roll-charges.csv' }));
  rt.lang = 'ja';
  printStep('Write the worklist with --lang ja', await rt.call('vacancy_write_report', f));
  rt.lang = 'en';
  printStep('Agent tries to reprice the vacant unit itself', await rt.call('pm_system_update', {}));
}
