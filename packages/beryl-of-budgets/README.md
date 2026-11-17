# Beryl of Budgets (`beryl-of-budgets`)

Compares actuals with the budget by account, for the month and the year to date, using **your** management agreement's variance thresholds (a percentage and an amount, both crossed). It flags the variances that need an explanation (favorable and unfavorable, or unfavorable only), money spent on accounts with no budget, expenses heading over the annual budget, and NOI against budget. Explanations you enter are carried into the owner's variance memo, which it drafts. It never changes a budget or posts an entry.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y beryl-of-budgets demo
npx -y beryl-of-budgets mcp --root ./budget
```

## What it checks

| Finding | Meaning |
|---|---|
| `ptd_variance`, `ytd_variance` | Month or year-to-date variance over `threshold_pct` (default 10) **and** `threshold_amount` (default 1,000); `basis` picks month, year or both |
| `unbudgeted` | Spend on an expense account with no budget (income with no budget is a note) |
| `forecast_over_annual` | Year-to-date actual plus the rest of the year's budget over the annual budget |
| `budget_unused` (note) | Expense budget of at least the threshold amount with nothing recorded |
| `explained` (note) | You entered an explanation for the account in the policy |

Budget files: a column per month, or one row per account and month with `budget` (and `actual`). Actuals: a twelve-month income statement or general ledger detail (AppFolio, Yardi, Buildium layouts recognised); income is credit less debit. `fiscal_start_month` sets the year to date. Income and expense accounts are told apart by number prefix.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `beryl_check`, `beryl_explain` | read | allow |
| `beryl_write_report` | report: `beryl-budget.csv` and `.html` (in `--lang`) | allow |
| `beryl_draft_memo` | write: owner's variance memo with NOI and accounts over the thresholds | ask |
| `beryl_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `budget_update`, `gl_post`, `email_send` | refused | block |

## Limits

- Beryl compares figures in your files. It does not know why a variance happened; explanations come from you.
- Not accounting advice.
