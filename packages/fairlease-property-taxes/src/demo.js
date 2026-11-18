import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairlease-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto' });
  process.stdout.write(`Fairlease Property Taxes demo (fictional parcels) in ${rt.root}\n`);
  const f = { taxes: 'tax-bills-2026.csv', policy: 'tax-policy.json', as_of: '2026-11-15' };
  const a = await rt.call('taxes_check', f);
  printStep('Check four parcels: assessments, appeal deadlines you entered, installments', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.parcel.padEnd(15)} ${String(i.change_pct ?? '').padStart(6)}% ${i.status.padEnd(9)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain the plaza parcel (assessment up 21.57%)', await rt.call('taxes_explain', { ...f, parcel: '14-22-301-001' }));
  printStep('Read a French taxe foncière file (Parcelle, Valeur locative cadastrale, Échéance)', await rt.call('taxes_check', { taxes: 'exports/taxe-fonciere-fr.csv', as_of: '2026-11-15' }));
  printStep('Write the worklist', await rt.call('taxes_write_report', f));
  printStep('Write the calendar (.ics)', await rt.call('taxes_calendar', f));
  printStep('Agent tries to file the appeal itself', await rt.call('file_tax_appeal', {}));
}
