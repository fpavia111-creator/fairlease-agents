# Changelog

## Ver 2 review (unreleased)

Every agent was re-read against its domain by hand. Fixed:

- A T-12 with account names only (no account numbers), the way most sellers send one, read as empty or as zero income.
- Subtotal lines could be counted as accounts.
- When the last month had no rent posted at all, the largest possible gap was not reported.
- Gross potential rent was compared with the rent roll without taking off vacancy, loss to lease and concessions, and deductions exported as positive numbers were added to income.
- Fourteen month columns were all summed into the "T-12".
- The duplicate-unit check could never fire, and would have flagged the same unit number in two buildings (now counts current lines per building).
- A lease starting after the roll date, or a move-out already passed, was counted as paying rent without a word (new `lease_not_started`, `moved_out_in_roll`).

Added: eight hand-written domain tests (`test/domain.test.js`), edge-case fixtures and eval cases for the fixes above.

## 0.1.0 (unreleased)

- First version (Keystone ver 1).
