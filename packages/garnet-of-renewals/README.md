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

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `garnet_check`, `garnet_explain` | read | allow |
| `garnet_write_report` | report: `garnet-renewals.csv` and `.html` (in `--lang`) | allow |
| `garnet_draft_offer` | write: an offer letter; refused above your cap or for a tenant on notice | ask |
| `garnet_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `pm_system_update`, `esign_send`, `email_send` | refused | block |

## Limits

- `max_increase_pct` and `notice_days` are required and have no defaults: they come from your policy and the rules where the property is. Garnet does not know rent-control or notice law.
- Not legal advice.
