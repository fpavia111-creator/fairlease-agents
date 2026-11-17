# Pearl of Filings (`pearl-of-filings`)

Gets year-end 1099s for vendors and owners ready. It totals each payee's payments for the tax year, leaves out the payment methods you exclude (card and payment apps by default), and compares each total with **the threshold you give it**. It flags what would stop a form going out: a missing or malformed tax ID, no mailing address, no W-9, several directory records on one tax ID, and payees who are not in the directory at all. It drafts W-9 requests. Tax IDs are always masked. It never files anything.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y pearl-of-filings demo
npx -y pearl-of-filings mcp --root ./year-end
```

## What it checks

| Finding | Meaning |
|---|---|
| `tin_missing`, `tin_invalid` | No tax ID, or one that fails the format check (not nine digits, or a placeholder like 000000000) |
| `address_missing`, `w9_missing` | No mailing address, or the directory says no W-9 is on file |
| `shared_tin` | Several directory records carry one tax ID; their payments are added together for the threshold |
| `payee_not_in_directory` | Paid, but nowhere in the vendor directory |
| `directory_says_no_1099` | The directory says no 1099, but the payee is over your threshold |
| `attorney`, `corporation` | Looks like a law firm or a corporation; confirm with your tax preparer |
| `excluded_methods` | Payments by an excluded method, shown and left out of the total |

Status is `fix`, `confirm`, `ready`, `below_threshold` or `excluded_only`. The suggested form is 1099-MISC for rents paid to owners (owner trade or rent accounts) and 1099-NEC otherwise; it is a suggestion for your preparer, not a determination.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `pearl_check`, `pearl_explain` | read | allow |
| `pearl_write_report` | report: `pearl-1099.csv` and `.html` (in `--lang`) | allow |
| `pearl_draft_request` | write: a W-9 request listing exactly what is missing; never contains a tax ID | ask |
| `pearl_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `file_1099`, `tin_match_submit`, `backup_withholding_start`, `email_send` | refused | block |

`threshold` and `tax_year` are required. Pearl has no built-in threshold, because the amount depends on the tax year and on rules your preparer applies. AppFolio and Buildium vendor directories are recognised; Spanish headers such as Beneficiario, Importe, Forma de pago or Número de identificación fiscal are read. `pearl-of-filings inspect <file>` shows how a file's columns were matched.

## Limits

- Pearl totals your payment file and checks tax IDs for format only. It does not verify a tax ID with the IRS, decide whether a payee or payment is reportable, or file anything.
- Not tax or legal advice. Confirm forms, amounts and thresholds with your tax preparer.
