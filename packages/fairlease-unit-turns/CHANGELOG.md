# Changelog

Renamed from `basalt-of-turns` on 18 Nov 2026 (tool names were `basalt_*`, now `turns_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- A turn over the default budget is no longer described as an "undefined-bedroom" unit.
- The same unit number in two properties is two turns.
- A cost line with no dates joins the turn above it instead of becoming a turn with no move-out.
- Ready or move-in dates before the move-out are reported and no longer give negative days or negative rent lost.
- "Tenant" and "Resident" in the chargeable column count as chargeable; an unknown word is no longer read as "no".

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
