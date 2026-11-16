# Granite of Rent Rolls (`granite-of-rentrolls`)

Checks a rent roll against **your own lease abstracts**, unit by unit, as of the date it was run: is the rent what the lease says after its steps and escalations, is the deposit right, do the area, dates and tenant match, and is anything occupied without a lease or leased but missing. Useful at month end, before an owner report, and in an acquisition or a system migration. It never changes the property management system.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y granite-of-rentrolls demo
npx -y granite-of-rentrolls mcp --root ./rent-roll
```

## What it checks

| Finding | Meaning |
|---|---|
| `rent_under_lease`, `rent_over_lease`, `rent_missing` | Rent roll rent against the lease rent on the as-of date: explicit steps, fixed percent or amount escalations, CPI escalations with floor and cap (from your index file), free rent |
| `deposit_mismatch`, `deposit_not_cash` | Deposit held against the lease; letters of credit and guaranties expect no cash |
| `area_mismatch`, `start_mismatch`, `end_mismatch`, `tenant_mismatch` | The rent roll and the lease disagree |
| `holdover` | The lease ended and the unit is still shown occupied |
| `no_lease` | Occupied, but there is no lease for the unit in your file |
| `vacant_with_lease` | Shown vacant while a lease is in force |
| `missing_from_rent_roll` | A lease in force whose unit is not on the rent roll |
| `rent_needs_index`, `rent_not_in_lease` | Granite could not work out the lease rent and says what is missing (status **review**) |

Unit spellings are matched ("Suite 100", "Ste. 0100", "#100", "101号室"), and tenant names are compared without legal forms.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `granite_check`, `granite_explain` | read | allow |
| `granite_write_report` | report: `granite-rent-roll.csv` and `.html` (in `--lang`) | allow |
| `granite_recall`, `granite_learn` | domain memory: what your charge codes mean | allow (learning only proposes) |
| `granite_accept_learning`, `granite_retire_memory` | action, `accept_learning` | one named click, even in Auto |
| `pm_system_update`, `post_tenant_charge` | refused | block |

## Files it reads

- **Rent roll**: AppFolio (with its property heading rows), Yardi Voyager "with lease charges" (one row per charge; codes such as `RNTCOM` and `CAMEST` are read by their start, and you can teach Granite your own), Yardi commercial, Buildium, Rent Manager, Entrata, RealPage OneSite and MRI layouts, or any file with recognisable columns, including German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean headers. Shift_JIS, EUC-KR, GB18030, UTF-16 and Windows-1252 files are decoded.
- **Leases** (`leases` schema shared by the Keystone agents). See [`fixtures/leases.json`](fixtures/leases.json).
- **Indexes** (optional): CPI-style values you copy from your source. Nothing is looked up online.

## Limits

- It compares the rent roll with your abstracts, not with the signed leases.
- The export layouts were written from knowledge of the exports and were not tested against a live account.
- Not legal or accounting advice. A person corrects the system and decides what to bill.
