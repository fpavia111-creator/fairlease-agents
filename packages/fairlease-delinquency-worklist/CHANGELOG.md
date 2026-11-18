# Changelog

Renamed from `quartz-of-delinquency` on 18 Nov 2026 (tool names were `quartz_*`, now `delinquency_*`).

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- A "returned payment" line with an NSF code was read as a late fee far above policy instead of a reversed payment, and NSF fees were judged against the late fee limit.
- Without a leases file, "Apt 101 / AIKO TANAKA" and "101 / Aiko Tanaka" became two tenants, one owing and one in credit.
- With both a percentage and a maximum, the late fee limit used the maximum only.
- A payment plan for a named tenant also paused reminders for anyone else in that unit; an ended plan was silently ignored (new `payment_plan_ended`).

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Fairlease ver 1).
