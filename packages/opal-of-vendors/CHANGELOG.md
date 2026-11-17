# Changelog

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- A vendor listed twice had its payments counted twice in "paid while out of compliance".
- A payment and its void were reported as "paid 0 while out of compliance".
- Payees who were paid but are not in the vendor directory at all were invisible (new `unlisted_payees`).
- The auto insurance date was checked but missing from the result row.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Keystone ver 1).
