import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairlease-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['coi_draft_request'] });
  process.stdout.write(`Fairlease Tenant Insurance demo (fictional tenants) in ${rt.root}\n`);
  const f = { leases: 'leases.json', certificates: 'certificates-2026.csv', as_of: '2026-11-15' };
  const a = await rt.call('coi_check', f);
  printStep('Check the retail leases in force against their certificate log', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.unit.padEnd(10)} ${i.tenant.padEnd(24)} ${i.status.padEnd(9)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain Suite 120 (limits below the lease)', await rt.call('coi_explain', { ...f, unit: 'Suite 120' }));
  printStep('Read a Spanish renters insurance log (Unidad, Aseguradora, Responsabilidad, Vencimiento)', await rt.call('coi_check', { leases: 'maple-leases.json', certificates: 'exports/seguros-inquilinos-es.csv', as_of: '2026-11-15' }));
  printStep('Write the worklist', await rt.call('coi_write_report', f));
  const d = await rt.call('coi_draft_request', { ...f, unit: 'Suite 140', holder: 'Harbor Point Owner LLC (fictional)', reply_by: '2026-11-30', from: 'Dana Manager (fictional)' });
  printStep('Draft a certificate request to Fairstay Grocers', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('coi_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to buy cover and charge the tenant itself', await rt.call('force_place_insurance', {}));
}
