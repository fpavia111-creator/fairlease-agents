# Tourmaline of Migration (`tourmaline-of-migration`)

For operators moving from one property management system to another. At cutover it compares the old system's rent roll with the new one's, unit by unit: units missing from the new system or only in it, and tenants, rents, deposits, balances, market rents, areas, lease dates, move-in dates and occupancy that changed on the way. It checks that the totals tie (units, occupied units, rent, deposits, balances, market rent, area) and drafts a punch list for the implementation team. It never signs off go-live, changes either system or deletes anything.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y tourmaline-of-migration demo
npx -y tourmaline-of-migration mcp --root ./cutover
```

## How units are paired

1. `unit_map` in the policy file, and unit aliases a person has accepted into memory.
2. The same unit name (case, spaces and leading zeros ignored).
3. The same trailing number ("B-201" and "201"), only when exactly one unit on each side has it. These pairs are marked `matched_by_number` for a person to confirm.

## What it checks

| Finding | Meaning |
|---|---|
| `missing_in_new`, `extra_in_new` | Unit in the old system only, or in the new system only |
| `tenant_differs`, `occupancy_differs` | Tenant name or vacant / notice / occupied changed |
| `rent_differs`, `deposit_differs`, `balance_differs`, `market_rent_differs`, `sqft_differs` | Amount changed by more than `tolerance` (default 0.01; area by more than 0.5) |
| `lease_dates_differ`, `move_in_differs` | Lease start, lease end or move-in changed |
| `matched_by_number` | Paired by trailing number only; confirm and teach the alias |

The report adds a **Totals** table, old against new. Rent rolls with one row per charge (Yardi with lease charges and similar) are grouped per unit first. Set `fields` in the policy to compare fewer fields.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `tourmaline_check`, `tourmaline_explain` | read | allow |
| `tourmaline_write_report` | report: `tourmaline-migration.csv` and `.html` (in `--lang`), with totals | allow |
| `tourmaline_draft_punchlist` | write: every open unit and untied total, for the implementation team | ask |
| `tourmaline_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `tourmaline_recall`, `tourmaline_learn` | domain memory: the new name of an old unit (`unit_alias`) | allow (learning only proposes) |
| `tourmaline_accept_learning`, `tourmaline_retire_memory` | action, `accept_learning` | one named click, even in Auto |
| `approve_go_live`, `pm_system_update`, `delete_old_system_data`, `email_send` | refused | block |

## Limits

- Tourmaline compares two rent roll exports. It does not compare ledgers line by line, open either system, or decide when you are ready to go live.
- Export both rent rolls for the same cutover date, or every timing difference will show up as a finding.
