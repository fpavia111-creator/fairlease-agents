# Changelog

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- One unit written two ways ("Suite 101" on the rent roll, "0101" on the inspection) appeared twice.
- "N/A" was reported as a condition Flint could not understand.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Keystone ver 1).
