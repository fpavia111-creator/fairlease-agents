# Onyx of Statements (`onyx-of-statements`)

Checks owner statements before they go out: the arithmetic, each beginning balance against the last period's ending, ending balances below the reserve in **your** management agreement or below zero, distributions that left less than the reserve, cash above the reserve that was not distributed, and income, expenses and management fee against the owner ledger. It drafts owner contribution requests for shortfalls. It never pays an owner or publishes a statement.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y onyx-of-statements demo
npx -y onyx-of-statements mcp --root ./statements
```

## What it checks

| Finding | Meaning |
|---|---|
| `math_error` | Beginning + income − expenses − fee − distribution ≠ ending (fee left out when `fee_in_expenses`) |
| `beginning_differs` | Beginning differs from the previous period's ending for the same owner and property |
| `negative_balance` | Ending below zero; the amount owed includes refilling the reserve |
| `distribution_below_reserve`, `reserve_short` | Ending below the reserve after a distribution, or without one |
| `income_differs`, `expenses_differ`, `fee_differs` | Statement totals against the owner ledger for the period |
| `cash_not_distributed`, `owner_contribution`, `no_ledger_detail` (notes) | Cash above reserve + `distribution_min` held back; owner paid in; no ledger lines to check |

Periods are read in any common spelling ("Oct 2026", "10/2026", "2026年10月"). The reserve comes from `policy.reserves` by property name, then `default_reserve`, then the statement's own reserve column.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `onyx_check`, `onyx_explain` | read | allow |
| `onyx_write_report` | report: `onyx-statements.csv` and `.html` (in `--lang`) | allow |
| `onyx_draft_request` | write: owner contribution request for a shortfall | ask |
| `onyx_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `owner_distribution`, `statement_publish`, `gl_post`, `email_send` | refused | block |

## Limits

- Onyx checks figures against each other, the prior period and your owner ledger; it does not see the bank.
- Not accounting or legal advice.
