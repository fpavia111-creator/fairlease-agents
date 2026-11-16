# Marble of CAM (`marble-of-cam`)

Reconciles common area maintenance (CAM) and operating expenses for commercial leases, tenant by tenant, from **your own files**: the general ledger for the year, your lease abstracts and a small CAM setup file. It writes the reconciliation worklist and drafts each tenant's statement. It never posts a charge, never changes the property management system and never sends anything.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y marble-of-cam demo                 # fictional shopping center and tenants
npx -y marble-of-cam mcp --root ./cam-2025
npx -y marble-of-cam mcp --root ./cam-2025 --lang de   # reports in German
```

## What it works out

| Step | How |
|---|---|
| GL to pools | Each GL account goes to the pool that lists it (`6100`, or `62*` for a range). Accounts in `excluded_accounts` are left out and listed. Accounts in no pool are **left out and listed** (`unmapped_accounts`), never guessed. |
| Gross-up | Pools marked `variable` are grossed up from `occupancy_pct` to `gross_up_to_pct`, never down, and only for leases that allow it (`gross_up: false` turns it off). |
| Share | The lease's `share_pct`, else its area over `denominator_sqft` or the property's rentable area. Part-year tenants pay for the days they occupied. |
| Excluded pools | A lease's `excluded_pools` (for example roof and structure) are skipped for that tenant. |
| Base year / expense stop | With `base_amount`, the tenant pays its share of the pools above its share of the base amount. |
| Cap | On pools marked `controllable`: cumulative or compounding (`base_amount × (1 + pct)^years`) or non-cumulative (last year's capped charge from `prior_years` × (1 + pct)). With no prior-year amount the tenant is marked **review**. |
| Admin fee | The lease's `admin_fee_pct` (or the CAM file's) on the amount after stops and caps. |
| Estimates | CAM charges found in the tenant ledger (any charge code that reads as CAM, in eight languages), with months that were not billed called out. Without a ledger, the lease's `monthly_estimate` is used and the result says so. |
| Recovery | What share of the pools the tenants carry; the rest falls to the owner (vacancy, caps, stops). |

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `marble_check` | read | allow |
| `marble_explain` | read: one tenant, pool by pool | allow |
| `marble_write_report` | report: `marble-cam.csv` (blank decision columns) and `.html` in `--lang` | allow |
| `marble_draft_statement` | write: one tenant's statement, marked DRAFT | ask |
| `marble_request_send` | action, `binding_send`, tied to the draft's sha256 | one named click, even in Auto |
| `marble_recall`, `marble_learn` | domain memory: GL accounts that belong in a pool | allow (learning only proposes) |
| `marble_accept_learning`, `marble_retire_memory` | action, `accept_learning` | one named click, even in Auto |
| `post_tenant_charge`, `email_send`, `pm_system_update` | refused | block |

## Domain memory

Marble can remember one kind of fact: **a GL account that belongs in a pool** (`account_pool`). A proposed fact changes nothing until a named person accepts it; accepted facts add the account to the pool in later runs and are listed under `learned_accounts`. Memory never changes shares, caps, stops or the gross-up target. `--no-memory` runs without it.

## Files it reads

- **Leases** (`leases` schema, shared by the Keystone agents): unit, tenant, dates, area, and the `cam` block: `share_pct`, `denominator_sqft`, `base_year`, `base_amount`, `cap` (`pct`, `type`, `base_year`, `base_amount`), `excluded_pools`, `admin_fee_pct`, `monthly_estimate`, `gross_up`. See [`fixtures/leases.json`](fixtures/leases.json).
- **CAM setup** (`cam` schema): year, rentable area, occupancy, gross-up target, pools with their accounts, excluded accounts, prior-year capped amounts. See [`fixtures/cam-2025.json`](fixtures/cam-2025.json).
- **GL detail**: account and amount (or debit and credit). AppFolio, Yardi Voyager and Buildium general ledger layouts are recognised, including AppFolio's account heading rows; German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean column names are read too. `marble-of-cam inspect <file>` shows how a file is read without printing values.
- **Tenant ledger** (optional): CAM estimate charges by lease or unit.

## Limits

- It follows the terms in your leases file. It does not read the signed lease; it is not a legal reading of any lease, and leases differ on what a cap or base year covers.
- The system export layouts were written from knowledge of the exports and were not tested against a live account.
- Report headings, labels and limits follow `--lang` (translated by Claude, native review pending); the one-line summary and statement drafts stay in English.
- Not legal or accounting advice. A person decides what to bill and what to send.
