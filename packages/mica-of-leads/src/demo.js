import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['mica_draft_followup'] });
  process.stdout.write(`Mica of Leads demo (fictional prospects) in ${rt.root}\n`);
  const f = { leads: 'guest-cards-2026-11.csv', policy: 'lead-policy.json', as_of: '2026-11-15' };
  const a = await rt.call('mica_check', f);
  printStep('Check six weeks of guest cards against response and follow-up targets', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.id.padEnd(8)} ${i.stage.padEnd(9)} ${i.status.padEnd(7)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  for (const s of a.result.sources) process.stdout.write(`    ${s.source.padEnd(15)} ${String(s.count).padStart(2)} leads, ${String(s.leases)} leased${s.cost_per_lease !== null ? `, ${s.cost_per_lease} per lease` : ''}${s.note ? ` (${s.note})` : ''}\n`);
  printStep('Explain GC-1009 (approved, no lease)', await rt.call('mica_explain', { ...f, id: 'GC-1009' }));
  printStep('Read a Spanish lead export (Interesado, Origen, Fecha de contacto)', await rt.call('mica_check', { leads: 'exports/interesados-es.csv', as_of: '2026-11-15' }));
  printStep('Write the worklist with the source table', await rt.call('mica_write_report', f));
  const d = await rt.call('mica_draft_followup', { ...f, id: 'GC-1009', from: 'Dana, leasing office (fictional)' });
  printStep('Draft a follow-up to Ivy Grant (approved, no lease yet)', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('mica_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to decide an application itself', await rt.call('decide_application', {}));
}
