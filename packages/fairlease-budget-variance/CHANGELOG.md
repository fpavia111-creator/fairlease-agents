# Changelog

Renamed from `beryl-of-budgets` on 18 Nov 2026 (tool names were `beryl_*`, now `budget_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- A month with no actuals on any account is reported as not closed instead of every line being "under budget".
- A variance of 10.0001% was rounded to 10% and missed a 10% threshold; it is now compared before rounding.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
