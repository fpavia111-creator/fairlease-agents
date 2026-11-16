import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['jasper_draft_statement'] });
  process.stdout.write(`Jasper of Deposits demo (fictional apartment building) in ${rt.root}\n`);
  const f = { move_outs: 'move-outs.json', deductions: 'deductions.csv', leases: 'leases.json', ledger: 'final-ledger.csv', as_of: '2026-11-15' };
  const a = await rt.call('jasper_check', f);
  printStep('Check three move-outs against a 30-day rule', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.unit} ${i.tenant.padEnd(12)} deposit ${String(i.deposit).padStart(7)}  deductions ${String(i.deducted).padStart(7)}  refund ${String(i.refund).padStart(7)}  ${i.status.padEnd(8)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain unit 204 (carpet prorated for age, a full repaint flagged, deadline passed)', await rt.call('jasper_explain', { ...f, unit: '204' }));
  printStep('Read German deduction lines (Einheit, Position, Betrag, Belege)', await rt.call('jasper_check', { ...f, deductions: 'exports/deductions-de.csv' }));
  printStep('Write the worklist', await rt.call('jasper_write_report', f));
  const d = await rt.call('jasper_draft_statement', { ...f, unit: '305', from: 'Dana Manager, Maple Court office (fictional)', payment_note: 'The refund is mailed by check within the deadline.' });
  printStep('Draft the itemised statement for unit 305 (Auto is opted in for drafts here)', d);
  const s = await rt.call('jasper_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 });
  printStep('Auto: approve sending the statement, which stays one click', s);
  printStep('Agent tries to pay the refund itself', await rt.call('issue_refund', {}));
}
