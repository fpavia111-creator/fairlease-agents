# Fairlease CAM Reconciliation (`fairlease-cam-reconciliation`)

Reconciles common area maintenance (CAM) and operating expenses for commercial leases, tenant by tenant, from **your own files**: the general ledger for the year, your lease abstracts and a small CAM setup file. It writes the reconciliation worklist and drafts each tenant's statement. It never posts a charge, never changes the property management system and never sends anything.

MIT · Node 20 or newer · local files only · no credentials · built on [`fairlease-core`](../fairlease-core)

```bash
npx -y fairlease-cam-reconciliation demo                 # fictional shopping center and tenants
npx -y fairlease-cam-reconciliation mcp --root ./cam-2025
npx -y fairlease-cam-reconciliation mcp --root ./cam-2025 --lang de   # reports in German
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


## Domain memory

Fairlease CAM Reconciliation can remember one kind of fact: **a GL account that belongs in a pool** (`account_pool`). A proposed fact changes nothing until a named person accepts it; accepted facts add the account to the pool in later runs and are listed under `learned_accounts`. Memory never changes shares, caps, stops or the gross-up target. `--no-memory` runs without it.

## Files it reads

- **Leases** (`leases` schema, shared by the Fairlease agents): unit, tenant, dates, area, and the `cam` block: `share_pct`, `denominator_sqft`, `base_year`, `base_amount`, `cap` (`pct`, `type`, `base_year`, `base_amount`), `excluded_pools`, `admin_fee_pct`, `monthly_estimate`, `gross_up`. See [`fixtures/leases.json`](fixtures/leases.json).
- **CAM setup** (`cam` schema): year, rentable area, occupancy, gross-up target, pools with their accounts, excluded accounts, prior-year capped amounts. See [`fixtures/cam-2025.json`](fixtures/cam-2025.json).
- **GL detail**: account and amount (or debit and credit). AppFolio, Yardi Voyager and Buildium general ledger layouts are recognised, including AppFolio's account heading rows; German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean column names are read too. `fairlease-cam-reconciliation inspect <file>` shows how a file is read without printing values.
- **Tenant ledger** (optional): CAM estimate charges by lease or unit.

Things it guards against: GL lines dated outside the CAM year, and lines or leases that belong to another property, are left out and counted (`gl_outside_year`, `other_property_rows`). A GL account listed in two pools is counted once and pointed out (`account_in_two_pools`). `shares_over_100` looks at shares in force at the same time, so two tenants who follow one another in a suite are not added together. A cap on controllable expenses is applied first and a base-year stop second, and the result never goes below zero. Excluded pool names and lease ids match whatever their capitals.

<!-- generated:start -->

## A demo run

`npx -y fairlease-cam-reconciliation demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairlease CAM Reconciliation demo (fictional shopping center, tenants and ledger), Auto mode on

▶ Reconcile 2025 CAM for six tenants
  status: executed  decision: allow
  2025 CAM for HPP: pools 433000 (5 pools), 6 lease(s). Tenants owe 8210.88, credits 4933.33. Recovered 203812.92 of 433000 (47.07%). 1 need review. 1 GL account(s) unmapped.
    L-101 Acme Bagels LLC            5%  due   22354.75  billed     21600  tenant owes         754.75  gross_up_applied, cap_applied
    L-102 Brightside Dental PC     7.5%  due      36025  billed     31900  tenant owes           4125  gross_up_applied, estimate_months_missing
    L-103 Cobalt Fitness Inc        20%  due   84333.33  billed     87600  credit to tenant   3266.67  pool_excluded, gross_up_applied
    L-104 Delta Phone Repair         3%  due      14410  billed     13800  tenant owes            610  gross_up_applied
    L-105 Fairstay Grocers Ltd      50%  due   28333.34  billed     30000  credit to tenant   1666.66  gross_up_applied, expense_stop
    L-106 Fable Books             6.25%  due   27471.13  billed     24750  tenant owes        2721.13  gross_up_applied, cap_needs_data

▶ Explain Acme Bagels (cumulative 5% cap on controllable expenses)
  status: executed  decision: allow
  Acme Bagels LLC (Suite 100, L-101): share 5%, total 22354.75, billed 21600, tenant owes 754.75. Variable pools grossed up from 90% to 95% occupancy (+183.33 for this tenant). Controllable share 11433.33 is over the 5% cumulative cap (9922.5); reduced by 1510.83.

▶ Propose that GL 6150 belongs in a pool (waits for a person)
  status: executed  decision: allow
  Stored MEM-49670c3e3612 as waiting. It changes nothing until a named person accepts it with cam_accept_learning (id "MEM-49670c3e3612", decision "accept").

▶ Write the worklist in German (--lang de)
  status: executed  decision: allow
  Worklist written (de): 2025 CAM for HPP: pools 433000 (5 pools), 6 lease(s). Tenants owe 8210.88, credits 4933.33. Recovered 203812.92 of 433000 (47.07%). 1 need review. 1 GL account(s) unmapped.

▶ Draft the statement for Acme Bagels (Auto is opted in for drafts here)
  status: executed  decision: allow  (auto)
  statement L-101 drafted for 754.75 with 0 open marker(s). Nothing was sent.

▶ Auto: approve sending the statement, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the human click (recorded; a person sends it)
  status: executed  decision: ask  approved by: Dana Manager (fictional)
  statement L-101 approved and recorded. Nothing was sent or paid by the agent.

▶ Agent tries to post the charge itself
  status: blocked  decision: block
  reason: Fairlease CAM Reconciliation never posts charges or credits to tenant ledgers; your accounting team posts the approved reconciliation.

Audit log: <demo folder>
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `cam_check` | Sum the GL into the CAM pools, gross up variable pools, then for every lease in force work out its pro-rata share, base-year stop, controllable-expense cap, admin fee, estimates billed and the balance due or credit. | runs |
| `cam_explain` | Show one lease's pool-by-pool share, stop, cap, admin fee, estimates and balance, with every finding. | runs |
| `cam_write_report` | Write the CAM reconciliation worklist as cam.csv (one row per item, blank decision columns) and cam.html into out_dir (default keystone-out/cam). | runs |
| `cam_draft_statement` | Write drafts/statement-<lease>.md: one tenant's reconciliation statement (pools, share, stop, cap, admin fee, estimates, balance due or credit). | asks first (Auto can be opted in) |
| `cam_request_send` | After one named human click (even in Auto), record that the reviewed statement draft is approved in statement-requests.csv. | one named click, even in Auto (`binding_send`) |
| `cam_recall` | Search this agent's own memory of the customer's setup: accepted facts (in use) and facts waiting for a person. | runs |
| `cam_learn` | Propose one fact about the customer's setup for this agent to remember. | runs |
| `cam_accept_learning` | A named person accepts or rejects a fact waiting in this agent's memory. | one named click, even in Auto (`accept_learning`) |
| `cam_retire_memory` | A named person stops an accepted fact from applying. | one named click, even in Auto (`accept_learning`) |
| `post_tenant_charge` | Fairlease CAM Reconciliation never posts charges or credits to tenant ledgers; your accounting team posts the approved reconciliation. | refused |
| `email_send` | Fairlease CAM Reconciliation never sends email; a person sends the approved statement. | refused |
| `pm_system_update` | Fairlease CAM Reconciliation never changes recurring charges in the property management system. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### General ledger detail (`gl`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `account` (required) | text | GL Account, Account, Account Number, Account Code, Acct, GL Code | Konto, Compte, 勘定科目, 科目代码 |
| `account_name` | text | Account Name, Account Description, GL Account Name, Description of Account, Acct Name | Kontobezeichnung, Libellé du compte, 勘定科目名, 科目名称 |
| `date` | date | Date, Post Date, Posting Date, Transaction Date, Trans Date | Datum, Date, 日付, 日期 |
| `period` | text | Period, Post Month, Month, Fiscal Period, Accounting Period | Zeitraum, Période, 期間, 期间 |
| `description` | text | Description, Memo, Remarks, Notes, Line Description | Beschreibung, Description, 摘要, 摘要 |
| `vendor` | text | Vendor, Payee, Payee Name, Vendor Name, Person/Company, Name | Lieferant, Fournisseur, 仕入先, 供应商 |
| `debit` | amount | Debit, Debits, Dr | Soll, Débit, 借方, 借方 |
| `credit` | amount | Credit, Credits, Cr | Haben, Crédit, 貸方, 贷方 |
| `amount` | amount | Amount, Net, Net Amount, Total | Betrag, Montant, 金額, 金额 |
| `reference` | text | Reference, Ref, Control, Document, Check #, Invoice | Referenz, Référence, 参照番号, 参考号 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| AppFolio | Reports > General Ledger (CSV or Excel) | GL Account, Payee / Payer, Debit, Credit | no |
| Yardi Voyager | General Ledger detail (Excel) | Account, Account Description, Person/Description, Control | no |
| Buildium | Reports > General ledger (CSV) | Account, Payee, Memo, Debit, Credit | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Tenant ledger or CAM charges billed (`billed`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `unit` | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `tenant` | text | Tenant, Tenant Name, Tenants, Resident, Resident Name, Name | Mieter, Locataire, 賃借人, 租户 |
| `lease_id` | text | Lease, Lease ID, Lease Code, Lease Number, Lease #, Tenant Code | Mietvertrag, Bail, 契約番号, 合同编号 |
| `date` (required) | date | Date, Transaction Date, Trans Date, Post Date, Posted, Posting Date | Datum, Date, 日付, 日期 |
| `due_date` | date | Due Date, Due | Fälligkeitsdatum, Date d'échéance, 期日, 截止日期 |
| `charge_code` | text | Charge Code, Charge Type, Code, Type, GL Account, Account | Buchungsart, Code de charge, 費目, 费用项目 |
| `description` | text | Description, Memo, Notes, Detail, Details | Beschreibung, Description, 摘要, 摘要 |
| `charge` | amount | Charges, Charge, Charge Amount, Increase, Debit, Billed | - |
| `payment` | amount | Payments, Payment, Payment Amount, Decrease, Credit, Received | Zahlung, Paiement, 入金, 收款 |
| `amount` | amount | Amount, Net Amount, Transaction Amount | Betrag, Montant, 金額, 金额 |
| `balance` | amount | Balance, Running Balance, Bal | Saldo, Solde, 残高, 余额 |
| `reference` | text | Reference, Ref, Check Number, Check #, Receipt #, Document | Referenz, Référence, 参照番号, 参考号 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| AppFolio | Tenant Ledger (CSV or Excel) | Date, Description, Increase, Decrease, Balance | no |
| Yardi Voyager | Resident Ledger (Excel) | Date, Charge Code, Charges, Payments, Balance | no |
| Buildium | Tenant ledger (CSV) | Date, Memo, Charges, Payments, Balance | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx fairlease-cam-reconciliation inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Memory

fairlease-cam-reconciliation can remember facts about your setup so the next run does not have to be told again. `cam_learn` only proposes a fact; it changes nothing until a named person accepts it with `cam_accept_learning`, which is one click even in Auto. Facts live in one hash-chained file per agent under `.keystone/memory/`; if the chain does not verify, no fact is used. Credentials, personal identifiers and text that reads like instructions to an AI are refused. Run without memory with `--no-memory`.

| Kind | What an accepted fact changes |
|---|---|
| `account_pool` | adds the account to that pool in every later reconciliation; never changes shares, caps, stops or the gross-up target |
| `note` | nothing (shown by recall only) |

```bash
fairlease-cam-reconciliation memory list
fairlease-cam-reconciliation memory accept MEM-1a2b3c4d5e6f --as "Your Name"
fairlease-cam-reconciliation memory retire MEM-1a2b3c4d5e6f --as "Your Name" --reason "code retired"
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairlease-cam-reconciliation demo
npx -y fairlease-cam-reconciliation mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairlease-cam-reconciliation": {
      "command": "npx",
      "args": [
        "-y",
        "fairlease-cam-reconciliation",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairlease-cam-reconciliation -- npx -y fairlease-cam-reconciliation mcp --root .`, or install the `fairlease-cam-reconciliation` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairlease-cam-reconciliation approve <id> --as "Your Name"` (or on the local approvals page, `fairlease-cam-reconciliation approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairlease-cam-reconciliation kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairlease-cam-reconciliation tools                 # every tool, its policy and arguments
fairlease-cam-reconciliation sources               # the columns each input is read from
fairlease-cam-reconciliation inspect <file>        # how a file would be read (names and shapes, never values)
fairlease-cam-reconciliation call cam_check '{"leases":"<leases>","cam":"<cam>","gl":"<gl>"}'
fairlease-cam-reconciliation eval                  # the private eval cases on the fictional fixtures
fairlease-cam-reconciliation demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- It follows the terms in your leases file. It does not read the signed lease; it is not a legal reading of any lease, and leases differ on what a cap or base year covers.
- The system export layouts were written from knowledge of the exports and were not tested against a live account.
- Report headings, labels and limits follow `--lang` (translated by Claude, native review pending); the one-line summary and statement drafts stay in English.
- Not legal or accounting advice. A person decides what to bill and what to send.
