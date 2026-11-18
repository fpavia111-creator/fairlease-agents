import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairlease-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto' });
  process.stdout.write(`Fairlease Utility Billback demo (fictional 24-unit apartment building) in ${rt.root}\n`);
  const f = { bills: 'bills-2026.csv', occupancy: 'occupancy.csv', rubs: 'rubs.json', billed: 'rubs-billed.csv' };
  const a = await rt.call('utilities_check', f);
  printStep('Re-work three months of water/sewer and trash billbacks and compare with what was billed', a);
  for (const p of a.result.periods) process.stdout.write(`    ${p.utility.padEnd(12)} ${p.from.slice(0, 7)}  bill ${String(p.amount).padStart(8)}  residents ${String(p.residents_share).padStart(8)}  owner ${String(p.owner_share).padStart(7)}  billed ${String(p.billed).padStart(8)}  ${p.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain unit 204 (vacant since September, still billed in November)', await rt.call('utilities_explain', { ...f, unit: '204' }));
  printStep('Split only, from Japanese bills (種別, 開始日, 終了日, 金額)', await rt.call('utilities_check', { bills: 'exports/bills-ja.csv', occupancy: 'occupancy.csv', rubs: 'rubs.json' }));
  printStep('Write the worklist', await rt.call('utilities_write_report', f));
  printStep('Agent tries to post a credit for the duplicate charge itself', await rt.call('post_tenant_charge', {}));
}
