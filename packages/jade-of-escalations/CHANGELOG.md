# Changelog

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- Rent billed after the lease ended was labelled "billed during free rent" (new `billed_outside_term`).
- With the same unit number in two properties and no lease id, charges went to the first lease found.
- A rent line whose charge code is a GL account number was skipped, although its description said "Base rent".
- A payment line coded as rent could be counted as billing.
- The month's rent charged twice was only "overbilled" (new `billed_twice`).

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Keystone ver 1).
