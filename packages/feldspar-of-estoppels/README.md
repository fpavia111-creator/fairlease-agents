# Feldspar of Estoppels (`feldspar-of-estoppels`)

Before a sale or refinancing, checks each returned tenant estoppel certificate against **your lease abstracts**: rent for the date, commencement and expiration, deposit, area, options and amendments, and any landlord default or offset the tenant claims. It tracks which tenants have not returned one (major tenants first), which are unsigned or too old for the closing date, and how much of the leased area is back against your lender's requirement. It drafts follow-ups to tenants. It never sends anything for signature or shares tenant files with a buyer or lender.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y feldspar-of-estoppels demo
npx -y feldspar-of-estoppels mcp --root ./closing
```

## What it checks

| Finding | Meaning |
|---|---|
| `not_returned`, `major_tenant_missing` | Lease in force with no estoppel (major at or above `major_sqft`) |
| `unsigned`, `stale` | No signature date, or signed more than `max_age_days` before `closing` |
| `rent_differs` | Stated rent differs from the lease abstract's rent for `as_of` by more than `rent_tolerance` (steps, fixed and CPI escalations, free rent) |
| `commencement_differs`, `expiration_differs`, `deposit_differs`, `area_differs` | Stated figure differs from the abstract |
| `default_claimed` | Tenant states a landlord default, claim or offset ("None" in nine languages is not a claim) |
| `amendment_not_in_file`, `option_not_in_file`, `option_not_confirmed` | Amendments or options that one side has and the other does not |
| `rent_prepaid` (note), `rent_not_computable` (note) | Rent paid beyond the current month; rent the abstract cannot compute (for example CPI without index values) |
| `rent_roll_differs` | With a rent roll: the rent roll differs from the abstract too |

Coverage: returned leases and their share of leased area, against `required_pct`.


Also checked: `tenant_differs` (the estoppel is from someone other than the tenant on the lease: an assignment or a sublease?), `amendment_not_confirmed` (the file has amendments and the tenant says none), `signed_in_future`, and month-to-month holdover tenants, who are still asked for an estoppel. Short answers such as "None known", "No defaults" or "Not aware of any" are read as nothing to report; anything longer is quoted as the tenant's statement.

<!-- generated:start -->

## A demo run

`npx -y feldspar-of-estoppels demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Feldspar of Estoppels demo (fictional sale of a fictional plaza) in <demo folder>

▶ Check returned estoppels against the lease abstracts, closing 2026-12-15
  status: executed  decision: allow
  4 of 5 estoppel(s) returned, 92.96% of leased area (meets the 75% required). 3 with discrepancies against the lease abstracts, 1 claiming a landlord default, 0 to follow up (unsigned, stale or minor differences), 1 clean. 1 estoppel(s) match no lease in force.
    Suite 110  Brightside Dental PC     discrepancy stale, rent_differs
    Suite 120  Cobalt Fitness Inc       discrepancy default_claimed
    Suite 140  Evergreen Grocers Ltd    discrepancy expiration_differs, amendment_not_in_file, rent_prepaid
    Suite 150  Fable Books              missing     not_returned
    Suite 100  Acme Bagels LLC          clean       

▶ Explain Suite 140 (term and amendment differ)
  status: executed  decision: allow
  Suite 140 Evergreen Grocers Ltd (lease L-105, 20000 sq ft, major): discrepancy. Signed 2026-11-08. Rent per abstract 32400, per estoppel 32400. Estoppel states expiration 2034-12-31; the lease abstract has 2033-12-31. Tenant lists amendments the lease file does not have: "First Amendment dated 2025-06-01 extending the term by one year". Rent paid through 2027-01-31, beyond the current month; prepaid rent is usually credited at closing.

▶ Read a German confirmation log (Miete, Kaution, Einwendungen, Unterzeichnet am)
  status: executed  decision: allow
  2 of 5 estoppel(s) returned, 28.17% of leased area (below the 75% required). 1 with discrepancies against the lease abstracts, 0 claiming a landlord default, 0 to follow up (unsigned, stale or minor differences), 1 clean.

▶ Write the tracker
  status: executed  decision: allow
  Worklist written (en): 4 of 5 estoppel(s) returned, 92.96% of leased area (meets the 75% required). 3 with discrepancies against the lease abstracts, 1 claiming a landlord default, 0 to follow up (unsigned, stale or minor differences), 1 clean. 1 estoppel(s) match no lease in force.

▶ Draft a follow-up to Brightside Dental (stale, rent differs)
  status: executed  decision: allow  (auto)
  request Suite 110 drafted with 1 open marker(s) ([TO CONFIRM: notice address under the lease]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to upload tenant files to the buyer's data room
  status: blocked  decision: block
  reason: Feldspar never shares tenant files with a buyer, lender or data room.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `feldspar_check` | Every lease in force against the latest estoppel returned: not returned (major tenants first), unsigned or too old for closing, rent, commencement, expiration, deposit or area different from the abstract, landlord def… | runs |
| `feldspar_explain` | Show one tenant's estoppel against the lease abstract. | runs |
| `feldspar_write_report` | Write the estoppel tracker as feldspar-estoppels.csv (one row per item, blank decision columns) and feldspar-estoppels.html into out_dir (default keystone-out/feldspar). | runs |
| `feldspar_draft_request` | Write drafts/request-<unit>.md: a follow-up to a tenant to return, sign, re-date or correct their estoppel, listing each difference from the lease abstract. | asks first (Auto can be opted in) |
| `feldspar_request_send` | After one named human click (even in Auto), record that the reviewed request draft is approved in request-requests.csv. | one named click, even in Auto (`binding_send`) |
| `esign_send` | Feldspar never sends a certificate for signature; a person does. | refused |
| `data_room_upload` | Feldspar never shares tenant files with a buyer, lender or data room. | refused |
| `pm_system_update` | Feldspar never edits leases or the rent roll in your property management system. | refused |
| `email_send` | Feldspar never sends requests; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Estoppel log (`estoppels`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `unit` (required) | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `tenant` | text | Tenant, Tenant Name, Tenants, Resident, Resident Name, Name | Mieter, Locataire, 賃借人, 租户 |
| `lease_id` | text | Lease, Lease ID, Lease Code, Lease Number, Lease #, Tenant Code | Mietvertrag, Bail, 契約番号, 合同编号 |
| `rent` | amount | Monthly Base Rent, Base Rent, Current Rent, Monthly Rent, Rent, Current Monthly Rent | Miete, Loyer, 賃料, 租金 |
| `lease_start` | date | Commencement Date, Lease Start, Commencement, Lease Commencement, Start Date, Lease From | Mietbeginn, Date de début du bail, 契約開始日, 租期开始 |
| `lease_end` | date | Expiration Date, Lease Expiration, Lease End, Termination Date, End Date, Lease To | Mietende, Date de fin du bail, 契約終了日, 租期结束 |
| `deposit` | amount | Security Deposit, Deposit, Deposit Held, Letter of Credit | Kaution, Dépôt de garantie, 敷金, 押金 |
| `sqft` | number | Square Feet, Rentable SF, RSF, Sq Ft, Premises SF, Area | Fläche, Surface, 面積, 面积 |
| `paid_through` | date | Rent Paid Through, Paid Through, Paid To, Bezahlt bis, Payé jusqu’au, Pagado hasta | - |
| `defaults` | text | Landlord Default, Landlord Defaults, Defaults, Claims, Claims or Offsets, Offsets | - |
| `amendments` | text | Amendments, Lease Amendments, Modifications, Nachträge, Avenants, Enmiendas | - |
| `options` | text | Options, Renewal Options, Rights, ROFR/ROFO, Purchase Option, Optionen | - |
| `signed` | date | Signed, Signed On, Date Signed, Execution Date, Dated, Unterzeichnet am | - |
| `received` | date | Received, Date Received, Returned, Eingegangen, Reçu le, Recibido | - |

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

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx feldspar-of-estoppels inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y feldspar-of-estoppels demo
npx -y feldspar-of-estoppels mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "feldspar-of-estoppels": {
      "command": "npx",
      "args": [
        "-y",
        "feldspar-of-estoppels",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add feldspar-of-estoppels -- npx -y feldspar-of-estoppels mcp --root .`, or install the `feldspar-of-estoppels` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `feldspar-of-estoppels approve <id> --as "Your Name"` (or on the local approvals page, `feldspar-of-estoppels approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`feldspar-of-estoppels kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
feldspar-of-estoppels tools                 # every tool, its policy and arguments
feldspar-of-estoppels sources               # the columns each input is read from
feldspar-of-estoppels inspect <file>        # how a file would be read (names and shapes, never values)
feldspar-of-estoppels call feldspar_check '{"leases":"<leases>","estoppels":"<estoppels>"}'
feldspar-of-estoppels eval                  # the private eval cases on the fictional fixtures
feldspar-of-estoppels demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Feldspar compares what was typed into your estoppel log with your lease abstracts. It does not read signed certificates or leases.
- What a tenant's statement means for the deal is for counsel. Not legal advice.
