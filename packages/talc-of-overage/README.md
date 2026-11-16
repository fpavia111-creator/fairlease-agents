# Talc of Overage (`talc-of-overage`)

Works out percentage rent (overage rent) for retail tenants from the sales reports they send: net sales for the lease year, the breakpoint, the rent earned over it, what was already billed and the balance. It chases the paperwork too: missing, late, revised and conflicting reports are flagged, and a year stays at **review** until every month is in. It never bills, sends or starts a sales audit.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y talc-of-overage demo
npx -y talc-of-overage mcp --root ./retail
```

## How it works it out

- **Lease year** starts at the lease's `year_start_month` (a February lease year 2025 runs Feb 2025 to Jan 2026). Only months the lease is in force count.
- **Natural breakpoint**: the scheduled base rent for those months (escalations and steps included, free rent not taken off) divided by the rate.
- **Fixed breakpoint**: the amount in the lease, prorated by days in a partial year unless `prorate_partial_year` is `false`.
- **Net sales**: gross sales less the exclusions in your sales file. Percentage rent = rate × net sales over the breakpoint.
- **Billed**: percentage rent charges in the optional ledger dated in the lease year (or up to `billed_through`, for a true-up billed in the spring).

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

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `talc_check`, `talc_explain` | read | allow |
| `talc_write_report` | report: `talc-overage.csv` and `.html` (in `--lang`) | allow |
| `talc_draft_statement` | write: the tenant's statement, or a request for missing reports | ask |
| `talc_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `post_tenant_charge`, `email_send`, `start_sales_audit` | refused | block |

## Files it reads

- **Leases** (`leases` schema) with a `percentage_rent` clause: `rate_pct`, `breakpoint` (`"natural"` or an amount), `year_start_month`, `report_due_days`, `prorate_partial_year`.
- **Sales reports**: one row per tenant and month, by lease id or by unit and tenant. Months such as `2025-03`, `Mar 2025`, `03/2025`, `März 2025` or `2025年3月` are read; so are local column names (Umsatz, Chiffre d’affaires, Ventas, 売上高, 销售额, 매출) and local number formats.
- **Billed** (optional): a tenant ledger. Codes such as `PCT` or `OVG` and words such as percentage rent, overage rent, Umsatzmiete or loyer variable are read as percentage rent.

## Limits

- It works from your lease abstracts and the tenant's own reports, not the signed leases or audited sales.
- Annual calculation only: monthly breakpoints, tiered rates and offsets against other charges are not modelled.
- Not legal or accounting advice. A person decides what to bill and whether to audit a tenant.
