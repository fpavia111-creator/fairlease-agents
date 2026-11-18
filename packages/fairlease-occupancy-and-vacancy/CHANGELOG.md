# Changelog

Renamed from `shale-of-vacancy` on 18 Nov 2026 (tool names were `shale_*`, now `vacancy_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- A unit on notice that was already re-leased was counted as exposure.
- An occupied unit with zero rent was only a "below market, look at it at renewal" note.
- A tenant still on notice after the move-out date was not pointed out.
- A concession exported as a positive number was subtracted as a negative concession.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
