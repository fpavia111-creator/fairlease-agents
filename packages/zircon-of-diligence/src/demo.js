import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['zircon_draft_questions'] });
  process.stdout.write(`Zircon of Diligence demo (fictional seller files) in ${rt.root}\n`);
  const f = { rent_roll: 'rent-roll-2026-11.csv', t12: 't12-2026-11.csv', as_of: '2026-11-15' };
  const a = await rt.call('zircon_check', f);
  printStep('Reconcile a 24-unit rent roll with a 12-month income statement', a);
  for (const i of a.result.items.filter((x) => x.status !== 'ok')) process.stdout.write(`    ${i.area.padEnd(15)} ${i.title.padEnd(28)} ${i.status.padEnd(6)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain the reconciliation', await rt.call('zircon_explain', { ...f, subject: 'reconciliation' }));
  printStep('Read a Spanish T-12, one row per account and month (Cuenta, Periodo, Importe)', await rt.call('zircon_check', { ...f, t12: 'exports/t12-es.csv' }));
  printStep('Write the worklist', await rt.call('zircon_write_report', f));
  const d = await rt.call('zircon_draft_questions', { ...f, property: 'Maple Court Apartments (fictional)', reply_by: '2026-11-24', from: 'Dana Buyer (fictional)' });
  printStep('Draft questions for the seller', d);
  printStep('Auto: approve sending them, which stays one click', await rt.call('zircon_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to submit the offer itself', await rt.call('submit_offer', {}));
}
