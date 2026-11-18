# Changelog

Renamed from `pyrite-of-fees` on 18 Nov 2026 (tool names were `pyrite_*`, now `fees_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- Bank, permit and association fees paid to third parties were reported as manager fees "not in the agreement".
- The same leasing or renewal fee charged twice passed when each one matched the agreement.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
