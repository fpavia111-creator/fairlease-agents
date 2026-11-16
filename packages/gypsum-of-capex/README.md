# Gypsum of Capex (`gypsum-of-capex`)

Tracks capital projects against their approved budget, open commitments, schedule and the reserve that pays for them. It flags projects over budget or heading over once open commitments are counted, spending ahead of the schedule, past their finish date, approved but never started, or closed with commitments still open, and shows whether each reserve covers what is left to spend. It drafts budget change requests to the owner. It never approves a change order, pays an invoice or posts to your books.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y gypsum-of-capex demo
npx -y gypsum-of-capex mcp --root ./capex
```

## What it checks

| Finding | Meaning |
|---|---|
| `over_budget` | Spent more than the budget by over `tolerance_pct` (default 5) |
| `forecast_over` | Spent plus open commitments over the budget by over `tolerance_pct` |
| `spending_ahead` (watch) | Share of budget spent runs `ahead_pct` (default 25) points ahead of the share of the schedule gone |
| `past_finish` | Planned finish passed and the status is not complete |
| `not_started` | Planned start more than `stalled_days` (default 60) ago, nothing spent or committed |
| `open_commitments_after_completion` | Marked complete with commitments still open |
| `no_budget` | No approved budget |
| `below_capitalization_threshold` (note) | Below your `capitalize_min`; the accountant decides |

With `reserves` (balance per funding source) in the policy, each reserve is compared with the remaining budgets of open projects it funds. Several rows per project (for example a job cost export by cost code) are added up. Status words are read in nine languages (Complete, Abgeschlossen, Terminé, 完了…).

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `gypsum_check`, `gypsum_explain` | read | allow |
| `gypsum_write_report` | report: `gypsum-capex.csv` and `.html` with a reserves section (in `--lang`) | allow |
| `gypsum_draft_request` | write: budget change request with the project's figures | ask |
| `gypsum_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `approve_change_order`, `approve_invoice`, `gl_post`, `email_send` | refused | block |

## Limits

- Gypsum adds up the figures in your files. It does not read contracts, bids or invoices.
- Whether a cost is capitalized or expensed is your accountant's decision. Not accounting, tax or legal advice.
