# Changelog

Renamed from `topaz-of-utilities` on 18 Nov 2026 (tool names were `topaz_*`, now `utilities_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- A unit written `Unit 101` on one row and `101` on another became two units, each with its own vacancy.
- Two tenancies on the same days (roommates) made the unit count twice (now shared, with `overlapping_tenancies`).
- "gas" matched "Vegas" and a parking or rent line that mentioned a utility word was counted as a utility charge.
- A payment line could count as a charge.
- The same bill in two exports was split twice.
- Two accounts of one utility for the same period took all the charges on one bill and showed "not billed" on the other (now one bill to split).
- A bill whose period ended before it started, or an unreadable one, could capture the charges and then be skipped.
- A zero bill produced an "Infinity%" spike and an unprintable recovery rate.
- Bills and charges of other properties were mixed in when the files carry a property column.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
