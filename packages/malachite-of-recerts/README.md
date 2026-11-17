# Malachite of Recerts (`malachite-of-recerts`)

For affordable housing managers (HUD, LIHTC, HOME, public housing and similar programs). It tracks every household's recertification **dates** against the schedule in your policy file: when each is due, the reminder notices your policy sends before that (for example at 120, 90 and 60 days), whether they are recorded and on time, who is overdue or due soon, and which occupied units are missing from the tracker. It writes a calendar and drafts reminders. It never reads income, decides eligibility, changes rent or submits anything to an agency.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y malachite-of-recerts demo
npx -y malachite-of-recerts mcp --root ./recerts
```

## What it checks

| Finding | Meaning |
|---|---|
| `overdue`, `due_soon`, `in_window` | Past the due date; within `due_soon_days` (default 30); inside the window your program starts work (`start_days_before`) |
| `notice_missing`, `notice_late` | A notice your policy sends N days before the due date is not recorded for this cycle, or went after that date |
| `due_date_differs` | The tracker's next due date is more than a month away from last certification plus the program frequency |
| `last_cert_missing`, `due_from_move_in`, `due_unknown` | No last certification; due date taken from the move-in anniversary (confirm it); no date to place it at all |
| `program_unknown` | The program is not in your policy file, so no schedule applies |
| `not_tracked`, `not_in_rent_roll`, `name_differs` | With a rent roll: an occupied unit missing from the tracker (list market-rate units in `market_units`), a tracked unit that is vacant, or a different name in the unit |

Notices dated before the last certification belong to the previous cycle and do not count. Yardi and OneSite style headers (Effective Date, Next AR Due, 120-Day Notice …) and local headers such as 世帯, 前回申告日, 次回申告期限 are read.


<!-- generated:start -->

## A demo run

`npx -y malachite-of-recerts demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Malachite of Recerts demo (fictional households) in <demo folder>

▶ Check the recertification tracker against the schedule in the policy file
  status: executed  decision: allow
  8 household(s) tracked: 1 overdue, 6 to review, 1 due within 30 days, 0 in the window your policy starts work. 5 notice(s) not recorded. 1 occupied unit(s) not in the tracker. 10 upcoming date(s).
    103  Okafor household (fictional)   2026-11-01 overdue   overdue
    106  Haddad household (fictional)   2026-12-15 review    last_cert_missing, due_from_move_in, notice_missing, notice_missing, notice_missing, due_soon
    102  Chen household (fictional)     2027-01-01 review    notice_missing, in_window
    101  Rivera household (fictional)   2027-03-01 review    notice_missing, in_window
    105  Novak household (fictional)    2027-04-01 review    due_date_differs, not_in_rent_roll
    108  Kim household (fictional)                 review    program_unknown
    109  Luis Diaz (fictional)                     review    not_tracked
    107  Brooks household (fictional)   2026-12-10 due_soon  notice_late, due_soon
    104  Patel household (fictional)    2027-06-01 ok        

▶ Explain unit 106 (no last certification on file)
  status: executed  decision: allow
  Haddad household (fictional) (unit 106), Section 8: review. Last certification unknown, next due 2026-12-15 (30 days). No last certification date in the tracker. Next due taken as the move-in anniversary 2026-12-15; confirm it. The 120-day notice (by 2026-08-17) is not recorded. The 90-day notice (by 2026-09-16) is not recorded. The 60-day notice (by 2026-10-16) is not recorded. Due 2026-12-15: 30 day(s) left.

▶ Read a Japanese public housing income report list (世帯, 前回申告日, 次回申告期限)
  status: executed  decision: allow
  3 household(s) tracked: 0 overdue, 1 to review, 0 due within 30 days, 0 in the window your policy starts work. 1 notice(s) not recorded. 5 upcoming date(s).

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 8 household(s) tracked: 1 overdue, 6 to review, 1 due within 30 days, 0 in the window your policy starts work. 5 notice(s) not recorded. 1 occupied unit(s) not in the tracker. 10 upcoming date(s).

▶ Write the calendar (.ics)
  status: executed  decision: allow
  10 date(s) from 2026-11-15: 4 notice(s) and 6 due date(s).

▶ Draft a reminder to the Brooks household (due in 25 days)
  status: executed  decision: allow  (auto)
  reminder Brooks household (fictional) drafted with 3 open marker(s) ([TO CONFIRM: Brooks household (fictional) mailing address or email], [TO CONFIRM: how to book], [TO CONFIRM: language assistance and accessibility contact]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to certify a household itself
  status: blocked  decision: block
  reason: Malachite never certifies a household or decides eligibility; trained staff do.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `malachite_check` | Every household against the schedule in your policy file: next due date (from the tracker, or last certification plus the program frequency), overdue and soon-due households, the notices your policy sends before each … | runs |
| `malachite_explain` | Show one household's program, last certification, next due date, notices and each finding. | runs |
| `malachite_write_report` | Write the recertification worklist as malachite-recerts.csv (one row per item, blank decision columns) and malachite-recerts.html into out_dir (default keystone-out/malachite). | runs |
| `malachite_calendar` | Write malachite-calendar.ics (notice dates and due dates from as_of on) and malachite-calendar.csv/.html into out_dir (default keystone-out/malachite). | runs |
| `malachite_draft_reminder` | Write drafts/reminder-<household>.md: a recertification reminder to one household with the due date and the documents listed in your policy. | asks first (Auto can be opted in) |
| `malachite_request_send` | After one named human click (even in Auto), record that the reviewed reminder draft is approved in reminder-requests.csv. | one named click, even in Auto (`binding_send`) |
| `certify_household` | Malachite never certifies a household or decides eligibility; trained staff do. | refused |
| `submit_to_agency` | Malachite never submits certifications or vouchers to an agency or housing authority system. | refused |
| `change_rent` | Malachite never changes a household's rent or posts charges. | refused |
| `email_send` | Malachite never sends reminders; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Recertification tracker (`tracker`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `household` (required) | text | Household, Household ID, Resident ID, Tenant Code, Head of Household, Resident | Mieter, Locataire, 賃借人, 租户 |
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `unit` | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `program` | text | Program, Program Type, Subsidy, Funding, Set-Aside, Programm | - |
| `move_in` | date | Move-in, Move In, Move-In Date, Initial Certification, 入居日, 入住日期 | Einzug, Date d’entrée, 入居日, 入住日期 |
| `last_cert` | date | Last Certification, Last Cert, Effective Date, Last Recert, Last AR, Certification Date | - |
| `next_due` | date | Next Certification, Next Recert, Recert Due, Next AR Due, Anniversary, Next Due | Fälligkeitsdatum, Date d'échéance, 期日, 截止日期 |
| `status` | text | Status, Certification Status, Cert Status, 状況, 申告状況 | Status, Statut, ステータス, 状态 |
| `notice_sent` | date | Notice Sent, First Notice, 120-Day Notice, Reminder Sent, Erste Erinnerung, Premier avis | - |
| `second_notice` | date | Second Notice, 90-Day Notice, 2nd Notice, Second Reminder, Zweite Erinnerung, Deuxième avis | - |
| `third_notice` | date | Third Notice, 60-Day Notice, 3rd Notice, Final Notice, Dritte Erinnerung, Troisième avis | - |

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

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx malachite-of-recerts inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y malachite-of-recerts demo
npx -y malachite-of-recerts mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "malachite-of-recerts": {
      "command": "npx",
      "args": [
        "-y",
        "malachite-of-recerts",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add malachite-of-recerts -- npx -y malachite-of-recerts mcp --root .`, or install the `malachite-of-recerts` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `malachite-of-recerts approve <id> --as "Your Name"` (or on the local approvals page, `malachite-of-recerts approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`malachite-of-recerts kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
malachite-of-recerts tools                 # every tool, its policy and arguments
malachite-of-recerts sources               # the columns each input is read from
malachite-of-recerts inspect <file>        # how a file would be read (names and shapes, never values)
malachite-of-recerts call malachite_check '{"tracker":"<tracker>","policy":"<policy>"}'
malachite-of-recerts eval                  # the private eval cases on the fictional fixtures
malachite-of-recerts demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Malachite repeats the schedule in your policy file. It does not know any program's rules; your compliance staff, the agency and the program documents do.
- It never sees income, assets or household composition, and it never decides eligibility or rent.
