import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['talc_draft_statement'] });
  process.stdout.write(`Talc of Overage demo (fictional shopping center) in ${rt.root}\n`);
  const f = { leases: 'leases.json', sales: 'sales-2025.csv', year: 2025, billed: 'billed-2025.csv', as_of: '2026-06-30' };
  const a = await rt.call('talc_check', f);
  printStep('Work out 2025 percentage rent for three retail tenants', a);
  for (const i of a.result.items) process.stdout.write(`    ${i.lease_id} ${i.tenant.padEnd(22)} net sales ${String(i.net_sales).padStart(12)}  breakpoint ${String(i.breakpoint).padStart(12)}  earned ${String(i.owed ?? '-').padStart(9)}  ${i.status}\n`);
  printStep('Explain Evergreen Grocers (fixed breakpoint, monthly estimates billed, a late report)', await rt.call('talc_explain', { ...f, tenant: 'Evergreen' }));
  printStep('Read a Japanese sales report (対象月, 売上高, 控除額)', await rt.call('talc_explain', { ...f, sales: 'exports/sales-ja.csv', as_of: '2025-04-30', tenant: 'L-101' }));
  printStep('Write the worklist', await rt.call('talc_write_report', f));
  const to = 'Evergreen Grocers Ltd, Suite 140, Harbor Point Plaza (fictional)';
  const d = await rt.call('talc_draft_statement', { ...f, tenant: 'L-105', to, from: 'Dana Manager, Example Property Co (fictional)', due_note: 'Payable within 30 days of this statement.' });
  printStep('Draft Evergreen Grocers\' statement (Auto is opted in for drafts here)', d);
  printStep('Draft a request for Fable Books\' missing October report', await rt.call('talc_draft_statement', { ...f, tenant: 'L-106' }));
  const send = { draft: d.result.draft, draft_sha256: d.result.draft_sha256, to };
  const s = await rt.call('talc_request_send', send);
  printStep('Auto: approve sending the statement, which stays one click', s);
  rt.approvals.approve(s.approval_id, 'Dana Manager (fictional)');
  printStep('Same call after the human click (recorded; a person sends it)', await rt.call('talc_request_send', send));
  printStep('Agent tries to invoke the lease audit right itself', await rt.call('start_sales_audit', {}));
  process.stdout.write(`\nAudit log: ${rt.stateDir}/audit.jsonl\n`);
}
