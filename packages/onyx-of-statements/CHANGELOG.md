# Changelog

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- With a month missing, the beginning balance was compared with the ending from two months back and reported wrong (new `period_missing`).
- The same statement twice in the file was reported as a beginning balance that does not roll (new `duplicate_statement`).
- Exports that show expenses and fees as negative numbers failed the math on every line.
- No check that the management fee is the agreed share of income (new optional `fee_pct`).

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Keystone ver 1).
