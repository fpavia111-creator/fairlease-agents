# Chert of Taxes (`chert-of-taxes`)

Tracks property tax by parcel and year: assessed value against the prior year, the appeal deadline **you entered** from the notice, and each installment billed and paid. It flags assessments up more than your review threshold (and says so when no deadline is on file), deadlines and installments coming up, and installments overdue, short or overpaid. It writes a calendar (.ics) of what is still owed and the deadlines you entered. It never works out a deadline, files an appeal or pays a bill.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y chert-of-taxes demo
npx -y chert-of-taxes mcp --root ./taxes
```

## What it checks

| Finding | Meaning |
|---|---|
| `assessment_jump` | Latest year's assessed value up more than `appeal_review_pct` (default 10) from the prior value or last year's row |
| `appeal_deadline_unknown` | A jump with no appeal deadline in the file or the policy; Chert never computes one |
| `appeal_deadline_soon` (due soon), `appeal_deadline_passed` (note) | Deadline you entered is within `due_soon_days` (default 30), or passed after a jump |
| `installment_overdue`, `installment_short` | Past the due date with nothing paid, or less than billed (beyond `tolerance`) |
| `installment_due_soon`, `installment_overpaid` | Due within `due_soon_days`; paid more than billed |

Deadlines in `policy.appeal_deadlines` (per parcel) win over the file. Several rows per parcel and year are read as installments.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `chert_check`, `chert_explain` | read | allow |
| `chert_write_report` | report: `chert-taxes.csv` and `.html` (in `--lang`) | allow |
| `chert_calendar` | report: `chert-calendar.ics` plus `.csv`/`.html` | allow |
| `file_tax_appeal`, `pay_tax`, `gl_post` | refused | block |

## Limits

- Chert uses only values and dates in your files; nothing is looked up. Every deadline comes from you.
- Whether to appeal is for you and your tax advisor. Not tax or legal advice.
