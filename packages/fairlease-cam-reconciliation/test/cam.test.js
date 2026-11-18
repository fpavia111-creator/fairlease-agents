import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from 'fairlease-core';
import { manifest, reconcile, poolTotals, acctCode } from '../src/index.js';

const fx = fileURLToPath(new URL('../fixtures', import.meta.url));
const leases = JSON.parse(readFileSync(join(fx, 'leases.json'), 'utf8'));
const cam = JSON.parse(readFileSync(join(fx, 'cam-2025.json'), 'utf8'));
const gl = (rows) => rows.map(([account, amount]) => ({ account, amount: String(amount) }));
const one = (lease, extra = {}) => ({ leases: [{ lease_id: 'T1', unit: '1', tenant: 'T', start: '2025-01-01', end: '2029-12-31', sqft: 4000, ...lease }], ...extra });

test('account codes are read from "code - name" labels', () => {
  assert.equal(acctCode('6600 - Property insurance'), '6600'); assert.equal(acctCode(' 6100.10 Landscaping'), '6100.10'); assert.equal(acctCode(''), '');
});

test('excluded and unmapped accounts never reach a pool; wildcards match', () => {
  const r = poolTotals(gl([['6100', 100], ['7000', 50], ['9999', 7], ['6201', 3]]), { ...cam, pools: [...cam.pools, { name: 'Wild', accounts: ['62*'] }] });
  assert.equal(r.pools.find((p) => p.name === 'Wild').total, 3);
  assert.deepEqual(r.unmapped.map((u) => u.account), ['9999']); assert.equal(r.excluded[0].amount, 50);
});

test('debit minus credit is used when there is no amount column', () => {
  const r = poolTotals([{ account: '6100', debit: '500', credit: '' }, { account: '6100', debit: '', credit: '120' }], cam);
  assert.equal(r.pools[0].total, 380);
});

test('gross-up only for variable pools and only when the lease allows it', () => {
  const g = gl([['6200', 9000], ['6100', 1000]]);
  const a = reconcile({ leases: one({ cam: { share_pct: 10 } }), cam, gl: g }).items[0];
  const b = reconcile({ leases: one({ cam: { share_pct: 10, gross_up: false } }), cam, gl: g }).items[0];
  assert.equal(a.gross_share, 1050); assert.equal(b.gross_share, 1000);
});

test('a tenant with no share and no area needs review, never ok', () => {
  const r = reconcile({ leases: one({ sqft: undefined }), cam, gl: gl([['6100', 1000]]) });
  assert.equal(r.items[0].status, 'review'); assert.equal(r.items[0].total_due, null);
});

test('part-year tenants pay for the days they occupied', () => {
  const r = reconcile({ leases: one({ start: '2025-07-01', cam: { share_pct: 10 } }), cam, gl: gl([['6100', 36500]]) });
  assert.equal(r.items[0].occupied_days, 184); assert.equal(r.items[0].gross_share, 1840);
});

test('noncumulative cap uses last year\'s capped charge from prior_years', () => {
  const c = { ...cam, prior_years: [{ year: 2024, tenants: { T1: 1000 } }] };
  const r = reconcile({ leases: one({ cam: { share_pct: 10, cap: { pct: 4, type: 'noncumulative' } } }), cam: c, gl: gl([['6100', 20000]]) });
  assert.equal(r.items[0].cap_reduction, 960); assert.equal(r.items[0].total_due, 1040);
});

test('learned account facts join a pool only after acceptance, through the runtime', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cam-')); cpSync(fx, root, { recursive: true });
  const rt = new AgentRuntime(manifest, { root, mode: 'assist' });
  const args = { leases: 'leases.json', cam: 'cam-2025.json', gl: 'gl-2025.csv', billed: 'cam-billed-2025.csv' };
  const before = await rt.call('cam_check', args);
  assert.equal(before.result.unmapped.length, 1);
  const l = await rt.call('cam_learn', { kind: 'account_pool', value: { account: '7200', pool: 'Common area (fixed)' } });
  assert.equal((await rt.call('cam_check', args)).result.unmapped.length, 1, 'a waiting fact changes nothing');
  const acc = { id: l.result.fact.id, decision: 'accept' };
  const ask = await rt.call('cam_accept_learning', acc); assert.equal(ask.status, 'needs_approval');
  rt.approvals.approve(ask.approval_id, 'Dana Reviewer'); assert.equal((await rt.call('cam_accept_learning', acc)).status, 'executed');
  const after = await rt.call('cam_check', args);
  assert.equal(after.result.unmapped.length, 0); assert.equal(after.result.pools[0].total, 150500); assert.deepEqual(after.result.pools[0].learned_accounts, ['7200']);
  assert.equal((await new AgentRuntime(manifest, { root, mode: 'assist', memory: false }).call('cam_check', args)).result.unmapped.length, 1, '--no-memory ignores it');
});

test('the statement draft lists pools and the balance, and send is one click', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cam-')); cpSync(fx, root, { recursive: true });
  const rt = new AgentRuntime(manifest, { root, mode: 'auto', autoActions: ['cam_draft_statement'] });
  const d = await rt.call('cam_draft_statement', { leases: 'leases.json', cam: 'cam-2025.json', gl: 'gl-2025.csv', billed: 'cam-billed-2025.csv', tenant: 'L-103' });
  const text = readFileSync(join(root, d.result.draft), 'utf8');
  assert.match(text, /Credit to you\*\* \| \*\*3266.67/); assert.ok(!/Roof and structure \|/.test(text), 'excluded pool not on the statement');
  assert.equal(d.result.open_markers, 3);
  const s = await rt.call('cam_request_send', { draft: d.result.draft, draft_sha256: d.result.draft_sha256 });
  assert.equal(s.status, 'needs_approval');
});
