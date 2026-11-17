# Garnet of Renewals (`garnet-of-renewals`)

Works the renewal pipeline: every lease ending soon (and every month-to-month one), the date the offer has to go out by under your notice period, a proposed rent that moves toward market but never above **your** increase cap, and the offers already made. It flags overdue offers, offers above the cap or sent late, declines, notices to vacate, and leases whose unit the rent roll shows vacant. It drafts renewal offers for a person to send; it never changes rents or sends anything for signature.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y garnet-of-renewals demo
npx -y garnet-of-renewals mcp --root ./renewals
```

## How it works

- **Deadline** = lease end − `notice_days`. No offer recorded after the deadline is `offer_overdue`; within `due_soon_days` (default 21) it is `offer_due_soon`.
- **Proposed rent** = market rent, but at least `min_increase_pct` and at most `max_increase_pct` over the current rent, rounded to `round_to` and never above the cap after rounding. No market rent, no proposal.
- **Offers** (optional file): status words in nine languages are read (pending, accepted, declined, notice to vacate).

| Finding | Meaning |
|---|---|
| `offer_overdue`, `offer_due_soon` | Against the deadline |
| `offer_over_cap`, `offer_after_deadline` | An offer already made breaks your policy |
| `declined`, `notice_to_vacate` | Turnover coming; hand over to leasing |
| `month_to_month`, `vacant_on_rent_roll` | Records to fix |
| `capped`, `at_or_over_market`, `market_rent_missing` | How the proposal was set |


The cap is applied to the rent paid today, after the lease's own steps and escalations. A lease whose renewal is already in the lease file (same tenant and unit, starting when this one ends) is shown as `renewed` and not chased. The latest offer during the lease counts; an offer dated before the lease began belongs to the earlier term. A status such as "Renewal notice sent" is a pending offer; only notice to vacate ("NTV", "Gave notice", "Non-renewal", "Moving out") ends it.

<!-- generated:start -->

## A demo run

`npx -y garnet-of-renewals demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Garnet of Renewals demo (fictional 24-unit apartment building) in <demo folder>

▶ Renewals in the next 120 days, with a 5% cap and 60 days notice
  status: executed  decision: allow
  8 lease(s) end by 2027-03-15 or are month to month: 1 offer(s) overdue, 1 due soon, 2 pending, 1 on notice. Proposed rents within your 5% cap add 285 a month.
    302 ends 2026-11-30  rent   1400  market   1450  proposed   1450  overdue        offer_overdue
    402 ends 2026-12-31  rent   1350  market   1450  proposed   1415  pending        capped, offer_over_cap
    306 ends 2027-02-28  rent   1750  market      -  proposed      -  upcoming       market_rent_missing
    206 ends 2027-01-31  rent   1800  market   1850  proposed   1850  due_soon       offer_due_soon
    105 ends 2026-05-31  rent   2150  market   2250  proposed   2250  moved_out      vacant_on_rent_roll
    101 ends 2026-11-30  rent   1400  market   1650  proposed   1470  pending        capped
    106 ends 2026-12-31  rent   1850  market   1850  proposed   1850  notice         at_or_over_market, notice_to_vacate
    104 ends 2027-02-28  rent   1800  market   1850  proposed   1850  upcoming       

▶ Explain unit 402 (offer already sent above the cap)
  status: executed  decision: allow
  Rosa Delgado (unit 402): lease ends 2026-12-31, offer deadline 2026-11-01, rent 1350, market 1450, proposed 1415 (4.81%), offered 1450; pending. Market 1450 is above your 5% cap; proposed 1415. Offered 1450 is 7.41% over the current 1350, above your 5% cap.

▶ Read offers in French (Lot, Locataire, Loyer proposé)
  status: executed  decision: allow
  Rosa Delgado (unit 402): lease ends 2026-12-31, offer deadline 2026-11-01, rent 1350, market 1450, proposed 1415 (4.81%), offered 1450; pending. Market 1450 is above your 5% cap; proposed 1415. Offered 1450 is 7.41% over the current 1350, above your 5% cap.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 8 lease(s) end by 2027-03-15 or are month to month: 1 offer(s) overdue, 1 due soon, 2 pending, 1 on notice. Proposed rents within your 5% cap add 285 a month.

▶ Draft an offer above the cap: refused
  status: error  decision: allow
  reason: offer_rent 1950 is above your 5% cap (1890)

▶ Draft the renewal offer for unit 206 at the proposed rent
  status: executed  decision: allow  (auto)
  offer 206 drafted for 1850 with 1 open marker(s) ([TO CONFIRM: tenant email or address]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to send the renewal lease for e-signature
  status: blocked  decision: block
  reason: Garnet never sends a renewal lease for signature.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `garnet_check` | Every lease ending within the horizon (and every month-to-month one): the offer deadline from your notice period, a proposed rent moving toward market but never above your cap, and the offer already made. | runs |
| `garnet_explain` | Show one lease's end, deadline, rent, market rent, proposed rent and offer. | runs |
| `garnet_write_report` | Write the renewal worklist as garnet-renewals.csv (one row per item, blank decision columns) and garnet-renewals.html into out_dir (default keystone-out/garnet). | runs |
| `garnet_draft_offer` | Write drafts/offer-<unit>.md: a renewal offer letter at the proposed rent (or offer_rent, which must be within your cap). | asks first (Auto can be opted in) |
| `garnet_request_send` | After one named human click (even in Auto), record that the reviewed offer draft is approved in offer-requests.csv. | one named click, even in Auto (`binding_send`) |
| `pm_system_update` | Garnet never changes rents or lease records in the property management system. | refused |
| `esign_send` | Garnet never sends a renewal lease for signature. | refused |
| `email_send` | Garnet never sends offers; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Rent roll with market rents (`rent_roll`)

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

### Renewal offers (`offers`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `unit` (required) | text | Unit, Unit Number, Apt, Suite | Einheit, Lot, 部屋番号, 房号 |
| `tenant` | text | Tenant, Resident, Name | Mieter, Locataire, 賃借人, 租户 |
| `offered_on` | date | Offered On, Offer Date, Date Offered, Sent, Angebot vom, Date de l'offre | - |
| `offered_rent` | amount | Offered Rent, Renewal Rent, New Rent, Proposed Rent, Neue Miete, Loyer proposé | - |
| `term_months` | number | Term (months), Term, Months, Laufzeit, Durée, Plazo | - |
| `status` | text | Status, Offer Status, Statut, Estado, Stato, ステータス | Status, Statut, ステータス, 状态 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx garnet-of-renewals inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y garnet-of-renewals demo
npx -y garnet-of-renewals mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "garnet-of-renewals": {
      "command": "npx",
      "args": [
        "-y",
        "garnet-of-renewals",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add garnet-of-renewals -- npx -y garnet-of-renewals mcp --root .`, or install the `garnet-of-renewals` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `garnet-of-renewals approve <id> --as "Your Name"` (or on the local approvals page, `garnet-of-renewals approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`garnet-of-renewals kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
garnet-of-renewals tools                 # every tool, its policy and arguments
garnet-of-renewals sources               # the columns each input is read from
garnet-of-renewals inspect <file>        # how a file would be read (names and shapes, never values)
garnet-of-renewals call garnet_check '{"leases":"<leases>","policy":"<policy>"}'
garnet-of-renewals eval                  # the private eval cases on the fictional fixtures
garnet-of-renewals demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- `max_increase_pct` and `notice_days` are required and have no defaults: they come from your policy and the rules where the property is. Garnet does not know rent-control or notice law.
- Not legal advice.
