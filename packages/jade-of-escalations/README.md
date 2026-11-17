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
| `billed_outside_term` | Rent billed in a month before the lease starts or after it ends |
| `billed_twice` | The month's rent charged twice |
| `index_missing` | A CPI escalation month has no index value in your file; the lease is marked **review** |

The schedule comes from the lease: explicit rent steps, or the escalation clause applied every `every_months` from the first anniversary (fixed percent, fixed amount, or CPI with base month, lag, floor and cap). Part months are charged by days; free rent is taken off.


## Files it reads

- **Leases** (`leases` schema). **Indexes** (optional) with CPI-style values you copy from your source; nothing is looked up online.
- **Ledger**: rent charges by lease id, or by unit and tenant. A lease id is matched however it is typed (`L-101`, `l101`); without one, the unit is matched within the row's property. A line whose code is a GL account number is read by its description, and a payment line coded as rent is not counted as billing. AppFolio, Yardi and Buildium ledgers are recognised. Charge codes such as `RNT` or `RNTCOM` and words such as Rent, Miete, Loyer, Renta, Aluguel, Canone, 家賃, 租金 and 임대료 are read as rent; local column names and day-first dates are read too.

<!-- generated:start -->

## A demo run

`npx -y jade-of-escalations demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Jade of Escalations demo (fictional shopping center) in <demo folder>

▶ Check 13 months of rent charges against six escalation schedules
  status: executed  decision: allow
  6 lease(s), 2025-01 to 2026-01: 3 with billing differences, 0 to review. Underbilled 34125.83 in total.
    L-101 Acme Bagels LLC        expected    54919.6  billed      53560    -1359.6  escalation_missed
    L-102 Brightside Dental PC   expected   98101.43  billed   98101.43          0  
    L-103 Cobalt Fitness Inc     expected  179101.64  billed  178735.41    -366.23  escalation_missed
    L-104 Delta Phone Repair     expected      34736  billed      34736          0  
    L-105 Evergreen Grocers Ltd  expected     421200  billed     388800     -32400  not_billed
    L-106 Fable Books            expected      52500  billed      52500          0  

▶ Explain Cobalt Fitness (CPI escalation with a 2% floor and 4% cap)
  status: executed  decision: allow
  Cobalt Fitness Inc (L-103): expected 179101.64, billed 178735.41, difference -366.23. Billed at the old rent after the 2025-01-01 CPI 2.74% (2023-11 → 2024-11) step: 2025-01 (-366.23).

▶ Read a French ledger (Bail, Lot, Loyer, 2 704,00)
  status: executed  decision: allow
  6 lease(s), 2025-06 to 2025-07: 6 with billing differences, 0 to review. Underbilled 124727.09 in total.

▶ Rent changes in the next 120 days, as a calendar file
  status: executed  decision: allow
  2 rent change(s) in the next 120 days from 2026-01-15.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 6 lease(s), 2025-01 to 2026-01: 3 with billing differences, 0 to review. Underbilled 34125.83 in total.

▶ Agent tries to bill the missed escalation itself
  status: blocked  decision: block
  reason: Jade never bills a missed escalation or credits an overcharge; your accounting team does after review.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `jade_check` | For every lease and month, compare rent billed with the lease schedule (steps, fixed percent or amount escalations, CPI with floor and cap, free rent, part months by days). | runs |
| `jade_explain` | Show one lease's schedule against what was billed, month by month. | runs |
| `jade_write_report` | Write the escalation billing worklist as jade-escalations.csv (one row per item, blank decision columns) and jade-escalations.html into out_dir (default keystone-out/jade). | runs |
| `jade_upcoming` | List every rent change between as_of and as_of + days with the old and new rent, and write jade-upcoming.ics (a calendar file) and jade-upcoming.csv/.html into out_dir (default keystone-out/jade). | runs |
| `post_tenant_charge` | Jade never bills a missed escalation or credits an overcharge; your accounting team does after review. | refused |
| `pm_system_update` | Jade never changes recurring charges in the property management system. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Tenant ledger or rent charges (`ledger`)

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

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx jade-of-escalations inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y jade-of-escalations demo
npx -y jade-of-escalations mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "jade-of-escalations": {
      "command": "npx",
      "args": [
        "-y",
        "jade-of-escalations",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add jade-of-escalations -- npx -y jade-of-escalations mcp --root .`, or install the `jade-of-escalations` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `jade-of-escalations approve <id> --as "Your Name"` (or on the local approvals page, `jade-of-escalations approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`jade-of-escalations kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
jade-of-escalations tools                 # every tool, its policy and arguments
jade-of-escalations sources               # the columns each input is read from
jade-of-escalations inspect <file>        # how a file would be read (names and shapes, never values)
jade-of-escalations call jade_check '{"leases":"<leases>","ledger":"<ledger>","from":"<from>","to":"<to>"}'
jade-of-escalations eval                  # the private eval cases on the fictional fixtures
jade-of-escalations demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- It checks billing against your abstracts, not the signed leases.
- Not legal or accounting advice. A person decides what to bill or credit.
