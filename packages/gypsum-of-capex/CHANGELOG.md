# Changelog

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- "Complete - punch list" and "Closed out" were not read as complete and were reported past their finish date.
- When the Committed column holds the whole contract value, spending was counted twice in the forecast (new policy option `committed_includes_spent`).
- A budget repeated on every cost-code line was silently added up (new `budget_repeated` note).
- 5.004% over a 5% tolerance was rounded to 5.00 and passed.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Keystone ver 1).
