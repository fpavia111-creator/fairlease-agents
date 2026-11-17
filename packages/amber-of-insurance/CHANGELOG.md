# Changelog

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- Limits written "$1M", "2MM" or "500K" are read as amounts instead of as missing cover.
- A lease id is matched whatever its case or spacing.
- A certificate that names someone other than the tenant is flagged (`insured_name_differs`).

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Keystone ver 1).
