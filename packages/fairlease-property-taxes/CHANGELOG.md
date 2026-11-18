# Changelog

Renamed from `chert-of-taxes` on 18 Nov 2026 (tool names were `chert_*`, now `taxes_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- Tax years written "FY2026" or "2026/2027" were all read as "no year" and merged into one row; they are now read as 2026.
- An unpaid amount with no due date is flagged (`due_date_missing`).
- A rise of 10.00002% was rounded to 10% and missed a 10% review threshold.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
