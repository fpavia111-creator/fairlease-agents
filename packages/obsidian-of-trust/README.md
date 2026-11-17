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
| `negative_ledgers` | On the three-way line: the account is not reconciled while any ledger is negative, even when the totals agree |
| `cleared_for_different_amount` | A check or deposit cleared for another amount than the book has; only the difference is carried |
| `statement_does_not_add_up` | With `bank_opening_balance`: opening plus the lines does not reach the closing balance, so lines may be missing from the export |
| `cleared_after_end` (note), `ledgers_missing` (note) | Cleared after the statement end; no ledgers, so two-way only |

Matching: same amount, same check number or reference when both have one, otherwise the nearest bank date within `match_days` (default 10). "Check No. 001042", "CHK #1042" and "1042" are one reference. A deposit still matches when the bank's trace number is not the book's receipt number; two different check numbers are never matched to each other. The closing balance is read from the latest day, whichever way the statement is sorted. Registers use deposit/payment columns; set `book_debit_is_deposit` for a cash ledger in debit/credit form.


<!-- generated:start -->

## A demo run

`npx -y obsidian-of-trust demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Obsidian of Trust demo (fictional trust account) in <demo folder>

▶ Three-way reconciliation at 2026-10-31
  status: executed  decision: allow
  Trust account at 2026-10-31: bank 58846 + deposits in transit 1850 − outstanding checks 3405 = 57291; book 58666; ledgers 58666. Not reconciled. Adjusted bank 57291 against book 58666: -1375, all of it bank items missing from the book. 2 bank item(s) not in the book, 1 stale check(s), 1 negative ledger(s).
    three_way           three-way                              -1375  bank_book_difference
    bank_not_in_book                                           -1350  returned_item_not_in_book
    bank_not_in_book                                             -25  bank_item_not_in_book
    ledger              Pine Street Partners (fictional)        -350  negative_ledger
    outstanding_check   2150                                     -95  stale_check
    outstanding_check   2202                                    -210  possible_duplicate
    outstanding_check   2204                                   -3100  
    deposit_in_transit  DEP-1004                                1850  

▶ Explain check 2202 (entered twice?)
  status: executed  decision: allow
  outstanding check 2202 2026-10-07 Volt Electric (fictional) -210: issue. Same reference 2202 and amount as an entry on 2026-10-06 that cleared; it may be entered twice.

▶ Read a German bank export (Buchungstag, Verwendungszweck, Betrag)
  status: executed  decision: allow
  Trust account at 2026-10-31: bank 58846 + deposits in transit 1850 − outstanding checks 3405 = 57291; book 58666. Not reconciled. Adjusted bank 57291 against book 58666: -1375, all of it bank items missing from the book. 2 bank item(s) not in the book, 1 stale check(s), 0 negative ledger(s).

▶ Write the reconciliation
  status: executed  decision: allow
  Worklist written (en): Trust account at 2026-10-31: bank 58846 + deposits in transit 1850 − outstanding checks 3405 = 57291; book 58666; ledgers 58666. Not reconciled. Adjusted bank 57291 against book 58666: -1375, all of it bank items missing from the book. 2 bank item(s) not in the book, 1 stale check(s), 1 negative ledger(s).

▶ Agent tries to move money to cover the negative owner ledger
  status: blocked  decision: block
  reason: Obsidian never moves money between trust, operating or owner accounts.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `obsidian_check` | Three-way reconciliation at the statement end: bank balance adjusted for deposits in transit and outstanding checks, against the book balance, against the total of owner and tenant ledgers. | runs |
| `obsidian_explain` | Show one reconciling item or the three-way totals. | runs |
| `obsidian_write_report` | Write the three-way reconciliation as obsidian-trust.csv (one row per item, blank decision columns) and obsidian-trust.html into out_dir (default keystone-out/obsidian). | runs |
| `transfer_funds` | Obsidian never moves money between trust, operating or owner accounts. | refused |
| `void_check` | Obsidian never voids or reissues a check; stale checks follow your unclaimed property rules. | refused |
| `gl_post` | Obsidian never posts adjusting entries to your books. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Bank statement (`bank`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `date` (required) | date | Date, Posting Date, Post Date, Transaction Date, Value Date, Buchungstag | Datum, Date, 日付, 日期 |
| `description` | text | Description, Details, Memo, Payee, Transaction Description | Beschreibung, Description, 摘要, 摘要 |
| `amount` | amount | Amount, Transaction Amount, Net Amount | Betrag, Montant, 金額, 金额 |
| `debit` | amount | Debit, Withdrawal, Withdrawals, Money Out, Payment, Payments | Ausgang, Débit, 出金, 支出 |
| `credit` | amount | Credit, Deposit, Deposits, Money In, Receipts | Eingang, Crédit, 入金, 收入 |
| `reference` | text | Reference, Check Number, Check #, Ref, Bank Reference, Check No | Referenz, Référence, 参照番号, 参考号 |
| `balance` | amount | Balance, Running Balance, Running Bal. | Saldo, Solde, 残高, 余额 |

### Book register (`book`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `date` (required) | date | Date, Posting Date, Post Date, Transaction Date, Value Date, Buchungstag | Datum, Date, 日付, 日期 |
| `description` | text | Description, Details, Memo, Payee, Transaction Description | Beschreibung, Description, 摘要, 摘要 |
| `amount` | amount | Amount, Transaction Amount, Net Amount | Betrag, Montant, 金額, 金额 |
| `debit` | amount | Debit, Withdrawal, Withdrawals, Money Out, Payment, Payments | Ausgang, Débit, 出金, 支出 |
| `credit` | amount | Credit, Deposit, Deposits, Money In, Receipts | Eingang, Crédit, 入金, 收入 |
| `reference` | text | Reference, Check Number, Check #, Ref, Bank Reference, Check No | Referenz, Référence, 参照番号, 参考号 |
| `balance` | amount | Balance, Running Balance, Running Bal. | Saldo, Solde, 残高, 余额 |

### Owner and tenant ledgers (`ledgers`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `party` (required) | text | Owner, Owner Name, Tenant, Resident, Name, Party | - |
| `type` | text | Type, Ledger Type, Fund, Category, Account Type, Art | Typ, Type, 種類, 类型 |
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `balance` (required) | amount | Balance, Ending Balance, Cash Balance, Funds Held, Deposits Held, Owner Funds | Saldo, Solde, 残高, 余额 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx obsidian-of-trust inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y obsidian-of-trust demo
npx -y obsidian-of-trust mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "obsidian-of-trust": {
      "command": "npx",
      "args": [
        "-y",
        "obsidian-of-trust",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add obsidian-of-trust -- npx -y obsidian-of-trust mcp --root .`, or install the `obsidian-of-trust` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `obsidian-of-trust approve <id> --as "Your Name"` (or on the local approvals page, `obsidian-of-trust approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`obsidian-of-trust kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
obsidian-of-trust tools                 # every tool, its policy and arguments
obsidian-of-trust sources               # the columns each input is read from
obsidian-of-trust inspect <file>        # how a file would be read (names and shapes, never values)
obsidian-of-trust call obsidian_check '{"bank":"<bank>","book":"<book>","policy":"<policy>"}'
obsidian-of-trust eval                  # the private eval cases on the fictional fixtures
obsidian-of-trust demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Obsidian reconciles the files you give it; it does not connect to a bank.
- The trust accounting rules that apply to you come from your licensing authority. Not legal or accounting advice.
