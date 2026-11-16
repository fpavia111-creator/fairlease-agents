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

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `feldspar_check`, `feldspar_explain` | read | allow |
| `feldspar_write_report` | report: `feldspar-estoppels.csv` and `.html` (in `--lang`) | allow |
| `feldspar_draft_request` | write: follow-up to return, sign, re-date or correct | ask |
| `feldspar_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `esign_send`, `data_room_upload`, `pm_system_update`, `email_send` | refused | block |

## Limits

- Feldspar compares what was typed into your estoppel log with your lease abstracts. It does not read signed certificates or leases.
- What a tenant's statement means for the deal is for counsel. Not legal advice.
