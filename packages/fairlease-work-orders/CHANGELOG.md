# Changelog

Renamed from `agate-of-workorders` on 18 Nov 2026 (tool names were `agate_*`, now `workorders_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- Emergency words match whole words, so "fireplace" is no longer a fire.
- "Non-urgent" is no longer read as an emergency and "Incomplete" is no longer read as closed.
- A closed order with no completed date is no longer aged to today and counted late (`completed_date_missing`).
- A completed date before the created date is reported (`dates_out_of_order`).
- One vendor written two ways ("FlowRight Plumbing", "Flowright Plumbing, LLC") is scored once.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
