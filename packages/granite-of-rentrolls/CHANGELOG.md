# Changelog

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- "Total", "Subtotal" and "Grand Total" rows were counted as occupied units with no lease, and their sums added to the rent roll total.
- Roommates listed together ("Ann Example, Bob Sample") were reported as a tenant mismatch.
- An occupied unit whose lease starts later was reported as having no lease at all (`lease_not_started`).

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Keystone ver 1).
