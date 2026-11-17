# Changelog

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- A deposit whose bank trace number differed from the book's receipt number never matched, however exact the amount and date.
- A statement exported newest first gave the oldest row's balance as the closing balance.
- With one negative ledger hidden inside matching totals, the summary still said "All three agree".
- A check that cleared for a different amount was reported as two unrelated items and the whole amount as the difference (now only the difference, `cleared_for_different_amount`).
- A statement whose lines do not get from the opening to the closing balance was not noticed (`statement_does_not_add_up`).

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Keystone ver 1).
