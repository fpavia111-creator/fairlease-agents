# Changelog

Renamed from `malachite-of-recerts` on 18 Nov 2026 (tool names were `malachite_*`, now `recerts_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- A next-due date never moved forward after the last certification made a freshly certified household "overdue".
- A household marked "Moved out" was still reported overdue.
- A market unit written "Apt 110" in the rent roll was not skipped and came back as untracked.
- A notice already recorded was put on the calendar again.
- Unit 101 in two properties was checked against the wrong property's rent roll row.
- The same unit on two tracker rows, and a last certification dated in the future, were not pointed out.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
