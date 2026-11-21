# Fairlease Percentage Rent (`fairlease-percentage-rent`)

Works out percentage rent (overage rent) for retail tenants from the sales reports they send: net sales for the lease year, the breakpoint, the rent earned over it, what was already billed and the balance. It chases the paperwork too: missing, late, revised and conflicting reports are flagged, and a year stays at **review** until every month is in. It never bills, sends or starts a sales audit.

MIT · Node 20 or newer · local files only · no credentials · built on [`fairlease-core`](../fairlease-core)

```bash
npx -y fairlease-percentage-rent demo
npx -y fairlease-percentage-rent mcp --root ./retail
```

## How it works it out

- **Lease year** starts at the lease's `year_start_month` (a February lease year 2025 runs Feb 2025 to Jan 2026). Only months the lease is in force count.
- **Natural breakpoint**: the scheduled base rent for those months (escalations and steps included, free rent not taken off) divided by the rate.
- **Fixed breakpoint**: the amount in the lease, prorated by days in a partial year unless `prorate_partial_year` is `false`.
- **Net sales**: gross sales less the exclusions in your sales file. Percentage rent = rate × net sales over the breakpoint.
- **Billed**: percentage rent charges in the optional ledger dated in the lease year (or up to `billed_through`, for a true-up billed in the spring).
- **Forgiving matching**: a lease id typed `l101` or `L 101` still finds lease `L-101`; exclusions exported as negative numbers are taken off, not added; a revised report does not make a month late (lateness is judged on the first report); payment lines in the ledger never count as billed. With no `report_due_days`, a month is only expected once it has ended.

| Finding | Meaning |
|---|---|
| `sales_missing` | A month's report is due and not in the file; the year is **review** |
| `reports_not_due` | Some months are not due yet (a note, not a fault) |
| `report_late` | Received after `report_due_days` from month end |
| `sales_revised` | A later report replaced an earlier one; the latest is used |
| `conflicting_reports` | Two different reports with the same date; **review** |
| `breakpoint_prorated` | Fixed breakpoint prorated for a partial year |
| `below_so_far`, `near_breakpoint` | Sales sit just under the breakpoint, so the missing months or the exclusions decide |
| `exclusions_high` | Exclusions over 10% of gross sales |
| `sales_drop` | Net sales down 15% or more on the prior year (when both years are in the file) |
| `exclusions_exceed_sales` | A month's exclusions are larger than its gross sales; **review** |


## Files it reads

- **Leases** (`leases` schema) with a `percentage_rent` clause: `rate_pct`, `breakpoint` (`"natural"` or an amount), `year_start_month`, `report_due_days`, `prorate_partial_year`.
- **Sales reports**: one row per tenant and month, by lease id or by unit and tenant. Months such as `2025-03`, `Mar 2025`, `03/2025`, `März 2025` or `2025年3月` are read; so are local column names (Umsatz, Chiffre d’affaires, Ventas, 売上高, 销售额, 매출) and local number formats.
- **Billed** (optional): a tenant ledger. Codes such as `PCT` or `OVG` and words such as percentage rent, overage rent, Umsatzmiete or loyer variable are read as percentage rent.

<!-- generated:start -->

## A demo run

`npx -y fairlease-percentage-rent demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairlease Percentage Rent demo (fictional shopping center) in <demo folder>

▶ Work out 2025 percentage rent for three retail tenants
  status: executed  decision: allow
  3 lease(s) with percentage rent, lease year 2025: 2 owe 6367.5 in total after amounts billed; 1 to review (Fable Books). Percentage rent earned 24367.5. 1 sales row(s) matched no lease.
    L-101 Acme Bagels LLC        net sales       905850  breakpoint       844600  earned      3675  owes
    L-105 Fairstay Grocers Ltd   net sales     31379500  breakpoint     30000000  earned   20692.5  owes
    L-106 Fable Books            net sales       962360  breakpoint      1050000  earned         -  review

▶ Explain Fairstay Grocers (fixed breakpoint, monthly estimates billed, a late report)
  status: executed  decision: allow
  Fairstay Grocers Ltd (Suite 140, L-105), lease year 2025-01-01 to 2025-12-31: net sales 31379500, breakpoint 30000000 (fixed 30000000), percentage rent 20692.5, billed 18000, tenant owes 2692.5. Sales reported late: 2025-12 (20 days).

▶ Read a Japanese sales report (対象月, 売上高, 控除額)
  status: executed  decision: allow
  Acme Bagels LLC (Suite 100, L-101), lease year 2025-01-01 to 2025-12-31: net sales 203817, breakpoint 844600 (natural: base rent 50676 / 6%), percentage rent not final, billed 0, balance not final. Reports not yet due for 2025-04, 2025-05, 2025-06, 2025-07, 2025-08, 2025-09, 2025-10, 2025-11, 2025-12. With 3 of 12 months reported, sales are 640783 below the breakpoint; the missing months decide whether rent is owed.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 3 lease(s) with percentage rent, lease year 2025: 2 owe 6367.5 in total after amounts billed; 1 to review (Fable Books). Percentage rent earned 24367.5. 1 sales row(s) matched no lease.

▶ Draft Fairstay Grocers' statement (Auto is opted in for drafts here)
  status: executed  decision: allow  (auto)
  statement L-105 drafted for 2692.5 with 0 open marker(s). Nothing was sent.

▶ Draft a request for Fable Books' missing October report
  status: executed  decision: allow  (auto)
  statement L-106 drafted with 3 open marker(s) ([TO CONFIRM: tenant notice address], [TO CONFIRM: report missing], [TO CONFIRM: landlord or manager name]). Nothing was sent.

▶ Auto: approve sending the statement, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the human click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Dana Manager (fictional)
  statement L-105 approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to invoke the lease audit right itself
  status: blocked  decision: block
  reason: Fairlease Percentage Rent never invokes a lease audit right or demands a tenant's books; that is a decision for the landlord and counsel.

Audit log: <demo folder>
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `overage_check` | For every lease with a percentage rent clause: net sales for the lease year, the breakpoint (natural from scheduled base rent, or fixed and prorated for a partial year), percentage rent earned, amounts already billed … | runs |
| `overage_explain` | Show one lease's sales month by month, the breakpoint and how it was set, percentage rent, billed and balance, with every finding. | runs |
| `overage_write_report` | Write the percentage rent worklist as overage.csv (one row per item, blank decision columns) and overage.html into out_dir (default keystone-out/overage). | runs |
| `overage_draft_statement` | Write drafts/statement-<lease>.md: the tenant's percentage rent statement (sales by month, breakpoint, rate, earned, billed, balance). | asks first (Auto can be opted in) |
| `overage_request_send` | After one named human click (even in Auto), record that the reviewed statement draft is approved in statement-requests.csv. | one named click, even in Auto (`binding_send`) |
| `post_tenant_charge` | Fairlease Percentage Rent never bills percentage rent or credits a tenant; your accounting team posts the approved amount. | refused |
| `email_send` | Fairlease Percentage Rent never sends statements or report requests; a person sends the approved draft. | refused |
| `start_sales_audit` | Fairlease Percentage Rent never invokes a lease audit right or demands a tenant's books; that is a decision for the landlord and counsel. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Tenant sales reports (`sales`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `tenant` | text | Tenant, Tenant Name, Tenants, Resident, Resident Name, Name | Mieter, Locataire, 賃借人, 租户 |
| `unit` | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `lease_id` | text | Lease, Lease ID, Lease Code, Lease Number, Lease #, Tenant Code | Mietvertrag, Bail, 契約番号, 合同编号 |
| `period` (required) | text | Period, Month, Sales Month, Reporting Period, Sales Period | Zeitraum, Période, 期間, 期间 |
| `gross_sales` | amount | Gross Sales, Sales, Total Sales, Reported Sales, Net Sales | Umsatz, Chiffre d’affaires, 売上, 销售额 |
| `exclusions` | amount | Exclusions, Deductions, Allowable Deductions, Excluded Sales, Returns, Abzüge | - |
| `reported_on` | date | Reported On, Received, Date Received, Report Date, Submitted | Datum, Date, 日付, 日期 |

### Tenant ledger or percentage rent billed (`billed`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `unit` | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `tenant` | text | Tenant, Tenant Name, Tenants, Resident, Resident Name, Name | Mieter, Locataire, 賃借人, 租户 |
| `lease_id` | text | Lease, Lease ID, Lease Code, Lease Number, Lease #, Tenant Code | Mietvertrag, Bail, 契約番号, 合同编号 |
| `date` (required) | date | Date, Transaction Date, Trans Date, Post Date, Posted, Posting Date | Datum, Date, 日付, 日期 |
| `due_date` | date | Due Date, Due | Fälligkeitsdatum, Date d'échéance, 期日, 截止日期 |
| `charge_code` | text | Charge Code, Charge Type, Code, Type, GL Account, Account | Buchungsart, Code de charge, 費目, 费用项目 |
| `description` | text | Description, Memo, Notes, Detail, Details | Beschreibung, Description, 摘要, 摘要 |
| `charge` | amount | Charges, Charge, Charge Amount, Increase, Debit, Billed | - |
| `payment` | amount | Payments, Payment, Payment Amount, Decrease, Credit, Received | Zahlung, Paiement, 入金, 收款 |
| `amount` | amount | Amount, Net Amount, Transaction Amount | Betrag, Montant, 金額, 金额 |
| `balance` | amount | Balance, Running Balance, Bal | Saldo, Solde, 残高, 余额 |
| `reference` | text | Reference, Ref, Check Number, Check #, Receipt #, Document | Referenz, Référence, 参照番号, 参考号 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| AppFolio | Tenant Ledger (CSV or Excel) | Date, Description, Increase, Decrease, Balance | no |
| Yardi Voyager | Resident Ledger (Excel) | Date, Charge Code, Charges, Payments, Balance | no |
| Buildium | Tenant ledger (CSV) | Date, Memo, Charges, Payments, Balance | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx fairlease-percentage-rent inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairlease-percentage-rent demo
npx -y fairlease-percentage-rent mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairlease-percentage-rent": {
      "command": "npx",
      "args": [
        "-y",
        "fairlease-percentage-rent",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairlease-percentage-rent -- npx -y fairlease-percentage-rent mcp --root .`, or install the `fairlease-percentage-rent` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairlease-percentage-rent approve <id> --as "Your Name"` (or on the local approvals page, `fairlease-percentage-rent approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairlease-percentage-rent kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairlease-percentage-rent tools                 # every tool, its policy and arguments
fairlease-percentage-rent sources               # the columns each input is read from
fairlease-percentage-rent inspect <file>        # how a file would be read (names and shapes, never values)
fairlease-percentage-rent call overage_check '{"leases":"<leases>","sales":"<sales>","year":"<year>"}'
fairlease-percentage-rent eval                  # the private eval cases on the fictional fixtures
fairlease-percentage-rent demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- It works from your lease abstracts and the tenant's own reports, not the signed leases or audited sales.
- Annual calculation only: monthly breakpoints, tiered rates and offsets against other charges are not modelled.
- Not legal or accounting advice. A person decides what to bill and whether to audit a tenant.
