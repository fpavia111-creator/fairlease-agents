# Changelog

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- A lease already renewed in the lease file was still chased as "offer overdue".
- The first offer in the file was used instead of the latest, and an offer from the previous term counted for this one.
- The status "Renewal notice sent" was read as the tenant giving notice to vacate.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Keystone ver 1).
