# Tourmaline of Migration (`tourmaline-of-migration`)

For operators moving from one property management system to another. At cutover it compares the old system's rent roll with the new one's, unit by unit: units missing from the new system or only in it, and tenants, rents, deposits, balances, market rents, areas, lease dates, move-in dates and occupancy that changed on the way. It checks that the totals tie (units, occupied units, rent, deposits, balances, market rent, area) and drafts a punch list for the implementation team. It never signs off go-live, changes either system or deletes anything.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y tourmaline-of-migration demo
npx -y tourmaline-of-migration mcp --root ./cutover
```

## How units are paired

1. `unit_map` in the policy file, and unit aliases a person has accepted into memory.
2. The same unit name (case, spaces and leading zeros ignored).
3. The same trailing number ("B-201" and "201"), only when exactly one unit on each side has it. These pairs are marked `matched_by_number` for a person to confirm.

## What it checks

| Finding | Meaning |
|---|---|
| `missing_in_new`, `extra_in_new` | Unit in the old system only, or in the new system only |
| `tenant_differs`, `occupancy_differs` | Tenant name or vacant / notice / occupied changed |
| `rent_differs`, `deposit_differs`, `balance_differs`, `market_rent_differs`, `sqft_differs` | Amount changed by more than `tolerance` (default 0.01; area by more than 0.5) |
| `lease_dates_differ`, `move_in_differs` | Lease start, lease end or move-in changed |
| `matched_by_number` | Paired by trailing number only; confirm and teach the alias |
| `listed_twice_in_new`, `listed_twice_in_old` | The unit has more current records on one side than the other (a duplicate keyed during conversion) |

Two systems rarely write things the same way, so Tourmaline reads past the differences that are not differences: `Rivera, Ana` is Ana Rivera, `B-201` is `B201`, "Maple Court" is "The Maple Court Apartments" (units with the same number in two buildings pair by building, whatever order the files are in), a blank deposit is a zero deposit, and a future resident's row never stands in for the current resident's. A respelled name (`Jon` to `John`) or a co-tenant who did not carry over is still reported.

The report adds a **Totals** table, old against new. Rent rolls with one row per charge (Yardi with lease charges and similar) are grouped per unit first. Set `fields` in the policy to compare fewer fields.


<!-- generated:start -->

## A demo run

`npx -y tourmaline-of-migration demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Tourmaline of Migration demo (fictional property) in <demo folder>

▶ Compare the old and new systems' rent rolls at cutover
  status: executed  decision: allow
  11 unit(s) in the old system, 11 in the new at cutover 2026-11-01: 3 match, 6 differ, 1 paired by number only, 1 missing from the new system, 1 only in the new system. Totals that do not tie: occupied units 10 vs 9; rent 18105 vs 16395; deposit 12450 vs 10550; balance 987.5 vs 125.5; market rent 20495 vs 18620; area 9500 vs 9260.
    B-305  missing  missing_in_new
    MODEL  extra    extra_in_new
    103    differs  deposit_differs
    104    differs  balance_differs
    106    differs  lease_dates_differ
    107    differs  tenant_differs
    108    differs  rent_differs
    B-202  differs  occupancy_differs
    B-201  review   matched_by_number
    total Occupied units  old       10  new        9
    total Rent            old    18105  new    16395
    total Deposit         old    12450  new    10550
    total Balance         old    987.5  new    125.5
    total Market rent     old    20495  new    18620
    total Area            old     9500  new     9260

▶ Explain unit 103 (deposit dropped a zero)
  status: executed  decision: allow
  103 (Grace Okafor (fictional)): differs, paired by same unit. Deposit 1000 became 100 (-900).

▶ Compare two German tenant lists (Whg.-Nr., Kaltmiete, Kaution, Saldo)
  status: executed  decision: allow
  3 unit(s) in the old system, 3 in the new: 2 match, 1 differ, 0 paired by number only, 0 missing from the new system, 0 only in the new system. Totals that do not tie: balance -610 vs 0.

▶ Write the worklist with the totals
  status: executed  decision: allow
  Worklist written (en): 11 unit(s) in the old system, 11 in the new at cutover 2026-11-01: 3 match, 6 differ, 1 paired by number only, 1 missing from the new system, 1 only in the new system. Totals that do not tie: occupied units 10 vs 9; rent 18105 vs 16395; deposit 12450 vs 10550; balance 987.5 vs 125.5; market rent 20495 vs 18620; area 9500 vs 9260.

▶ Draft the punch list for the implementation team
  status: executed  decision: allow  (auto)
  punchlist 2026-11-01 drafted with 1 open marker(s) ([TO CONFIRM: implementation or conversion team]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to sign off go-live itself
  status: blocked  decision: block
  reason: Tourmaline never signs off a cutover or switches systems; a named person does.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `tourmaline_check` | Pairs every old unit with a new one (unit map and learned aliases, then the same unit, then the same number when unique) and compares tenant, rent, deposit, balance, market rent, area, lease dates, move-in and occupancy. | runs |
| `tourmaline_explain` | Show one unit side by side, old and new, with each difference. | runs |
| `tourmaline_write_report` | Write the migration worklist as tourmaline-migration.csv (one row per item, blank decision columns) and tourmaline-migration.html into out_dir (default keystone-out/tourmaline). | runs |
| `tourmaline_draft_punchlist` | Write drafts/punchlist-<cutover>.md: every unit that differs, is missing or was paired by number, plus totals that do not tie, for the implementation team. | asks first (Auto can be opted in) |
| `tourmaline_request_send` | After one named human click (even in Auto), record that the reviewed punchlist draft is approved in punchlist-requests.csv. | one named click, even in Auto (`binding_send`) |
| `tourmaline_recall` | Search this agent's own memory of the customer's setup: accepted facts (in use) and facts waiting for a person. | runs |
| `tourmaline_learn` | Propose one fact about the customer's setup for this agent to remember. | runs |
| `tourmaline_accept_learning` | A named person accepts or rejects a fact waiting in this agent's memory. | one named click, even in Auto (`accept_learning`) |
| `tourmaline_retire_memory` | A named person stops an accepted fact from applying. | one named click, even in Auto (`accept_learning`) |
| `approve_go_live` | Tourmaline never signs off a cutover or switches systems; a named person does. | refused |
| `pm_system_update` | Tourmaline never changes data in either system. | refused |
| `delete_old_system_data` | Tourmaline never deletes or archives the old system's records. | refused |
| `email_send` | Tourmaline never sends the punch list; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Old system rent roll (`before`)

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

### New system rent roll (`after`)

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

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx tourmaline-of-migration inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Memory

tourmaline-of-migration can remember facts about your setup so the next run does not have to be told again. `tourmaline_learn` only proposes a fact; it changes nothing until a named person accepts it with `tourmaline_accept_learning`, which is one click even in Auto. Facts live in one hash-chained file per agent under `.keystone/memory/`; if the chain does not verify, no fact is used. Credentials, personal identifiers and text that reads like instructions to an AI are refused. Run without memory with `--no-memory`.

| Kind | What an accepted fact changes |
|---|---|
| `unit_alias` | pairs that old unit with that new unit when comparing rent rolls; never changes an amount, a date or a tolerance |
| `note` | nothing (shown by recall only) |

```bash
tourmaline-of-migration memory list
tourmaline-of-migration memory accept MEM-1a2b3c4d5e6f --as "Your Name"
tourmaline-of-migration memory retire MEM-1a2b3c4d5e6f --as "Your Name" --reason "code retired"
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y tourmaline-of-migration demo
npx -y tourmaline-of-migration mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "tourmaline-of-migration": {
      "command": "npx",
      "args": [
        "-y",
        "tourmaline-of-migration",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add tourmaline-of-migration -- npx -y tourmaline-of-migration mcp --root .`, or install the `tourmaline-of-migration` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `tourmaline-of-migration approve <id> --as "Your Name"` (or on the local approvals page, `tourmaline-of-migration approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`tourmaline-of-migration kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
tourmaline-of-migration tools                 # every tool, its policy and arguments
tourmaline-of-migration sources               # the columns each input is read from
tourmaline-of-migration inspect <file>        # how a file would be read (names and shapes, never values)
tourmaline-of-migration call tourmaline_check '{"before":"<before>","after":"<after>"}'
tourmaline-of-migration eval                  # the private eval cases on the fictional fixtures
tourmaline-of-migration demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Tourmaline compares two rent roll exports. It does not compare ledgers line by line, open either system, or decide when you are ready to go live.
- Export both rent rolls for the same cutover date, or every timing difference will show up as a finding.
