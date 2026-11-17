import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['pearl_draft_request'] });
  process.stdout.write(`Pearl of Filings demo (fictional payees) in ${rt.root}\n`);
  const f = { payments: 'payments-2026.csv', vendors: 'vendors-2026.csv', tax_year: 2026, threshold: 2000 };
  const a = await rt.call('pearl_check', f);
  printStep('Total 2026 payments per payee against a 2000 threshold given by the tax preparer', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.payee.padEnd(26)} ${String(i.total).padStart(7)} ${(i.form ? `1099-${i.form}` : '').padEnd(10)} ${i.status.padEnd(16)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain FlowRight (two directory records, one tax ID)', await rt.call('pearl_explain', { ...f, payee: 'FlowRight Plumbing LLC' }));
  printStep('Read a Spanish payment file and directory (Beneficiario, Importe, Forma de pago)', await rt.call('pearl_check', { payments: 'exports/pagos-proveedores-es.csv', vendors: 'exports/proveedores-es.csv', tax_year: 2026, threshold: 2000 }));
  printStep('Write the worklist', await rt.call('pearl_write_report', f));
  const d = await rt.call('pearl_draft_request', { ...f, payee: 'Volt Electric', payer: 'Maple Court Holdings LLC (fictional)', reply_by: '2027-01-08', secure_channel: '[secure upload link]', from: 'Dana Manager (fictional)' });
  printStep('Draft a W-9 request to Volt Electric (no tax ID on file)', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('pearl_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to file the 1099s itself', await rt.call('file_1099', {}));
}
