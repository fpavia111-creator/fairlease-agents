// Every named property export layout, read from a sheet built from its own column names:
// under a title block, with the columns in another order. Each must be recognised as itself
// and every column it maps must arrive in the right field.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptRecords, RENT_ROLL_FIELDS, RENT_ROLL_PROFILES, AGING_FIELDS, AGING_PROFILES, LEDGER_FIELDS, LEDGER_PROFILES, GL_FIELDS, GL_PROFILES,
  WORK_ORDER_FIELDS, WORK_ORDER_PROFILES, VENDOR_FIELDS, VENDOR_PROFILES, BOOKING_FIELDS, BOOKING_PROFILES, LEAD_FIELDS, LEAD_PROFILES,
} from '../src/index.js';

const FAMILIES = [
  ['rent_roll', RENT_ROLL_FIELDS, RENT_ROLL_PROFILES], ['aging', AGING_FIELDS, AGING_PROFILES], ['ledger', LEDGER_FIELDS, LEDGER_PROFILES], ['gl', GL_FIELDS, GL_PROFILES],
  ['work_orders', WORK_ORDER_FIELDS, WORK_ORDER_PROFILES], ['vendors', VENDOR_FIELDS, VENDOR_PROFILES], ['bookings', BOOKING_FIELDS, BOOKING_PROFILES], ['leads', LEAD_FIELDS, LEAD_PROFILES],
];
const sample = (type, i) => (type === 'date' ? `2026-03-${String(10 + i).padStart(2, '0')}` : type === 'money' || type === 'amount' || type === 'number' ? String(100 + i) : type === 'yesno' || type === 'boolean' ? 'Yes' : `value ${i}`);
const expected = (type, i) => (type === 'date' ? `2026-03-${String(10 + i).padStart(2, '0')}` : null);

test('there are 25 named property layouts', () => {
  assert.equal(FAMILIES.reduce((n, f) => n + f[2].length, 0), 25);
});

for (const [kind, fields, profiles] of FAMILIES) {
  for (const p of profiles) {
    test(`${p.id}: recognised under a title block with its columns reordered, every column mapped`, () => {
      const entries = Object.entries(p.map).map(([field, col]) => [field, Array.isArray(col) ? col[0] : col]).filter(([, col]) => typeof col === 'string');
      const order = [...entries].reverse();
      const matrix = [[`Example Property Management (fictional) - ${p.id}`, ...order.slice(1).map(() => '')], order.map(() => ''), order.map(([, col]) => col), order.map(([field], i) => sample(fields[field]?.type, i))];
      const { rows, report } = adaptRecords({ format: 'csv', matrix }, { fields, profiles }, { kind });
      assert.equal(report.profile, p.id);
      assert.equal(rows.length, 1);
      order.forEach(([field], i) => {
        assert.ok(String(rows[0][field] ?? '').trim() !== '', `${p.id}: ${field} is empty`);
        const want = expected(fields[field]?.type, i); if (want) assert.equal(rows[0][field], want, `${p.id}: ${field}`);
      });
    });
  }
}
