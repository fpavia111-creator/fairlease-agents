# Changelog

Renamed from `talc-of-overage` on 18 Nov 2026 (tool names were `talc_*`, now `overage_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- A lease id typed differently in the sales or billing file (`l101`, `L 101`) matched no lease.
- Exclusions exported as negative numbers were added to sales instead of taken off.
- With no report deadline in the lease, months that had not ended yet were called missing.
- A revised report made an on-time month "late".
- Exclusions larger than the month's sales passed silently (new `exclusions_exceed_sales`, review).
- A payment line coded as percentage rent could count as billed.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
