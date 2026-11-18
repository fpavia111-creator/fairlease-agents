import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairlease-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['vendors_draft_request'] });
  process.stdout.write(`Fairlease Vendor Compliance demo (fictional vendors) in ${rt.root}\n`);
  const f = { vendors: 'vendor-directory-appfolio.csv', requirements: 'vendor-requirements.json', payments: 'payments-2026.csv', as_of: '2026-11-15' };
  const a = await rt.call('vendors_check', f);
  printStep('Check eight vendors from an AppFolio vendor directory against your requirements', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.vendor.padEnd(32)} ${i.tax_id.padEnd(11)} ${i.status.padEnd(9)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain QuickFix HVAC (paid after its liability insurance expired)', await rt.call('vendors_explain', { ...f, vendor: 'QuickFix' }));
  printStep('Read a Portuguese vendor list (Fornecedor, CNPJ, Licença vence)', await rt.call('vendors_check', { ...f, vendors: 'exports/fornecedores-pt.csv', payments: undefined }));
  printStep('Write the worklist', await rt.call('vendors_write_report', f));
  const d = await rt.call('vendors_draft_request', { ...f, vendor: 'QuickFix HVAC (fictional)', company: 'Example Property Co (fictional)', reply_by: '2026-11-30', from: 'Dana Manager (fictional)' });
  printStep('Draft a certificate request to QuickFix HVAC', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('vendors_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to put a payment on hold itself', await rt.call('approve_invoice', {}));
}
