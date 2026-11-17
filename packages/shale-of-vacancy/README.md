# Shale of Vacancy (`shale-of-vacancy`)

Reads one rent roll and shows where income is leaking: physical occupancy, leased percent, exposure, gross potential rent at market, loss to lease, vacancy loss, concessions and economic occupancy, unit by unit. Long-vacant units, rents far under or over market, missing market rents and vacant units with no move-out date are flagged. It never changes prices, unit status or listings.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y shale-of-vacancy demo
npx -y shale-of-vacancy mcp --root ./rent-rolls
```

## Definitions

| Measure | How it is worked out |
|---|---|
| Physical occupancy | Occupied units (including those on notice) ÷ all units |
| Leased | (Occupied − on notice and not re-leased + vacant and pre-leased) ÷ all units |
| Exposure | Vacant and not re-leased + on notice and not re-leased |
| Gross potential rent | Market rent of every unit, per month |
| Loss to lease | Market rent − rent, for occupied units |
| Vacancy loss | Market rent of vacant units, per month; and to date: market rent × 12 ÷ 365 × days since move-out |
| Economic occupancy | (Gross potential − loss to lease − vacancy − concessions) ÷ gross potential |

| Finding | Meaning |
|---|---|
| `long_vacant` | Vacant longer than `long_vacant_days` (default 30) |
| `below_market`, `above_market` | Rent more than `off_market_pct` (default 10%) under or over market |
| `market_rent_missing`, `rent_missing`, `vacant_since_unknown` | Data the measures need |
| `notice_unrented`, `vacant_rented`, `month_to_month`, `concession` | Notes |


<!-- generated:start -->

## A demo run

`npx -y shale-of-vacancy demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Shale of Vacancy demo (fictional 24-unit apartment building) in <demo folder>

▶ Read an AppFolio rent roll: occupancy, exposure, vacancy loss, loss to lease
  status: executed  decision: allow
  24 unit(s) as of 2026-11-15: 87.5% occupied, 87.5% leased, exposure 3 unit(s). Market rent 40950 a month; loss to lease 850, vacancy 6350, concessions 0 (economic occupancy 82.42%). 1 long vacant; 3 unit(s) to review.
    204 vacant         market   1850  rent      -  long_vacant
    306 occupied       market      -  rent   1750  market_rent_missing
    403 occupied       market   1650  rent   1850  above_market
    305 vacant_rented  market   2250  rent      -  vacant_rented
    106 notice         market   1850  rent   1850  notice_unrented
    101 occupied       market   1650  rent   1400  below_market

▶ Explain unit 204 (vacant 46 days)
  status: executed  decision: allow
  Unit 204 (vacant): market 1850, rent -, vacant 46 days (2797.81 at market). Vacant 46 days (since 2026-09-30), longer than 30.

▶ Read a Yardi rent roll with one row per charge (a concession, a VACANT row)
  status: executed  decision: allow
  3 unit(s) as of 2026-11-15: 66.67% occupied, 66.67% leased, exposure 1 unit(s). Market rent 5550 a month; loss to lease 50, vacancy 1850, concessions 150 (economic occupancy 63.06%). 1 long vacant; 1 unit(s) to review.

▶ Write the worklist with --lang ja
  status: executed  decision: allow
  Worklist written (ja): 24 unit(s) as of 2026-11-15: 87.5% occupied, 87.5% leased, exposure 3 unit(s). Market rent 40950 a month; loss to lease 850, vacancy 6350, concessions 0 (economic occupancy 82.42%). 1 long vacant; 3 unit(s) to review.

▶ Agent tries to reprice the vacant unit itself
  status: blocked  decision: block
  reason: Shale never changes market rents, unit status or pricing in the property management system.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `shale_check` | From one rent roll: physical occupancy, leased percent, exposure (vacant plus on notice and not re-leased), gross potential rent at market, loss to lease, vacancy loss, concessions and economic occupancy, unit by unit. | runs |
| `shale_explain` | Show one unit's status, market rent, rent, loss to lease, days vacant and findings. | runs |
| `shale_write_report` | Write the vacancy and loss-to-lease worklist as shale-vacancy.csv (one row per item, blank decision columns) and shale-vacancy.html into out_dir (default keystone-out/shale). | runs |
| `pm_system_update` | Shale never changes market rents, unit status or pricing in the property management system. | refused |
| `listing_publish` | Shale never posts or reprices a listing. | refused |

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

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx shale-of-vacancy inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y shale-of-vacancy demo
npx -y shale-of-vacancy mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "shale-of-vacancy": {
      "command": "npx",
      "args": [
        "-y",
        "shale-of-vacancy",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add shale-of-vacancy -- npx -y shale-of-vacancy mcp --root .`, or install the `shale-of-vacancy` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `shale-of-vacancy approve <id> --as "Your Name"` (or on the local approvals page, `shale-of-vacancy approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`shale-of-vacancy kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
shale-of-vacancy tools                 # every tool, its policy and arguments
shale-of-vacancy sources               # the columns each input is read from
shale-of-vacancy inspect <file>        # how a file would be read (names and shapes, never values)
shale-of-vacancy call shale_check '{"rent_roll":"<rent_roll>"}'
shale-of-vacancy eval                  # the private eval cases on the fictional fixtures
shale-of-vacancy demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Market rents are the ones on your rent roll. Shale does not survey the market or recommend prices.
- Not financial advice.
