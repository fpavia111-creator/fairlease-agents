import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep, AgentRuntime } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['marble_draft_statement'] });
  process.stdout.write(`Marble of CAM demo (fictional shopping center, tenants and ledger) in ${rt.root}, Auto mode on\n`);
  const f = { leases: 'leases.json', cam: 'cam-2025.json', gl: 'gl-2025.csv', billed: 'cam-billed-2025.csv' };
  const a = await rt.call('marble_check', f);
  printStep('Reconcile 2025 CAM for six tenants', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.lease_id} ${i.tenant.padEnd(22)} ${String(i.share_pct).padStart(5)}%  due ${String(i.total_due).padStart(10)}  billed ${String(i.billed).padStart(9)}  ${i.direction.padEnd(16)} ${String(Math.abs(i.balance)).padStart(9)}  ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain Acme Bagels (cumulative 5% cap on controllable expenses)', await rt.call('marble_explain', { ...f, tenant: 'Acme Bagels' }));
  const learn = await rt.call('marble_learn', { kind: 'account_pool', value: { account: '6150', pool: 'Common area (fixed)' }, note: 'Irrigation repairs will post to 6150 from next year (fictional).' });
  printStep('Propose that GL 6150 belongs in a pool (waits for a person)', learn);
  const de = new AgentRuntime(manifest, { root: rt.root, stateDir: rt.stateDir, lang: 'de' });
  printStep('Write the worklist in German (--lang de)', await de.call('marble_write_report', f));
  const d = await rt.call('marble_draft_statement', { ...f, tenant: 'L-101', to: 'Acme Bagels LLC, 1 Fictional Rd, Springfield', from: 'Dana Manager, Example Property Co (fictional)', due_note: 'Payable within 30 days of this statement.' });
  printStep('Draft the statement for Acme Bagels (Auto is opted in for drafts here)', d);
  const send = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, to: 'Acme Bagels LLC, 1 Fictional Rd, Springfield' };
  const s = await rt.call('marble_request_send', send);
  printStep('Auto: approve sending the statement, which stays one click', s);
  rt.approvals.approve(s.approval_id, 'Dana Manager (fictional)');
  printStep('Same call after the human click (recorded; a person sends it)', await rt.call('marble_request_send', send));
  printStep('Agent tries to post the charge itself', await rt.call('post_tenant_charge', {}));
  process.stdout.write(`\nAudit log: ${rt.stateDir}/audit.jsonl\n`);
}
