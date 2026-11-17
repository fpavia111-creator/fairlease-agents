# Changelog

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- A resident whose name contains "vacant" or "libre" (Joe Vacanti) was read as a vacant unit.
- A vacant unit with the next lease already signed ("Vacant Rented") was reported as not listed; it is now `leased`, and an ad still running is `listed_but_leased`.
- A unit with status "Notice" and no move-out date was treated as occupied, so its listing was called a mistake.
- Model, down and employee units were reported as vacant and not listed.
- A listing with a zero or blank price was reported as 100% under market.
- The correction draft now finds the unit however it is written.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Keystone ver 1).
