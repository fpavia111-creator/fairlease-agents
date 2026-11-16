# Shale of Vacancy (`shale-of-vacancy`)

Reads one rent roll and shows where income is leaking: physical occupancy, leased percent, exposure, gross potential rent at market, loss to lease, vacancy loss, concessions and economic occupancy, unit by unit. Long-vacant units, rents far under or over market, missing market rents and vacant units with no move-out date are flagged. It never changes prices, unit status or listings.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y shale-of-vacancy demo
npx -y shale-of-vacancy mcp --root ./rent-rolls
```

## Definitions

| Measure | How it is worked out |
|---|---|
| Physical occupancy | Occupied units (including those on notice) ÷ all units |
| Leased | (Occupied − on notice and not re-leased + vacant and pre-leased) ÷ all units |
| Exposure | Vacant and not re-leased + on notice and not re-leased |
| Gross potential rent | Market rent of every unit, per month |
| Loss to lease | Market rent − rent, for occupied units |
| Vacancy loss | Market rent of vacant units, per month; and to date: market rent × 12 ÷ 365 × days since move-out |
| Economic occupancy | (Gross potential − loss to lease − vacancy − concessions) ÷ gross potential |

| Finding | Meaning |
|---|---|
| `long_vacant` | Vacant longer than `long_vacant_days` (default 30) |
| `below_market`, `above_market` | Rent more than `off_market_pct` (default 10%) under or over market |
| `market_rent_missing`, `rent_missing`, `vacant_since_unknown` | Data the measures need |
| `notice_unrented`, `vacant_rented`, `month_to_month`, `concession` | Notes |

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `shale_check`, `shale_explain` | read | allow |
| `shale_write_report` | report: `shale-vacancy.csv` and `.html` (in `--lang`) | allow |
| `pm_system_update`, `listing_publish` | refused | block |

Rent rolls from AppFolio (property heading rows), Yardi (one row per charge, `VACANT` rows), Buildium, Rent Manager, Entrata, OneSite and MRI are recognised; local headers and number formats are read.

## Limits

- Market rents are the ones on your rent roll. Shale does not survey the market or recommend prices.
- Not financial advice.
