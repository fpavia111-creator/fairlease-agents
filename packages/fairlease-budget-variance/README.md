# Fairlease Budget Variance (`fairlease-budget-variance`)

Compares actuals with the budget by account, for the month and the year to date, using **your** management agreement's variance thresholds (a percentage and an amount, both crossed). It flags the variances that need an explanation (favorable and unfavorable, or unfavorable only), money spent on accounts with no budget, expenses heading over the annual budget, and NOI against budget. Explanations you enter are carried into the owner's variance memo, which it drafts. It never changes a budget or posts an entry.

MIT · Node 20 or newer · local files only · no credentials · built on [`fairlease-core`](../fairlease-core)

```bash
npx -y fairlease-budget-variance demo
npx -y fairlease-budget-variance mcp --root ./budget
```

## What it checks

| Finding | Meaning |
|---|---|
| `ptd_variance`, `ytd_variance` | Month or year-to-date variance over `threshold_pct` (default 10) **and** `threshold_amount` (default 1,000); `basis` picks month, year or both |
| `unbudgeted` | Spend on an expense account with no budget (income with no budget is a note) |
| `forecast_over_annual` | Year-to-date actual plus the rest of the year's budget over the annual budget |
| `budget_unused` (note) | Expense budget of at least the threshold amount with nothing recorded |
| `explained` (note) | You entered an explanation for the account in the policy |

If no account has an actual for the month, Fairlease Budget Variance says the month is not closed and compares nothing. Accounts that start with neither an income nor an expense prefix are listed under `unclassified_accounts` and named in the summary, so a chart of accounts with different numbering is not silently skipped.

Budget files: a column per month, or one row per account and month with `budget` (and `actual`). Actuals: a twelve-month income statement or general ledger detail (AppFolio, Yardi, Buildium layouts recognised); income is credit less debit. `fiscal_start_month` sets the year to date. Income and expense accounts are told apart by number prefix.


<!-- generated:start -->

## A demo run

`npx -y fairlease-budget-variance demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairlease Budget Variance demo (fictional property) in <demo folder>

▶ Compare October and year to date against the 2026 budget (10% and 1,000 thresholds)
  status: executed  decision: allow
  2026-10 (year to date from 2026-01): NOI 15432.33 against a budget of 17520 for the month, 164177.3 against 172300 year to date. 2 account(s) need a variance explanation under your 10% and 1000 thresholds, 1 already explained.
    5600 Turnover                   explain   ptd_variance
    5700 Marketing                  explain   ytd_variance, budget_unused
    5000 Repairs and Maintenance    explained ytd_variance, forecast_over_annual, explained
    4300 Other Income               note      unbudgeted

▶ Explain turnover costs
  status: executed  decision: allow
  5600 Turnover (expense): explain. Month 3100 against 1000 (2100); year to date 9450 against 10000 (-550); forecast 11450 against annual 12000. Month: expense over budget by 2100 (210%): actual 3100, budget 1000; unfavorable. Over your 10% and 1000 thresholds.

▶ Read a Japanese budget with actuals (勘定科目コード, 年月, 予算, 実績)
  status: executed  decision: allow
  2026-10 (year to date from 2026-01): NOI 670000 against a budget of 870000 for the month, 1535000 against 1740000 year to date. 1 account(s) need a variance explanation under your 10% and 1000 thresholds.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 2026-10 (year to date from 2026-01): NOI 15432.33 against a budget of 17520 for the month, 164177.3 against 172300 year to date. 2 account(s) need a variance explanation under your 10% and 1000 thresholds, 1 already explained.

▶ Draft the owner's variance memo
  status: executed  decision: allow  (auto)
  memo 2026-10 drafted with 2 open marker(s) ([TO CONFIRM: owner], [TO CONFIRM: explanation of the variance]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to raise the repairs budget itself
  status: blocked  decision: block
  reason: Fairlease Budget Variance never changes the budget in your accounting system; the owner approves budget changes.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `budget_check` | Per account, for the month and year to date: variances over both your percentage and amount thresholds (favorable and unfavorable, or unfavorable only), spend on accounts with no budget, expenses forecast over the ann… | runs |
| `budget_explain` | Show one account's month and year-to-date budget, actual, variance and forecast. | runs |
| `budget_write_report` | Write the budget variance worklist as budget.csv (one row per item, blank decision columns) and budget.html into out_dir (default keystone-out/budget). | runs |
| `budget_draft_memo` | Write drafts/memo-<month>.md: the owner's variance report with NOI and a table of accounts over the thresholds, using the explanations in your policy and [TO CONFIRM] for the rest. | asks first (Auto can be opted in) |
| `budget_request_send` | After one named human click (even in Auto), record that the reviewed memo draft is approved in memo-requests.csv. | one named click, even in Auto (`binding_send`) |
| `budget_update` | Fairlease Budget Variance never changes the budget in your accounting system; the owner approves budget changes. | refused |
| `gl_post` | Fairlease Budget Variance never posts or reclassifies journal entries. | refused |
| `email_send` | Fairlease Budget Variance never sends the memo; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Budget (`budget`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `account` (required) | text | GL Account, Account, Account Number, Account Code, Acct | Konto, Compte, 勘定科目, 科目代码 |
| `account_name` | text | Account Name, Account Description, Description | Kontobezeichnung, Libellé du compte, 勘定科目名, 科目名称 |
| `period` | text | Period, Month, Post Month | Zeitraum, Période, 期間, 期间 |
| `budget` | amount | Budget, Budgeted, Budget Amount, Plan, PTD Budget, YTD Budget | Budget, Budget, 予算, 预算 |
| `actual` | amount | Actual, Actuals, Actual Amount, PTD Actual, YTD Actual | Ist, Réel, 実績, 实际 |

### Actuals (`actuals`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `account` (required) | text | GL Account, Account, Account Number, Account Code, Acct, GL Code | Konto, Compte, 勘定科目, 科目代码 |
| `account_name` | text | Account Name, Account Description, GL Account Name, Description of Account, Acct Name | Kontobezeichnung, Libellé du compte, 勘定科目名, 科目名称 |
| `date` | date | Date, Post Date, Posting Date, Transaction Date, Trans Date | Datum, Date, 日付, 日期 |
| `period` | text | Period, Post Month, Month, Fiscal Period, Accounting Period | Zeitraum, Période, 期間, 期间 |
| `description` | text | Description, Memo, Remarks, Notes, Line Description | Beschreibung, Description, 摘要, 摘要 |
| `vendor` | text | Vendor, Payee, Payee Name, Vendor Name, Person/Company, Name | Lieferant, Fournisseur, 仕入先, 供应商 |
| `debit` | amount | Debit, Debits, Dr | Soll, Débit, 借方, 借方 |
| `credit` | amount | Credit, Credits, Cr | Haben, Crédit, 貸方, 贷方 |
| `amount` | amount | Amount, Net, Net Amount, Total | Betrag, Montant, 金額, 金额 |
| `reference` | text | Reference, Ref, Control, Document, Check #, Invoice | Referenz, Référence, 参照番号, 参考号 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| AppFolio | Reports > General Ledger (CSV or Excel) | GL Account, Payee / Payer, Debit, Credit | no |
| Yardi Voyager | General Ledger detail (Excel) | Account, Account Description, Person/Description, Control | no |
| Buildium | Reports > General ledger (CSV) | Account, Payee, Memo, Debit, Credit | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx fairlease-budget-variance inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairlease-budget-variance demo
npx -y fairlease-budget-variance mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairlease-budget-variance": {
      "command": "npx",
      "args": [
        "-y",
        "fairlease-budget-variance",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairlease-budget-variance -- npx -y fairlease-budget-variance mcp --root .`, or install the `fairlease-budget-variance` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairlease-budget-variance approve <id> --as "Your Name"` (or on the local approvals page, `fairlease-budget-variance approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairlease-budget-variance kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairlease-budget-variance tools                 # every tool, its policy and arguments
fairlease-budget-variance sources               # the columns each input is read from
fairlease-budget-variance inspect <file>        # how a file would be read (names and shapes, never values)
fairlease-budget-variance call budget_check '{"budget":"<budget>"}'
fairlease-budget-variance eval                  # the private eval cases on the fictional fixtures
fairlease-budget-variance demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Fairlease Budget Variance compares figures in your files. It does not know why a variance happened; explanations come from you.
- Not accounting advice.
