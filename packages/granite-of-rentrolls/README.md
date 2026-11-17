# Granite of Rent Rolls (`granite-of-rentrolls`)

Checks a rent roll against **your own lease abstracts**, unit by unit, as of the date it was run: is the rent what the lease says after its steps and escalations, is the deposit right, do the area, dates and tenant match, and is anything occupied without a lease or leased but missing. Useful at month end, before an owner report, and in an acquisition or a system migration. It never changes the property management system.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y granite-of-rentrolls demo
npx -y granite-of-rentrolls mcp --root ./rent-roll
```

## What it checks

| Finding | Meaning |
|---|---|
| `rent_under_lease`, `rent_over_lease`, `rent_missing` | Rent roll rent against the lease rent on the as-of date: explicit steps, fixed percent or amount escalations, CPI escalations with floor and cap (from your index file), free rent |
| `deposit_mismatch`, `deposit_not_cash` | Deposit held against the lease; letters of credit and guaranties expect no cash |
| `area_mismatch`, `start_mismatch`, `end_mismatch`, `tenant_mismatch` | The rent roll and the lease disagree |
| `holdover` | The lease ended and the unit is still shown occupied |
| `lease_not_started` | Occupied, but the unit's only lease starts after the as-of date (early occupancy, or a start date to correct) |
| `no_lease` | Occupied, but there is no lease for the unit in your file |
| `vacant_with_lease` | Shown vacant while a lease is in force |
| `missing_from_rent_roll` | A lease in force whose unit is not on the rent roll |
| `rent_needs_index`, `rent_not_in_lease` | Granite could not work out the lease rent and says what is missing (status **review**) |

Unit spellings are matched ("Suite 100", "Ste. 0100", "#100", "101号室"), and tenant names are compared without legal forms. Roommates listed together ("Ann Example, Bob Sample") match a lease in one of their names. Total and subtotal rows are not counted as units. When the rent roll and the leases cover more than one property, a unit is checked against its own property's lease.


## Files it reads

- **Rent roll**: AppFolio (with its property heading rows), Yardi Voyager "with lease charges" (one row per charge; codes such as `RNTCOM` and `CAMEST` are read by their start, and you can teach Granite your own), Yardi commercial, Buildium, Rent Manager, Entrata, RealPage OneSite and MRI layouts, or any file with recognisable columns, including German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean headers. Shift_JIS, EUC-KR, GB18030, UTF-16 and Windows-1252 files are decoded.
- **Leases** (`leases` schema shared by the Keystone agents). See [`fixtures/leases.json`](fixtures/leases.json).
- **Indexes** (optional): CPI-style values you copy from your source. Nothing is looked up online.

<!-- generated:start -->

## A demo run

`npx -y granite-of-rentrolls demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Granite of Rent Rolls demo (fictional shopping center) in <demo folder>

▶ Check the January 2026 rent roll against six leases
  status: executed  decision: allow
  8 unit(s) as of 2026-01-31: 5 with issues, 0 to review, 3 match. Rent under the leases by 222.79 a month. Vacant: 1.
    Suite 100  Acme Bagels LLC           4243.6    4243.6  ok     
    Suite 110  Brightside Dental PC      7426.3   7649.09  issue  rent_under_lease
    Suite 120  Cobalt Fitness Inc      14038.64  14038.64  ok     deposit_not_cash
    Suite 130  Delta Phone Repair          2704      2704  issue  deposit_mismatch
    Suite 140  Evergreen Grocers Ltd      32400     32400  issue  area_mismatch
    Suite 150  Fable Books & Cafe          4375      4375  issue  tenant_mismatch
    Suite 160  (vacant)                                    ok     
    Kiosk 1    Ghost Kiosk Co               650            issue  no_lease

▶ Explain Suite 110 (a rent step the rent roll missed)
  status: executed  decision: allow
  Suite 110 (Brightside Dental PC): issue. Rent roll 7426.3, lease 7649.09. Rent roll 7426.3, lease 7649.09 on 2026-01-31 (a missed escalation or step?).

▶ Read a Yardi rent roll that lists charges row by row
  status: executed  decision: allow
  6 unit(s) as of 2026-01-31: 4 with issues, 0 to review, 2 match. Rent under the leases by 104 a month. Vacant: 0.

▶ Learn that charge code MERCH (merchants association dues) counts as CAM (waits for a person)
  status: executed  decision: allow
  Stored MEM-cf76835e12be as waiting. It changes nothing until a named person accepts it with granite_accept_learning (id "MEM-cf76835e12be", decision "accept").

▶ Read a German rent roll (Objekt, Einheit, Nettokaltmiete)
  status: executed  decision: allow
  6 unit(s) as of 2026-01-31: 4 with issues, 0 to review, 2 match. Rent under the leases by 0 a month. Vacant: 0.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 8 unit(s) as of 2026-01-31: 5 with issues, 0 to review, 3 match. Rent under the leases by 222.79 a month. Vacant: 1.

▶ Agent tries to fix the rent in the system itself
  status: blocked  decision: block
  reason: Granite never changes rents, deposits or lease dates in the property management system; a person corrects the record.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `granite_check` | Compare every rent roll unit with the lease in force on as_of: rent after steps and escalations (fixed, amount or CPI), deposit, area, dates and tenant name; flag holdovers, units occupied with no lease, vacant units … | runs |
| `granite_explain` | Show one unit's rent roll values, the lease values and every finding. | runs |
| `granite_write_report` | Write the rent roll audit worklist as granite-rent-roll.csv (one row per item, blank decision columns) and granite-rent-roll.html into out_dir (default keystone-out/granite). | runs |
| `granite_recall` | Search this agent's own memory of the customer's setup: accepted facts (in use) and facts waiting for a person. | runs |
| `granite_learn` | Propose one fact about the customer's setup for this agent to remember. | runs |
| `granite_accept_learning` | A named person accepts or rejects a fact waiting in this agent's memory. | one named click, even in Auto (`accept_learning`) |
| `granite_retire_memory` | A named person stops an accepted fact from applying. | one named click, even in Auto (`accept_learning`) |
| `pm_system_update` | Granite never changes rents, deposits or lease dates in the property management system; a person corrects the record. | refused |
| `post_tenant_charge` | Granite never bills a missed escalation; your accounting team does after review. | refused |

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

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx granite-of-rentrolls inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Memory

granite-of-rentrolls can remember facts about your setup so the next run does not have to be told again. `granite_learn` only proposes a fact; it changes nothing until a named person accepts it with `granite_accept_learning`, which is one click even in Auto. Facts live in one hash-chained file per agent under `.keystone/memory/`; if the chain does not verify, no fact is used. Credentials, personal identifiers and text that reads like instructions to an AI are refused. Run without memory with `--no-memory`.

| Kind | What an accepted fact changes |
|---|---|
| `charge_code_kind` | reads that charge code as the given kind when a rent roll lists charges row by row; never changes a lease term or a tolerance |
| `note` | nothing (shown by recall only) |

```bash
granite-of-rentrolls memory list
granite-of-rentrolls memory accept MEM-1a2b3c4d5e6f --as "Your Name"
granite-of-rentrolls memory retire MEM-1a2b3c4d5e6f --as "Your Name" --reason "code retired"
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y granite-of-rentrolls demo
npx -y granite-of-rentrolls mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "granite-of-rentrolls": {
      "command": "npx",
      "args": [
        "-y",
        "granite-of-rentrolls",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add granite-of-rentrolls -- npx -y granite-of-rentrolls mcp --root .`, or install the `granite-of-rentrolls` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `granite-of-rentrolls approve <id> --as "Your Name"` (or on the local approvals page, `granite-of-rentrolls approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`granite-of-rentrolls kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
granite-of-rentrolls tools                 # every tool, its policy and arguments
granite-of-rentrolls sources               # the columns each input is read from
granite-of-rentrolls inspect <file>        # how a file would be read (names and shapes, never values)
granite-of-rentrolls call granite_check '{"rent_roll":"<rent_roll>","leases":"<leases>","as_of":"<as_of>"}'
granite-of-rentrolls eval                  # the private eval cases on the fictional fixtures
granite-of-rentrolls demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- It compares the rent roll with your abstracts, not with the signed leases.
- The export layouts were written from knowledge of the exports and were not tested against a live account.
- Not legal or accounting advice. A person corrects the system and decides what to bill.
