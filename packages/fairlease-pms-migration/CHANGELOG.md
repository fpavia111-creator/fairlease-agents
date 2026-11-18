# Changelog

Renamed from `tourmaline-of-migration` on 18 Nov 2026 (tool names were `tourmaline_*`, now `migration_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- With two buildings that share unit numbers, units were paired in file order whenever the new system spelled the building differently ("Maple Court" and "The Maple Court Apartments"), so Oak 101 could be compared with Maple 101, and a building that did not come over could push its namesake unit to "missing".
- "Rivera, Ana" against "Ana Rivera" was reported as a changed tenant on every unit.
- A unit keyed twice in the new system was merged silently (new `listed_twice_in_new` / `listed_twice_in_old`).
- A future resident's row listed first replaced the current resident in the comparison.
- "B-201" against "B201" was only a "same number" suggestion.
- A dropped co-tenant now says which name carried over.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
