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
| `lease_not_started`, `moved_out_in_roll` | Listed as occupied, but the lease starts after the roll date, or the move-out date has passed |
| `duplicate_units` | A unit on more than one current line (future residents and the charge lines of one lease do not count) |
| `accounts_by_name`, `rent_income_net_of`, `t12_extra_months` (notes) | How the T-12 was read: lines without account numbers, gross potential rent taken net of vacancy, loss to lease and concessions, more than twelve month columns |

Sellers' T-12s come as they come. A statement with names only is read by the INCOME and EXPENSES headings its lines sit under (or by their names), subtotals such as Total Income, Effective Gross Income and Net Operating Income are left out, and a title block above the header row is skipped. Vacancy, loss to lease and concessions come off income whichever sign the export gives them. With more than twelve month columns the latest twelve are used. A last month with no rent posted at all is reported as the gap it is.

T-12 layouts: one row per account with a column per month ("Dec 2025", "2026-01", "Jan-26", "März 2026", "2026年3月"…), or one row per account and month. Total columns and total rows are skipped. Income and expense accounts are told apart by account number prefix (`income_prefixes`, default 4; `expense_prefixes`, default 5–8); the rent account by name in nine languages or `rent_accounts`.


<!-- generated:start -->

## A demo run

`npx -y zircon-of-diligence demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Zircon of Diligence demo (fictional seller files) in <demo folder>

▶ Reconcile a 24-unit rent roll with a 12-month income statement
  status: executed  decision: allow
  Rent roll 2026-11-15: 21 of 24 units occupied (87.5%), 35500 a month scheduled. T-12 2025-12 to 2026-11: income 474965, expenses 281958.04, NOI 193006.96. Last month's rent income 33650, 1850 below the roll. 6 item(s) to ask the seller about.
    reconciliation  Rent roll against T-12       issue  roll_above_collections, annualized_vs_t12
    rent_roll       101 Aiko Tanaka              issue  expired_lease_in_roll
    t12             4000 Rental Income           issue  month_outlier
    t12             5000 Repairs and Maintenance issue  month_outlier
    t12             5300 Management Fees         issue  month_outlier
    t12             5400 Insurance               issue  month_blank
    rent_roll       305 Amara Diallo (applicant) note   future_lease_not_occupied
    rent_roll       403 Sam Whitfield            note   rent_above_market

▶ Explain the reconciliation
  status: executed  decision: allow
  Rent roll against T-12 (reconciliation): issue. The rent roll schedules 35500 a month for 21 occupied unit(s); the T-12 shows 33650 of rent income for 2026-11, 1850 (5.21%) less. Ask for the 2026-11 receipts and the delinquency report. Rent roll annualized: 426000; T-12 rent income: 451800 (5.71% below).

▶ Read a Spanish T-12, one row per account and month (Cuenta, Periodo, Importe)
  status: executed  decision: allow
  Rent roll 2026-11-15: 21 of 24 units occupied (87.5%), 35500 a month scheduled. T-12 2026-09 to 2026-11: income 108750, expenses 9250, NOI 99500. Last month's rent income 33650, 1850 below the roll. 3 item(s) to ask the seller about.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): Rent roll 2026-11-15: 21 of 24 units occupied (87.5%), 35500 a month scheduled. T-12 2025-12 to 2026-11: income 474965, expenses 281958.04, NOI 193006.96. Last month's rent income 33650, 1850 below the roll. 6 item(s) to ask the seller about.

▶ Draft questions for the seller
  status: executed  decision: allow  (auto)
  questions Maple Court Apartments (fictional) drafted with 1 open marker(s) ([TO CONFIRM: seller or broker]). Nothing was sent.

▶ Auto: approve sending them, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to submit the offer itself
  status: blocked  decision: block
  reason: Zircon never submits or changes an offer, letter of intent or loan terms.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `zircon_check` | Rent roll scheduled rent against the T-12's rent income for the last month and annualized; occupancy (physical and economic); expired leases still listed, occupied units with no rent, rent above the roll's own market;… | runs |
| `zircon_explain` | Show one unit, account or the reconciliation with its findings. | runs |
| `zircon_write_report` | Write the diligence worklist as zircon-diligence.csv (one row per item, blank decision columns) and zircon-diligence.html into out_dir (default keystone-out/zircon). | runs |
| `zircon_draft_questions` | Write drafts/questions-<property>.md: due diligence questions for the seller, one per open item, with the figures from both files. | asks first (Auto can be opted in) |
| `zircon_request_send` | After one named human click (even in Auto), record that the reviewed questions draft is approved in questions-requests.csv. | one named click, even in Auto (`binding_send`) |
| `submit_offer` | Zircon never submits or changes an offer, letter of intent or loan terms. | refused |
| `data_room_upload` | Zircon never uploads to or shares from a data room. | refused |
| `email_send` | Zircon never sends questions; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Rent roll (`rent_roll`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `unit` (required) | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `tenant` | text | Tenant, Tenant Name, Tenants, Resident, Resident Name, Name | Mieter, Locataire, 賃借人, 租户 |
| `lease_id` | text | Lease, Lease ID, Lease Code, Lease Number, Lease #, Tenant Code | Mietvertrag, Bail, 契約番号, 合同编号 |
| `status` | text | Status, Unit Status, Tenant Status, Occupancy Status, Lease Status | Status, Statut, ステータス, 状态 |
| `sqft` | number | Sqft, Sq Ft, SqFt, Square Feet, Unit Sq Ft, Area | Fläche, Surface, 面積, 面积 |
| `bedrooms` | text | BD/BA, Beds, Bedrooms, Bed, Unit Type, Floorplan | Zimmer, Pièces, 間取り, 卧室 |
| `market_rent` | amount | Market Rent, Market, Asking Rent, Scheduled Rent | Marktmiete, Loyer de marché, 相場賃料, 市场租金 |
| `rent` | amount | Rent, Monthly Rent, Current Rent, Actual Rent, Lease Rent, Base Rent | Miete, Loyer, 賃料, 租金 |
| `annual_rent` | amount | Annual Rent, Annual Base Rent, Annual Rent Amount | - |
| `deposit` | amount | Deposit, Deposits, Deposits Held, Security Deposit, Resident Deposit, Deposit Held | Kaution, Dépôt de garantie, 敷金, 押金 |
| `lease_start` | date | Lease From, Lease Start, Lease Start Date, Lease Begin, Start Date, Commencement | Mietbeginn, Date de début du bail, 契約開始日, 租期开始 |
| `lease_end` | date | Lease To, Lease End, Lease End Date, Lease Expiration, Lease Exp, Expiration | Mietende, Date de fin du bail, 契約終了日, 租期结束 |
| `move_in` | date | Move-in, Move In, Move-In Date, Move In Date | Einzug, Date d’entrée, 入居日, 入住日期 |
| `move_out` | date | Move-out, Move Out, Move-Out Date, Move Out Date, Notice Date | Auszug, Date de sortie, 退去日, 退租日期 |
| `balance` | amount | Past Due, Balance, Balance Due, Current Balance, Amount Receivable, Total Unpaid | Saldo, Solde, 残高, 余额 |
| `charge_code` | text | Charge Code, Charge Type, Charge, Code | Buchungsart, Code de charge, 費目, 费用项目 |
| `charge_amount` | amount | Charge Amount, Amount, Lease Charges, Charge Amt | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| AppFolio | Reports > Rent Roll (CSV or Excel) | Unit, Tenant, Lease From, Lease To, Market Rent or BD/BA | no |
| Yardi Voyager | Rent Roll with Lease Charges (Excel) | Unit, Resident, Charge Code, Lease Expiration or Resident Deposit | no |
| Yardi Voyager (Commercial) | Commercial Rent Roll (Excel) | Unit(s), Lease, Area, Lease From, Lease To | no |
| Buildium | Reports > Rent roll (CSV or Excel) | Tenants, Lease start date, Lease end date, Rent | no |
| Rent Manager | Rent Roll report (Excel export) | Tenant Name, Unit Type, Lease Start, Lease End, Sq Ft | no |
| Entrata | Rent Roll report (Excel export) | Resident, Floor Plan, Scheduled Rent, Lease Start | no |
| RealPage OneSite | Rent Roll Detail (Excel export) | Floorplan, Unit/Lease Status, Lease Rent | no |
| MRI Commercial Management | Rent Roll (Excel export) | Suite, Occupant Name, Lease Begin, Lease Expiration | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### T-12 income statement (`t12`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `account` | text | GL Account, Account, Account Number, Account Code, Acct, GL Code | Konto, Compte, 勘定科目, 科目代码 |
| `account_name` | text | Account Name, Account Description, GL Account Name, Description of Account, Acct Name, Description | Kontobezeichnung, Libellé du compte, 勘定科目名, 科目名称 |
| `period` | text | Period, Post Month, Month, Fiscal Period, Accounting Period | Zeitraum, Période, 期間, 期间 |
| `date` | date | Date, Post Date, Posting Date, Transaction Date, Trans Date | Datum, Date, 日付, 日期 |
| `amount` | amount | Amount, Net, Net Amount, Total | Betrag, Montant, 金額, 金额 |
| `debit` | amount | Debit, Debits, Dr | Soll, Débit, 借方, 借方 |
| `credit` | amount | Credit, Credits, Cr | Haben, Crédit, 貸方, 贷方 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx zircon-of-diligence inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y zircon-of-diligence demo
npx -y zircon-of-diligence mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "zircon-of-diligence": {
      "command": "npx",
      "args": [
        "-y",
        "zircon-of-diligence",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add zircon-of-diligence -- npx -y zircon-of-diligence mcp --root .`, or install the `zircon-of-diligence` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `zircon-of-diligence approve <id> --as "Your Name"` (or on the local approvals page, `zircon-of-diligence approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`zircon-of-diligence kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
zircon-of-diligence tools                 # every tool, its policy and arguments
zircon-of-diligence sources               # the columns each input is read from
zircon-of-diligence inspect <file>        # how a file would be read (names and shapes, never values)
zircon-of-diligence call zircon_check '{"rent_roll":"<rent_roll>","t12":"<t12>"}'
zircon-of-diligence eval                  # the private eval cases on the fictional fixtures
zircon-of-diligence demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Zircon compares the seller's files with each other. It does not check them against bank statements, leases or tax returns.
- Not investment, accounting or legal advice.
