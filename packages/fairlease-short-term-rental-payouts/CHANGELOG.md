# Changelog

Renamed from `lapis-of-payouts` on 18 Nov 2026 (tool names were `lapis_*`, now `payouts_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- A long stay paid in equal instalments was reported as a duplicate payout.
- A payroll "DIRECT DEPOSIT" on the bank statement was reported as a direct-booking deposit with no payout.
- Channel words matched inside other words.
- Loading two exports that overlap doubled every booking and payout in the overlap.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
