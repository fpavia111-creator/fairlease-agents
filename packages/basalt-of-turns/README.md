# Basalt of Turns (`basalt-of-turns`)

Tracks every unit turn from move-out to make-ready to move-in: days to ready against your target, days vacant, cost by trade against your budget, the part chargeable to the former tenant and the rent lost while the unit sits. It never dispatches a vendor, approves an invoice or bills a former tenant.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y basalt-of-turns demo
npx -y basalt-of-turns mcp --root ./turns
```

## What it checks

| Finding | Meaning |
|---|---|
| `over_target`, `open_over_target` | Days from move-out to ready over `target_days` (default 7), finished or still open |
| `over_budget` | Turn cost over your budget for the unit's bedroom count (or `default_budget`) |
| `ready_not_leased` | Ready for more than `ready_to_lease_days` (default 14) with no move-in |
| `cost_missing`, `vendor_missing` | Lines without a cost or a vendor |
| `chargeable_unknown`, `chargeable_partial`, `tenant_chargeable` | What to put on the deposit statement ([Jasper of Deposits](../jasper-of-deposits) checks that) |

Rent lost = market rent × 12 ÷ 365 × days from move-out to move-in (or to `as_of`).

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `basalt_check`, `basalt_explain` | read | allow |
| `basalt_write_report` | report: `basalt-turns.csv` and `.html` (in `--lang`) | allow |
| `vendor_dispatch`, `approve_invoice`, `post_tenant_charge` | refused | block |

The turn file is one row per trade (unit, move-out, ready, move-in, category, vendor, cost, tenant chargeable, market rent). Local headers are read (Unità, Data uscita, Costo; Einheit, Auszug, Kosten; 退去日, 費用 …).

## Limits

- What a former tenant can be charged is decided by a person under the lease and local rules.
- Not legal or accounting advice.
