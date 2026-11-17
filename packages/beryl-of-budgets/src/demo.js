import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'keystone-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['beryl_draft_memo'] });
  process.stdout.write(`Beryl of Budgets demo (fictional property) in ${rt.root}\n`);
  const f = { budget: 'budget-2026.csv', actuals: 'actuals-t12-2026-11.csv', policy: 'budget-policy.json', as_of: '2026-11-15' };
  const a = await rt.call('beryl_check', f);
  printStep('Compare October and year to date against the 2026 budget (10% and 1,000 thresholds)', a);
  for (const i of a.result.items.filter((x) => x.status !== 'ok')) process.stdout.write(`    ${i.account} ${i.name.padEnd(26)} ${i.status.padEnd(9)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain turnover costs', await rt.call('beryl_explain', { ...f, account: '5600' }));
  printStep('Read a Japanese budget with actuals (勘定科目コード, 年月, 予算, 実績)', await rt.call('beryl_check', { budget: 'exports/yosan-ja.csv', as_of: '2026-10-31' }));
  printStep('Write the worklist', await rt.call('beryl_write_report', f));
  const d = await rt.call('beryl_draft_memo', { ...f, property: 'Maple Court Apartments (fictional)', from: 'Dana Manager (fictional)' });
  printStep('Draft the owner\'s variance memo', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('beryl_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to raise the repairs budget itself', await rt.call('budget_update', {}));
}
