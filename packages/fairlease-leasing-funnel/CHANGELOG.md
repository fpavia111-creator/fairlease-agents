# Changelog

Renamed from `mica-of-leads` on 18 Nov 2026 (tool names were `mica_*`, now `leads_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- Two different people with the same name were merged into one lead even when their emails differed.
- A walk-in who toured with no "first response" logged was reported as "no response" and counted as not answered.
- A response dated before the lead came in counted as an instant answer and pulled the median down.
- Spend entered under an alias name was listed as "spend with no leads" instead of going to its source.
- "N/A" as a lost reason passed as a reason; a lead dated in the future was judged for response time.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
