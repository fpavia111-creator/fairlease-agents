# Changelog

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- A credit balance on the ledger was silently dropped instead of going back to the tenant (new `credit_balance`).
- In a one-column ledger, a payment written as a positive amount was added to the balance instead of taken off.
- With two move-outs from one unit, a deduction with no tenant name was charged to both (new `deduction_tenant_assumed`).
- The same deduction entered twice was not pointed out (new `duplicate_deduction`).
- A move-in date after the move-out produced negative interest (new `dates_out_of_order`).
- A deposit already returned was still held in review for a missing forwarding address.

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Keystone ver 1).
