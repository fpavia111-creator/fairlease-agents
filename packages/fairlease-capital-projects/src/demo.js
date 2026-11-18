import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairlease-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['capex_draft_request'] });
  process.stdout.write(`Fairlease Capital Projects demo (fictional projects) in ${rt.root}\n`);
  const f = { projects: 'capex-projects-2026.csv', policy: 'capex-policy.json', as_of: '2026-11-15' };
  const a = await rt.call('capex_check', f);
  printStep('Check eight capital projects against budget, schedule and reserves', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.project_id.padEnd(5)} ${i.project.padEnd(28)} ${i.state.padEnd(6)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  for (const r of a.result.reserves) process.stdout.write(`    reserve ${r.funding}: ${r.detail}\n`);
  printStep('Explain the roof replacement', await rt.call('capex_explain', { ...f, project: 'P-01' }));
  printStep('Read a Japanese project list (工事名, 予算, 発注残, 実績)', await rt.call('capex_check', { projects: 'exports/koji-ja.csv', as_of: '2026-11-15' }));
  printStep('Write the worklist', await rt.call('capex_write_report', f));
  const d = await rt.call('capex_draft_request', { ...f, project: 'P-01', new_budget: 195000, reason: 'Deck rot found under the membrane on the east side; change order CO-3 attached (fictional).', from: 'Dana Manager (fictional)' });
  printStep('Draft a budget change request for the roof', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('capex_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to approve the change order itself', await rt.call('approve_change_order', {}));
}
