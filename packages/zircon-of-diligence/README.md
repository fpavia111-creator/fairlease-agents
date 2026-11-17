# Zircon of Diligence (`zircon-of-diligence`)

Before you buy or lend, reconciles the seller's **rent roll** with their **trailing-twelve-month income statement (T-12)**: scheduled rent against last month's rent income and the year's, physical and economic occupancy, leases that ended but are still listed, occupied units with no rent, T-12 months missing, stale, blank or out of line with the account's typical month, and NOI. Every item is phrased as a question for the seller, and it drafts the list. It never submits an offer or touches a data room.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y zircon-of-diligence demo
npx -y zircon-of-diligence mcp --root ./deal
```

## What it checks

| Finding | Meaning |
|---|---|
| `roll_above_collections` / `collections_above_roll` | Rent roll's monthly scheduled rent against the T-12's rent income for its last month, beyond `gap_tolerance_pct` (default 2) |
| `annualized_vs_t12` (note) | Rent roll × 12 against the T-12's rent income |
| `expired_lease_in_roll`, `occupied_without_rent` | Lease ended before the roll date but listed as occupied; occupied with no rent |
| `rent_above_market`, `future_lease_not_occupied` (notes) | Rent over the roll's own market rent by `above_market_pct`; vacant unit with a future resident |
| `t12_months_missing`, `t12_gap`, `t12_stale`, `rent_account_not_found` | Fewer than 12 months, a hole in the months, ending more than a month before the roll, no rent account recognised |
| `month_outlier` | A month off the account's median by more than `outlier_pct` (default 25) and `outlier_min` (default 500), for accounts with 9+ months |
| `month_blank` | 1 to 3 empty months in an account filled the rest of the year (a missed accrual?) |

T-12 layouts: one row per account with a column per month ("Dec 2025", "2026-01", "Jan-26", "März 2026", "2026年3月"…), or one row per account and month. Total columns and total rows are skipped. Income and expense accounts are told apart by account number prefix (`income_prefixes`, default 4; `expense_prefixes`, default 5–8); the rent account by name in nine languages or `rent_accounts`.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `zircon_check`, `zircon_explain` | read | allow |
| `zircon_write_report` | report: `zircon-diligence.csv` and `.html` (in `--lang`) | allow |
| `zircon_draft_questions` | write: questions for the seller, one per open item | ask |
| `zircon_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `submit_offer`, `data_room_upload`, `email_send` | refused | block |

## Limits

- Zircon compares the seller's files with each other. It does not check them against bank statements, leases or tax returns.
- Not investment, accounting or legal advice.
