# Topaz of Utilities (`topaz-of-utilities`)

Re-works RUBS (ratio utility billing) from the utility bills and who lived where, by **your** method, and compares it with what residents were actually billed. It finds residents billed more than the bill, vacant units still billed, duplicate charges, units left out, and bills that spike (often a leak worth fixing before anyone is billed). It never posts a charge or a credit.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y topaz-of-utilities demo
npx -y topaz-of-utilities mcp --root ./utilities
```

## How the split works

1. The common-area part comes off first: the bill's own common-area column, or `common_area_pct`.
2. Each tenancy is weighted by the days it overlaps the bill period. Days a unit has nobody are the owner's share (`vacant_occupants`, default 1, says how many people a vacant unit counts as in an occupant split).
3. The rest is split by your method per utility: `sqft`, `occupants`, `units`, or a mix such as `{ "occupants": 0.5, "sqft": 0.5 }`. Cents always add up to the bill.
4. Each utility charge in the ledger belongs to the latest bill of that utility that ended before it (within `billing_window_days`, default 45). `cap_per_unit` limits what a unit may be billed.

| Finding | Meaning |
|---|---|
| `over_recovery` | Residents were billed more than their share of a bill |
| `billed_while_vacant` | A charge for a unit with nobody in it that period |
| `duplicate_charge`, `overbilled`, `underbilled`, `not_billed` | Per unit, against the split |
| `bill_spike` | Cost per day more than `spike_pct` (default 25%) above the earlier bills of that utility |

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `topaz_check`, `topaz_explain` | read | allow |
| `topaz_write_report` | report: `topaz-rubs.csv` and `.html` (in `--lang`), with the bills and unmatched charges | allow |
| `post_tenant_charge`, `utility_portal_update` | refused | block |

## Files it reads

- **Bills**: utility, service from and to, amount, optional common-area amount. Local headers are read (Versorgung, Zeitraum, Betrag; 種別, 開始日, 終了日, 金額 …).
- **Occupancy**: one row per tenancy (unit, tenant, square feet, occupants, move-in, move-out).
- **RUBS file** (`rubs` schema) and, optionally, the **tenant ledger** with the utility charges billed.

## Limits

- Whether utilities may be billed back, and how, is set by your leases and local rules. Topaz applies your method; it does not check that the method is allowed.
- Not legal or accounting advice.
