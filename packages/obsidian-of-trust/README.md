# Obsidian of Trust (`obsidian-of-trust`)

Three-way reconciliation of a trust (escrow) bank account at the statement end: the **bank** balance adjusted for deposits in transit and outstanding checks, against the **book** register, against the total of **owner and tenant ledgers**. It lists bank items missing from the book (fees, returned payments), checks outstanding past your stale limit, deposits recorded but never banked, entries that look doubled, and negative ledgers where one client's money is covering another's. It never moves money, voids a check or posts an entry.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y obsidian-of-trust demo
npx -y obsidian-of-trust mcp --root ./trust
```

## What it checks

| Finding | Meaning |
|---|---|
| `bank_book_difference` | Adjusted bank against book, with how much is explained by bank items missing from the book |
| `book_ledger_difference` | Book against the sum of owner and tenant ledgers |
| `bank_item_not_in_book`, `returned_item_not_in_book` | On the statement, not in the register (fees, interest, NSF returns in nine languages) |
| `stale_check` | Outstanding longer than `stale_check_days` (default 90) |
| `old_deposit_in_transit` | Recorded more than `transit_days` (default 5) before the end and not banked |
| `possible_duplicate` | Same reference and amount as an entry that cleared |
| `negative_ledger` | An owner or tenant ledger below zero |
| `cleared_after_end` (note), `ledgers_missing` (note) | Cleared after the statement end; no ledgers, so two-way only |

Matching: same amount, same check number or reference when both have one, otherwise the nearest bank date within `match_days` (default 10). Registers use deposit/payment columns; set `book_debit_is_deposit` for a cash ledger in debit/credit form.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `obsidian_check`, `obsidian_explain` | read | allow |
| `obsidian_write_report` | report: `obsidian-trust.csv` and `.html` (in `--lang`) | allow |
| `transfer_funds`, `void_check`, `gl_post` | refused | block |

## Limits

- Obsidian reconciles the files you give it; it does not connect to a bank.
- The trust accounting rules that apply to you come from your licensing authority. Not legal or accounting advice.
