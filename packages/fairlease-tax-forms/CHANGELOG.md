# Changelog

Renamed from `pearl-of-filings` on 18 Nov 2026 (tool names were `pearl_*`, now `filings_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- The same payment twice in the file silently inflated the total (new `possible_duplicate_payments`).
- "Lease commissions" was read as rent and suggested 1099-MISC for a broker.
- A payee paid both rent and services got one form with no word about the split (new `rent_and_services`).
- Two directory records with the same name and different tax IDs: all payments went to the first with no warning.
- Payments with no payee became one nameless payee row.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- Renamed from `fairlease-1099-filings`, because npm does not accept that name. What the agent does, its tools and its report files are unchanged.
- First version (Fairlease ver 1).
