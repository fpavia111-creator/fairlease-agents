# Changelog

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- An owner who bought part-way through the year was reported as missing every assessment before the purchase.
- Per-unit amounts and repeat violations now match "Unit 12" with "12", and one unit written two ways is one account.
- A violation closed before it was opened is reported.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Keystone ver 1).
