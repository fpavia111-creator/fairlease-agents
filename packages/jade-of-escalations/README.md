# Jade of Escalations (`jade-of-escalations`)

Checks rent billed against each lease's escalation schedule, month by month, and lists the rent changes coming up. Missed escalations are one of the most common revenue leaks in commercial property: a recurring charge nobody updated on the anniversary. Jade finds them from the ledger you already export. It never bills, credits or changes recurring charges.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y jade-of-escalations demo
npx -y jade-of-escalations mcp --root ./leases
```

## What it checks

| Finding | Meaning |
|---|---|
| `escalation_missed` | Billed at the rent before a step or increase, after the step took effect |
| `underbilled`, `overbilled` | Billed below or above the schedule for the month |
| `not_billed` | No rent charge in a month the lease is in force |
| `billed_during_free_rent` | Rent billed in an abatement month |
| `index_missing` | A CPI escalation month has no index value in your file; the lease is marked **review** |

The schedule comes from the lease: explicit rent steps, or the escalation clause applied every `every_months` from the first anniversary (fixed percent, fixed amount, or CPI with base month, lag, floor and cap). Part months are charged by days; free rent is taken off.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `jade_check`, `jade_explain` | read | allow |
| `jade_write_report` | report: `jade-escalations.csv` and `.html` (in `--lang`) | allow |
| `jade_upcoming` | report: rent changes in the next N days, as `jade-upcoming.ics` (any calendar) plus CSV and HTML | allow |
| `post_tenant_charge`, `pm_system_update` | refused | block |

## Files it reads

- **Leases** (`leases` schema). **Indexes** (optional) with CPI-style values you copy from your source; nothing is looked up online.
- **Ledger**: rent charges by lease id, or by unit and tenant. AppFolio, Yardi and Buildium ledgers are recognised. Charge codes such as `RNT` or `RNTCOM` and words such as Rent, Miete, Loyer, Renta, Aluguel, Canone, 家賃, 租金 and 임대료 are read as rent; local column names and day-first dates are read too.

## Limits

- It checks billing against your abstracts, not the signed leases.
- Not legal or accounting advice. A person decides what to bill or credit.
