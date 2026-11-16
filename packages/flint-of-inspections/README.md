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

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `flint_check`, `flint_explain` | read | allow |
| `flint_write_report` | report: `flint-inspections.csv` and `.html` (in `--lang`) | allow |
| `flint_draft_notice` | write: notice of entry for a unit due an inspection | ask |
| `flint_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `post_tenant_charge`, `vendor_dispatch`, `email_send` | refused | block |

## Limits

- Flint compares the ratings recorded in your files. It does not look at photos.
- A work order for the unit opened after the inspection counts as follow-up for all its poor items; it does not match work orders to items.
- It does not decide what is damage and what is normal wear and tear. Not legal advice; notice periods for entry are yours to set.
