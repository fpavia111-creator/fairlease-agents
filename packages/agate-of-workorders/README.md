# Agate of Work Orders (`agate-of-workorders`)

Ages every work order against **your** targets by priority and finds what a busy maintenance desk misses: likely emergencies filed as routine (leaks, no heat, gas, sparks, in nine languages), open orders past target or with no vendor, the same problem coming back in the same unit, and invoices far above the usual cost. A vendor scorecard shows who finishes on time. It never dispatches, closes or pays anything.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y agate-of-workorders demo
npx -y agate-of-workorders mcp --root ./maintenance
```

## What it checks

| Finding | Meaning |
|---|---|
| `possible_emergency` | An open order not marked emergency whose description has a word such as leak, flood, no heat, gas smell, sparks, sewage (or Wasserschaden, fuite, fuga, 漏水, 누수 …). Your own list replaces it via `emergency_words` |
| `overdue`, `completed_late` | Days from created to completed (or to `as_of`) over your target for the priority |
| `stale`, `unassigned` | Open longer than `stale_days` (30), or no vendor after `unassigned_days` (2) |
| `repeat` | Same category in the same unit of the same property within `repeat_days` (90); common-area orders are not compared |
| `cost_outlier` | Cost over `outlier_factor` (4) × the category median, with three or more costs to compare |
| `cost_missing`, `created_missing`, `completed_date_missing`, `dates_out_of_order` | Data to fix: a closed order with no completed date is not aged, and a completed date before the created date is reported |

Default targets, which you should replace with your own: emergency 1 day, high 3, normal 7, low 14. Priority and status words in nine languages are read; cancelled orders are left out.


<!-- generated:start -->

## A demo run

`npx -y agate-of-workorders demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Agate of Work Orders demo (fictional apartment building) in <demo folder>

▶ Age 20 work orders from an AppFolio export against your targets
  status: executed  decision: allow
  20 work order(s), 5 open as of 2026-11-15: 2 possible emergency filed as routine, 1 open past target, 3 repeat(s), 1 cost outlier(s).
    4112 unit 301  low       7 days  possible_emergency, unassigned
    4104 unit 203  normal    5 days  possible_emergency
    4114 unit 205  low      44 days  overdue, stale, unassigned
    4106 unit 405  normal   19 days  completed_late
    4107 unit 101  normal   16 days  completed_late
    4105 unit 106  high      9 days  completed_late
    4110 unit 303  normal    7 days  cost_outlier
    4102 unit 304  normal    3 days  repeat
    4117 unit 306  normal    3 days  repeat
    4103 unit 304  high      2 days  repeat
    Vendor scorecard:
      QuickFix HVAC (fictional)        4 orders, 0% on time, avg 14.67 days
      FlowRight Plumbing (fictional)   5 orders, 100% on time, avg 2.33 days
      ApplianceCare (fictional)        4 orders, 100% on time, avg 5.25 days
      NoBugs Pest (fictional)          2 orders, 100% on time, avg 3.5 days
      In-house maintenance             2 orders, 100% on time, avg 2 days
      Volt Electric (fictional)        1 orders, 100% on time, avg 2 days

▶ Explain 4104 (a ceiling leak filed as normal)
  status: executed  decision: allow
  4104 unit 203 (Plumbing, normal): "Water leaking from bathroom ceiling", open 5 day(s), target 7, FlowRight Plumbing (fictional). "Water leaking from bathroom ceiling" mentions "leak" but is filed as normal; someone should look at it today.

▶ Read German orders (Auftragsnummer, Einheit, Priorität, "tropft")
  status: executed  decision: allow
  2 work order(s), 1 open as of 2026-11-15: 1 possible emergency filed as routine, 0 open past target, 0 repeat(s), 0 cost outlier(s).

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 20 work order(s), 5 open as of 2026-11-15: 2 possible emergency filed as routine, 1 open past target, 3 repeat(s), 1 cost outlier(s).

▶ Agent tries to dispatch a plumber itself
  status: blocked  decision: block
  reason: Agate never dispatches, reassigns or schedules a vendor.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `agate_check` | Ages every work order against your targets by priority, and flags likely emergencies filed as routine (leaks, no heat, gas, sparks; words in nine languages), open orders past target or stale, orders with no vendor, re… | runs |
| `agate_explain` | Show one order's age against target, vendor, cost and findings. | runs |
| `agate_write_report` | Write the work-order worklist as agate-workorders.csv (one row per item, blank decision columns) and agate-workorders.html into out_dir (default keystone-out/agate). | runs |
| `vendor_dispatch` | Agate never dispatches, reassigns or schedules a vendor. | refused |
| `approve_invoice` | Agate never approves or pays a vendor invoice. | refused |
| `close_work_order` | Agate never opens, closes or changes work orders in the property management system. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Work orders (`work_orders`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `work_order` (required) | text | Work Order, Work Order Number, Work Order #, WO, WO #, WO Number | Auftrag, Bon d’intervention, 作業番号, 工单号 |
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `unit` | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `category` | text | Category, Issue, Type, Work Order Type, Problem, Trade | Kategorie, Catégorie, 経費科目, 费用类别 |
| `description` | text | Description, Job Description, Issue Description, Details, Problem Description, Summary | Beschreibung, Description, 摘要, 摘要 |
| `priority` | text | Priority, Urgency | Priorität, Priorité, 優先度, 优先级 |
| `status` | text | Status, Work Order Status | Status, Statut, ステータス, 状态 |
| `vendor` | text | Vendor, Assigned Vendor, Assigned To, Technician, Contractor | Lieferant, Fournisseur, 仕入先, 供应商 |
| `created` | date | Created At, Created, Created Date, Date Created, Opened, Reported | Datum, Date, 日付, 日期 |
| `assigned` | date | Assigned At, Assigned On, Dispatched, Scheduled, Scheduled Date | - |
| `completed` | date | Completed On, Completed, Completed Date, Date Completed, Closed, Closed On | Erledigt am, Date de clôture, 完了日, 完成日期 |
| `cost` | amount | Cost, Amount, Invoice Amount, Total, Vendor Bill Amount, Labor + Materials | Betrag, Montant, 金額, 金额 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| AppFolio | Reports > Work Order (CSV or Excel) | Work Order Number, Priority, Job Description or Work Order Issue | no |
| Buildium | Tasks > Work orders export (CSV) | Task #, Subject, Assigned to | no |
| Yardi Voyager | Service Request register (Excel) | Service Request, Brief Desc, Call Date | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx agate-of-workorders inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y agate-of-workorders demo
npx -y agate-of-workorders mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "agate-of-workorders": {
      "command": "npx",
      "args": [
        "-y",
        "agate-of-workorders",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add agate-of-workorders -- npx -y agate-of-workorders mcp --root .`, or install the `agate-of-workorders` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `agate-of-workorders approve <id> --as "Your Name"` (or on the local approvals page, `agate-of-workorders approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`agate-of-workorders kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
agate-of-workorders tools                 # every tool, its policy and arguments
agate-of-workorders sources               # the columns each input is read from
agate-of-workorders inspect <file>        # how a file would be read (names and shapes, never values)
agate-of-workorders call agate_check '{"work_orders":"<work_orders>"}'
agate-of-workorders eval                  # the private eval cases on the fictional fixtures
agate-of-workorders demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Dates only: targets are counted in days, not hours.
- A possible-emergency flag is a prompt for a person to look today. It is not a safety assessment, and a missing flag does not mean a condition is safe.
