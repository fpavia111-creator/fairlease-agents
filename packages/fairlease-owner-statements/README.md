# Fairlease Owner Statements (`fairlease-owner-statements`)

Checks owner statements before they go out: the arithmetic, each beginning balance against the last period's ending, ending balances below the reserve in **your** management agreement or below zero, distributions that left less than the reserve, cash above the reserve that was not distributed, and income, expenses and management fee against the owner ledger. It drafts owner contribution requests for shortfalls. It never pays an owner or publishes a statement.

MIT · Node 20 or newer · local files only · no credentials · built on [`fairlease-core`](../fairlease-core)

```bash
npx -y fairlease-owner-statements demo
npx -y fairlease-owner-statements mcp --root ./statements
```

## What it checks

| Finding | Meaning |
|---|---|
| `math_error` | Beginning + income − expenses − fee − distribution ≠ ending (fee left out when `fee_in_expenses`) |
| `beginning_differs` | Beginning differs from the previous period's ending for the same owner and property |
| `negative_balance` | Ending below zero; the amount owed includes refilling the reserve |
| `distribution_below_reserve`, `reserve_short` | Ending below the reserve after a distribution, or without one |
| `income_differs`, `expenses_differ`, `fee_differs`, `distribution_differs` | Statement totals against the owner ledger for the period. Distributions and owner contributions in the ledger are money to and from the owner, not expenses or income |
| `period_missing`, `duplicate_statement` | A month with no statement between two others (the beginning balance is then not checked against an older ending); the same period twice in the file |
| `fee_rate_differs` | With `fee_pct` in the policy: the management fee is not that share of income |
| `cash_not_distributed`, `owner_contribution`, `no_ledger_detail` (notes) | Cash above reserve + `distribution_min` held back; owner paid in; no ledger lines to check |

Exports that show money out as negative numbers are read that way round when the statement only adds up so. Periods are read in any common spelling ("Oct 2026", "10/2026", "2026年10月"). The reserve comes from `policy.reserves` by property name, then `default_reserve`, then the statement's own reserve column.


<!-- generated:start -->

## A demo run

`npx -y fairlease-owner-statements demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairlease Owner Statements demo (fictional owners) in <demo folder>

▶ Check three owners' statements, August to October
  status: executed  decision: allow
  3 statement(s) for 2026-10, 9 in all: 3 to fix before sending (1 math, 1 beginning balance, 1 negative, 1 not matching the ledger). Earlier periods: 1 with issues.
    2026-10 Harbor Point Plaza       issue  math_error, no_ledger_detail
    2026-10 Maple Court Apartments   issue  cash_not_distributed, expenses_differ
    2026-10 Pine Street Duplex       issue  beginning_differs, negative_balance, no_ledger_detail
    2026-09 Maple Court Apartments   issue  distribution_below_reserve

▶ Explain the Harbor Point statement
  status: executed  decision: allow
  Harbor Point Owner LLC (fictional), Harbor Point Plaza, 2026-10: issue. Beginning 60725 + income 121000 − expenses 44100 − fee 6050 − distribution 70000 → ending 61675 (reserve 25000). Beginning 60725 + income 121000 − expenses 44100 − fee 6050 − distribution 70000 = 61575, but the statement shows 61675 (100). No owner ledger lines for 2026-10; totals not checked.

▶ Read Spanish owner statements (Saldo inicial, Honorarios de gestión, Saldo final)
  status: executed  decision: allow
  1 statement(s) for 2026-10, 2 in all: 1 to fix before sending (0 math, 0 beginning balance, 0 negative, 0 not matching the ledger). Earlier periods: 0 with issues.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 3 statement(s) for 2026-10, 9 in all: 3 to fix before sending (1 math, 1 beginning balance, 1 negative, 1 not matching the ledger). Earlier periods: 1 with issues.

▶ Draft a contribution request to Pine Street Partners
  status: executed  decision: allow  (auto)
  request Pine Street Duplex drafted with 2 open marker(s) ([TO CONFIRM: owner email], [TO CONFIRM: payment instructions; confirm by phone before you share bank details]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to pay Maple Court's October distribution itself
  status: blocked  decision: block
  reason: Fairlease Owner Statements never pays or holds an owner distribution.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `statements_check` | Each owner statement before it goes out: the arithmetic, beginning against last period's ending, ending below the reserve or negative, distributions that left less than the reserve, cash above the reserve not distribu… | runs |
| `statements_explain` | Show one owner's latest statement line by line with findings. | runs |
| `statements_write_report` | Write the owner statement worklist as statements.csv (one row per item, blank decision columns) and statements.html into out_dir (default keystone-out/statements). | runs |
| `statements_draft_request` | Write drafts/request-<property>.md: an owner contribution request for a negative balance or a reserve shortfall on the latest statement. | asks first (Auto can be opted in) |
| `statements_request_send` | After one named human click (even in Auto), record that the reviewed request draft is approved in request-requests.csv. | one named click, even in Auto (`binding_send`) |
| `owner_distribution` | Fairlease Owner Statements never pays or holds an owner distribution. | refused |
| `statement_publish` | Fairlease Owner Statements never publishes statements to the owner portal; a person does after review. | refused |
| `gl_post` | Fairlease Owner Statements never posts corrections to your books. | refused |
| `email_send` | Fairlease Owner Statements never sends requests; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Owner statements (`statements`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `owner` (required) | text | Owner, Owner Name, Owners, Investor | Verantwortlich, Responsable, 担当者, 负责人 |
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `period` | text | Period, Statement Period, Month, Statement Month | Zeitraum, Période, 期間, 期间 |
| `beginning_balance` | amount | Beginning Balance, Beginning Cash, Opening Balance, Starting Balance, Anfangsbestand, Solde initial | - |
| `income` | amount | Income, Total Income, Cash In, Receipts, Rent Collected, Einnahmen | - |
| `expenses` | amount | Expenses, Total Expenses, Cash Out, Disbursements, Ausgaben, Dépenses | - |
| `management_fee` | amount | Management Fee, Management Fees, Mgmt Fee, Property Management Fee, Verwaltungsgebühr, Verwaltervergütung | - |
| `owner_draw` | amount | Owner Draw, Owner Distribution, Distribution, Owner Disbursement, Contributions/Distributions, Owner Payment | - |
| `reserve` | amount | Reserve, Property Reserve, Operating Reserve, Held Reserve, Rücklage, Réserve | - |
| `ending_balance` | amount | Ending Balance, Ending Cash, Closing Balance, Ending Cash Balance, Endbestand, Solde final | - |

### Owner ledger (`ledger`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `owner` (required) | text | Owner, Owner Name, Owners, Payee, Investor | Verantwortlich, Responsable, 担当者, 负责人 |
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `date` | date | Date, Post Date, Transaction Date | Datum, Date, 日付, 日期 |
| `type` | text | Type, Transaction Type, Category, Account Type | Typ, Type, 種類, 类型 |
| `account` | text | GL Account, Account, Account Name | Konto, Compte, 勘定科目, 科目代码 |
| `description` | text | Description, Memo, Notes | Beschreibung, Description, 摘要, 摘要 |
| `amount` | amount | Amount, Net Amount, Total | Betrag, Montant, 金額, 金额 |
| `income` | amount | Income, Cash In, Receipts, Deposits, Einnahmen, Recettes | - |
| `expense` | amount | Expense, Expenses, Cash Out, Disbursements, Bills Paid, Ausgaben | - |
| `reference` | text | Reference, Ref, Check #, Check Number | Referenz, Référence, 参照番号, 参考号 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx fairlease-owner-statements inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairlease-owner-statements demo
npx -y fairlease-owner-statements mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairlease-owner-statements": {
      "command": "npx",
      "args": [
        "-y",
        "fairlease-owner-statements",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairlease-owner-statements -- npx -y fairlease-owner-statements mcp --root .`, or install the `fairlease-owner-statements` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairlease-owner-statements approve <id> --as "Your Name"` (or on the local approvals page, `fairlease-owner-statements approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairlease-owner-statements kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairlease-owner-statements tools                 # every tool, its policy and arguments
fairlease-owner-statements sources               # the columns each input is read from
fairlease-owner-statements inspect <file>        # how a file would be read (names and shapes, never values)
fairlease-owner-statements call statements_check '{"statements":"<statements>"}'
fairlease-owner-statements eval                  # the private eval cases on the fictional fixtures
fairlease-owner-statements demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Fairlease Owner Statements checks figures against each other, the prior period and your owner ledger; it does not see the bank.
- Not accounting or legal advice.
