# Flint of Inspections (`flint-of-inspections`)

Reads your inspection results item by item and answers three questions: which units are overdue (or never inspected) on **your** inspection interval, what is worse at move-out than it was at move-in, and which items rated poor have had no work order since. It drafts notices of entry for units due an inspection. It never decides what is damage, charges a resident, or dispatches a vendor.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y flint-of-inspections demo
npx -y flint-of-inspections mcp --root ./inspections
```

## What it checks

| Finding | Meaning |
|---|---|
| `inspection_overdue`, `inspection_due_soon` | Last move-in or periodic inspection plus `interval_days` has passed, or is within `due_soon_days` |
| `never_inspected` | With a rent roll: occupied unit with no inspection on file |
| `worse_at_move_out` | Items rated lower at move-out than at the latest move-in before it, with both ratings |
| `no_photo` | A worse item with no photo (when `require_photo` is not false) |
| `no_move_in_baseline` | Move-out with no move-in inspection to compare against |
| `poor_no_work_order`, `poor_follow_up_due` | With work orders: items at or below `poor_at` in the latest inspection, and no work order for the unit since, after or within `followup_days` |
| `not_in_move_in`, `poor_items`, `unrated` (notes) | Poor item missing from the move-in; poor items when no work orders are given; condition words it could not read |

Conditions are read as words in nine languages (good, gut, bon, bueno, bom, buono, 良好, 良好, 양호; damaged, beschädigt, endommagé…) or as scores (`4`, `8/10`, with `scale_max`). Negated wording such as "not good" is left unrated for a person. Vacant units are skipped for the schedule; without a rent roll, a unit whose latest inspection is a move-out is treated as between residents.


<!-- generated:start -->

## A demo run

`npx -y flint-of-inspections demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Flint of Inspections demo (fictional units) in <demo folder>

▶ Check 24 units: annual schedule, move-out against move-in, poor items followed up
  status: executed  decision: allow
  24 unit(s), 25 inspection(s) on file as of 2026-11-15: 1 overdue for the 365-day inspection, 1 never inspected, 1 due within 30 days; 1 move-out(s) with items worse than at move-in (4 item(s)), 1 with no move-in to compare; 2 unit(s) with poor items and no work order after 14 days.
    106   Farah Haddad       issue     inspection_overdue
    202   Hannah Becker      issue     poor_no_work_order
    204   (vacant)           issue     not_in_move_in, worse_at_move_out, no_photo
    303   Nadia Rahman       issue     never_inspected
    305   Amara Diallo (applicant) issue     no_move_in_baseline, poor_no_work_order
    402   Rosa Delgado       due_soon  inspection_due_soon

▶ Explain unit 204 (move-out against move-in)
  status: executed  decision: allow
  Unit 204 (vacant): issue. 2 inspection(s), last 2026-10-31. Living room: Carpet: Good → Damaged (photo). Kitchen: Countertop: Good → Fair. Kitchen: Oven: Clean → Dirty (photo). Bedroom 1: Walls: Good → Needs repair. Rated poor at move-out 2026-10-31 but not on the move-in inspection: Bathroom: Mirror. Worse at move-out than at move-in: Living room: Carpet Good → Damaged; Kitchen: Countertop Good → Fair; Kitchen: Oven Clean → Dirty; Bedroom 1: Walls Good → Needs repair. A person decides what is damage and what is normal wear. No photo for a condition change: Kitchen: Countertop; Bedroom 1: Walls.

▶ Read a German inspection export (Einheit, Raum, Bauteil, Zustand, Einzug/Auszug)
  status: executed  decision: allow
  2 unit(s), 3 inspection(s) on file as of 2026-11-15: 1 overdue for the 365-day inspection, 0 due within 30 days; 1 move-out(s) with items worse than at move-in (3 item(s)), 0 with no move-in to compare.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 24 unit(s), 25 inspection(s) on file as of 2026-11-15: 1 overdue for the 365-day inspection, 1 never inspected, 1 due within 30 days; 1 move-out(s) with items worse than at move-in (4 item(s)), 1 with no move-in to compare; 2 unit(s) with poor items and no work order after 14 days.

▶ Draft a notice of entry for unit 106 (annual inspection overdue)
  status: executed  decision: allow  (auto)
  notice 106 drafted with 0 open marker(s). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to charge the former resident of 204 for the carpet
  status: blocked  decision: block
  reason: Flint never charges a resident for damage; a person decides what is damage.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `flint_check` | Per unit: periodic inspection overdue or due soon on your interval, never inspected (with a rent roll), move-out items worse than at move-in with no photo, move-outs with no move-in to compare, and poor items with no … | runs |
| `flint_explain` | Show one unit's inspection history, item changes from move-in to move-out and findings. | runs |
| `flint_write_report` | Write the inspection worklist as flint-inspections.csv (one row per item, blank decision columns) and flint-inspections.html into out_dir (default keystone-out/flint). | runs |
| `flint_draft_notice` | Write drafts/notice-<unit>.md: a notice of entry for a unit whose inspection is overdue or due soon. | asks first (Auto can be opted in) |
| `flint_request_send` | After one named human click (even in Auto), record that the reviewed notice draft is approved in notice-requests.csv. | one named click, even in Auto (`binding_send`) |
| `post_tenant_charge` | Flint never charges a resident for damage; a person decides what is damage. | refused |
| `vendor_dispatch` | Flint never dispatches a vendor or opens a work order in your system. | refused |
| `email_send` | Flint never sends notices; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Inspection results (`inspections`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `unit` (required) | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `inspected_at` | date | Inspection Date, Date, Inspected, Inspected On, Prüfdatum, Begehung am | Datum, Date, 日付, 日期 |
| `inspection_type` | text | Inspection Type, Type, Kind, Art, Prüfungsart, Type d'inspection | - |
| `area` | text | Area, Room, Location, Section, Raum, Zimmer | Lagerort, Emplacement, 保管場所, 库位 |
| `item` | text | Item, Component, Feature, Element, Question, Bauteil | Artikel, Article, 品目, 物料 |
| `condition` | text | Condition, Rating, Result, Status, Score, Bewertung | Status, Statut, ステータス, 状态 |
| `notes` | text | Notes, Comment, Comments, Description, Remarks, Bemerkung | Beschreibung, Description, 摘要, 摘要 |
| `photo` | text | Photo, Photos, Image, Photo URL, Attachment, Foto | - |
| `inspector` | text | Inspector, Inspected By, Completed By, Prüfer, Inspecteur, Vistoriador | - |

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

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx flint-of-inspections inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y flint-of-inspections demo
npx -y flint-of-inspections mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "flint-of-inspections": {
      "command": "npx",
      "args": [
        "-y",
        "flint-of-inspections",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add flint-of-inspections -- npx -y flint-of-inspections mcp --root .`, or install the `flint-of-inspections` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `flint-of-inspections approve <id> --as "Your Name"` (or on the local approvals page, `flint-of-inspections approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`flint-of-inspections kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
flint-of-inspections tools                 # every tool, its policy and arguments
flint-of-inspections sources               # the columns each input is read from
flint-of-inspections inspect <file>        # how a file would be read (names and shapes, never values)
flint-of-inspections call flint_check '{"inspections":"<inspections>","policy":"<policy>"}'
flint-of-inspections eval                  # the private eval cases on the fictional fixtures
flint-of-inspections demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Flint compares the ratings recorded in your files. It does not look at photos.
- A work order for the unit opened after the inspection counts as follow-up for all its poor items; it does not match work orders to items.
- It does not decide what is damage and what is normal wear and tear. Not legal advice; notice periods for entry are yours to set.
