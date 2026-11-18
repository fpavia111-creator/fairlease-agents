# Changelog

Renamed from `marble-of-cam` on 18 Nov 2026 (tool names were `marble_*`, now `cam_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- With several properties in one leases file or GL export, the other properties' leases and expenses were reconciled against this property.
- A tenant with both an expense stop and a cap could get a negative charge (the cap was taken off after the stop had already reduced the amount to near zero).
- Two tenants who followed one another in the same suite were added together and reported as shares over 100%.
- An excluded pool written with different capitals ("real estate TAXES") was not excluded.
- Billed estimates were missed when the lease id was typed differently or the charge code was a GL number, and a payment line coded CAM could count as a charge.
- A GL account listed in two pools was silently counted in the first one only.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
