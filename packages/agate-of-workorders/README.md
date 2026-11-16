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
| `repeat` | Same category in the same unit within `repeat_days` (90) |
| `cost_outlier` | Cost over `outlier_factor` (4) × the category median, with three or more costs to compare |
| `cost_missing`, `created_missing` | Data to fix |

Default targets, which you should replace with your own: emergency 1 day, high 3, normal 7, low 14. Priority and status words in nine languages are read; cancelled orders are left out.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `agate_check`, `agate_explain` | read | allow |
| `agate_write_report` | report: `agate-workorders.csv` and `.html` (in `--lang`) with the vendor scorecard | allow |
| `vendor_dispatch`, `approve_invoice`, `close_work_order` | refused | block |

AppFolio work orders, Buildium tasks and Yardi service requests are recognised.

## Limits

- Dates only: targets are counted in days, not hours.
- A possible-emergency flag is a prompt for a person to look today. It is not a safety assessment, and a missing flag does not mean a condition is safe.
