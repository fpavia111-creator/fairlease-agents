import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairlease-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)), { mode: 'auto', autoActions: ['recerts_draft_reminder'] });
  process.stdout.write(`Fairlease Affordable Recerts demo (fictional households) in ${rt.root}\n`);
  const f = { tracker: 'recert-tracker-2026.csv', policy: 'recert-policy.json', rent_roll: 'rent-roll-2026-11.csv', as_of: '2026-11-15' };
  const a = await rt.call('recerts_check', f);
  printStep('Check the recertification tracker against the schedule in the policy file', a);
  for (const i of a.result.items) process.stdout.write(`    ${String(i.unit).padEnd(4)} ${i.household.padEnd(30)} ${String(i.next_due || '').padEnd(10)} ${i.status.padEnd(9)} ${i.findings.map((x) => x.code).join(', ')}\n`);
  printStep('Explain unit 106 (no last certification on file)', await rt.call('recerts_explain', { ...f, household: '106' }));
  printStep('Read a Japanese public housing income report list (世帯, 前回申告日, 次回申告期限)', await rt.call('recerts_check', { tracker: 'exports/shuunyuu-shinkoku-ja.csv', policy: 'exports/koei-policy.json', as_of: '2026-11-15' }));
  printStep('Write the worklist', await rt.call('recerts_write_report', f));
  printStep('Write the calendar (.ics)', await rt.call('recerts_calendar', f));
  const d = await rt.call('recerts_draft_reminder', { ...f, household: '107', from: 'Willow Gardens office (fictional), Mon to Fri 9 to 5' });
  printStep('Draft a reminder to the Brooks household (due in 25 days)', d);
  printStep('Auto: approve sending it, which stays one click', await rt.call('recerts_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 }));
  printStep('Agent tries to certify a household itself', await rt.call('certify_household', {}));
}
