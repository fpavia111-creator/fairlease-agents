# Fairlease Management Fees (`fairlease-management-fees`)

Recomputes the fees charged to each owner from the terms of **their** management agreement and compares them with the owner ledger: management fee (percent of collected income less security deposits and anything else the agreement excludes, or flat, with minimum and maximum), leasing and renewal fees (flat or a percent of the unit's rent from the rent roll), maintenance markup against the bills it applies to, fees charged twice in a month, and fees the agreement does not provide for. It drafts fee correction notes. It never posts a credit or changes a fee setup.

MIT · Node 20 or newer · local files only · no credentials · built on [`fairlease-core`](../fairlease-core)

```bash
npx -y fairlease-management-fees demo
npx -y fairlease-management-fees mcp --root ./fees
```

## What it checks

| Finding | Meaning |
|---|---|
| `management_fee_over` / `management_fee_under` (note) | Charged against the agreement's fee for the month |
| `duplicate_fee` | The same management, leasing or renewal fee charged more than once in a month |
| `leasing_fee_over`, `renewal_fee_over`, `…_not_in_agreement`, `…_unverified` (note) | Against the flat or percent-of-rent term; unverified when no unit in the rent roll matches |
| `markup_over`, `markup_not_in_agreement` | Markup against `maintenance_markup_pct` of maintenance bills (taxes, insurance, utility bills, payroll and fees are not marked up) |
| `fee_not_in_agreement`, `other_fee_over` | A fee line the agreement's `other_fees` does not list, or above its amount |

The fee base is what was actually collected: a bounced payment (a negative receipt, or an NSF or returned-payment line) comes off it. Bank, permit, court, licence and association fees are costs passed through to the owner, not fees of the manager, and are left alone. Fees are recognised by their wording in nine languages (management fee, Verwaltungsgebühr, honoraires de gestion, 管理手数料…). Owners in the ledger with no agreement entry are listed, never guessed.


<!-- generated:start -->

## A demo run

`npx -y fairlease-management-fees demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairlease Management Fees demo (fictional owners and agreements) in <demo folder>

▶ Recompute September and October fees for three owners from their agreements
  status: executed  decision: allow
  4 owner-month(s) checked against their agreements: 4 with fees above or outside the agreement, 8689 to refund or explain in total.
    2026-10 Harbor Point Plaza           8195  duplicate_fee, management_fee_over, fee_not_in_agreement
    2026-09 Maple Court Apartments        210  management_fee_over
    2026-10 Pine Street Duplex            184  management_fee_over, markup_over
    2026-10 Maple Court Apartments        100  renewal_fee_over

▶ Explain Harbor Point (fee on CAM recoveries, charged twice)
  status: executed  decision: allow
  Harbor Point Owner LLC (fictional), Harbor Point Plaza, 2026-10: issue. Collected 121000, fee base 100000; management fee expected 4000, charged 12100. Management fee of 6050 charged 2 times in 2026-10. Management fee charged 6050; the agreement gives 4000 (4% of 100000 collected (excluding 21000 of deposits and other excluded income)). Over by 2050. Technology fee 95 on 2026-10-31 is not a fee in the agreement.

▶ Read a French owner ledger (Propriétaire, Libellé, Recettes, Dépenses)
  status: executed  decision: allow
  1 owner-month(s) checked against their agreements: 1 with fees above or outside the agreement, 84 to refund or explain in total.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 4 owner-month(s) checked against their agreements: 4 with fees above or outside the agreement, 8689 to refund or explain in total.

▶ Draft a fee correction note to Harbor Point Owner LLC
  status: executed  decision: allow  (auto)
  credit Harbor Point Plaza-2026-10 drafted with 1 open marker(s) ([TO CONFIRM: owner email]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to post the credit itself
  status: blocked  decision: block
  reason: Fairlease Management Fees never posts a credit or refund to an owner; a person does after review.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `fees_check` | Per owner and month: the management fee recomputed from the agreement (percent of collected income less excluded items, flat, minimum, maximum), leasing and renewal fees, maintenance markup against the bills it applie… | runs |
| `fees_explain` | Show one owner's fees for each month against the agreement. | runs |
| `fees_write_report` | Write the fee review worklist as fees.csv (one row per item, blank decision columns) and fees.html into out_dir (default keystone-out/fees). | runs |
| `fees_draft_credit` | Write drafts/credit-<property>-<period>.md: a fee correction note to the owner listing each fee above or outside the agreement and the total to be credited. | asks first (Auto can be opted in) |
| `fees_request_send` | After one named human click (even in Auto), record that the reviewed credit draft is approved in credit-requests.csv. | one named click, even in Auto (`binding_send`) |
| `post_owner_credit` | Fairlease Management Fees never posts a credit or refund to an owner; a person does after review. | refused |
| `fee_setup_update` | Fairlease Management Fees never changes fee setups in your property management system. | refused |
| `email_send` | Fairlease Management Fees never sends notes; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

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

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx fairlease-management-fees inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairlease-management-fees demo
npx -y fairlease-management-fees mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairlease-management-fees": {
      "command": "npx",
      "args": [
        "-y",
        "fairlease-management-fees",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairlease-management-fees -- npx -y fairlease-management-fees mcp --root .`, or install the `fairlease-management-fees` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairlease-management-fees approve <id> --as "Your Name"` (or on the local approvals page, `fairlease-management-fees approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairlease-management-fees kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairlease-management-fees tools                 # every tool, its policy and arguments
fairlease-management-fees sources               # the columns each input is read from
fairlease-management-fees inspect <file>        # how a file would be read (names and shapes, never values)
fairlease-management-fees call fees_check '{"ledger":"<ledger>","agreements":"<agreements>"}'
fairlease-management-fees eval                  # the private eval cases on the fictional fixtures
fairlease-management-fees demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Fairlease Management Fees applies the agreement terms you enter; it does not read the signed agreements.
- Not legal or accounting advice.
