# Changelog

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- An estoppel from someone other than the tenant on the lease is now a discrepancy (`tenant_differs`).
- A lease id is matched whatever its case.
- A tenant saying "none" when the lease file has amendments is flagged (`amendment_not_confirmed`).
- Month-to-month holdover tenants were left out of the estoppel list.
- A signature dated in the future is questioned.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Keystone ver 1).
