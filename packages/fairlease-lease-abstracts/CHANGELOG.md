# Changelog

Renamed from `slate-of-leases` on 18 Nov 2026 (tool names were `slate_*`, now `abstracts_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- "15 March 2025" and "April 1st, 2025" were not read as dates.
- Rent written in words with the figure in brackets, or as "Base Rent of $X per month", was missed.
- A landlord name containing "and" leaked into the tenant name, and the landlord's own suite number could be taken as the premises.
- Any line starting with a number ("100 Example Way") was taken as a section heading, giving wrong citations.
- Free rent from a mid-month start was rounded to a month end.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
