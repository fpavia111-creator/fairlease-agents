# Quartz of Delinquency (`quartz-of-delinquency`)

Turns a tenant ledger or an aging report into a delinquency worklist: who owes what and for how long, which stage each balance is at under **your** policy, which late fees were charged too early or above your cap, and who is on a payment plan. It drafts courtesy reminders for a person to send. It never serves a legal notice, files an eviction, reports to a credit bureau or posts a fee.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y quartz-of-delinquency demo
npx -y quartz-of-delinquency mcp --root ./collections
```

## How it works

- **From a ledger**, Quartz ages balances itself: payments and credits pay the oldest open charge first, and what is left ages from its own date into 1–30, 31–60, 61–90 and 90+ days. **From an aging report** (AppFolio Delinquency, Yardi Aged Receivables, Buildium Outstanding balances, or your own columns) it uses the buckets as exported.
- **Stages** are yours: `stages: [{ "days": 1, "name": "reminder" }, ...]` in the policy file, by days of the oldest open charge. Without a policy, reminder at 1 day, second_reminder at 15 and manager_review at 30 are used as internal workflow labels only.
- **Late fees** are checked only when your policy gives `grace_days` and `late_fee`. Rent paid on or before the due date plus `grace_days` is on time; a fee charged in that window, or on a month paid in it, is `late_fee_in_grace`. A fee above `late_fee.max` (or the flat amount, or the percent of the lease rent) is `late_fee_over_policy`. Rent paid late with no fee is a note: a person decides whether to charge it.

| Finding | Meaning |
|---|---|
| `balance_over_deposit` | Balance is more than the deposit in the leases file |
| `over_60_days` | Part of the balance is more than 60 days old |
| `late_fee_in_grace`, `late_fee_over_policy` | A fee to look at; the amount is in `fee_adjustment` |
| `late_fee_not_charged` | Late rent with no fee (note) |
| `on_payment_plan` | On a plan in your policy file; reminders paused |
| `credit_balance`, `below_minimum` | Prepaid, or under your `min_balance` (no action) |
| `lease_ended`, `former_tenant`, `in_collections` | Notes that change how a balance is handled |


<!-- generated:start -->

## A demo run

`npx -y quartz-of-delinquency demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Quartz of Delinquency demo (fictional 24-unit apartment building) in <demo folder>

▶ Age three months of ledger and stage every balance by your policy
  status: executed  decision: allow
  6 delinquent tenant(s) owe 10600 as of 2026-11-15 (29.86% of monthly scheduled rent 35500); 2 manager review, 1 on plan, 3 reminder. Over 60 days: 1850. Late fees to look at for 2 tenant(s) (150).
    106 Farah Haddad         5550  delinquent    manager_review  late_fee_not_charged, balance_over_deposit, over_60_days
    104 Dmitri Volkov        3600  delinquent    manager_review  late_fee_not_charged, balance_over_deposit
    402 Rosa Delgado          750  delinquent    on_plan         on_payment_plan
    205 Julia Novak           475  delinquent    reminder        
    401 Quinn Murphy          150  delinquent    reminder        late_fee_over_policy
    302 Marco Bianchi          75  delinquent    reminder        late_fee_in_grace
    101 Aiko Tanaka          12.5  below_minimum                 below_minimum
    206 Kwame Mensah         -100  credit                        credit_balance

▶ Explain unit 302 (a late fee charged inside the grace period)
  status: executed  decision: allow
  Marco Bianchi (unit 302): balance 75, oldest 12 days, delinquent, stage reminder. Late fee on 2026-11-03 was charged inside the 5-day grace period (rent due 2026-11-01).

▶ Read an AppFolio Delinquency export (property heading rows, a former resident in collections)
  status: executed  decision: allow
  5 delinquent tenant(s) owe 12685 as of 2026-11-15 (35.73% of monthly scheduled rent 35500); 3 manager review, 1 on plan, 1 reminder. Over 60 days: 4160.

▶ Write the worklist with --lang es (Spanish headings, status words and number format)
  status: executed  decision: allow
  Worklist written (es): 6 delinquent tenant(s) owe 10600 as of 2026-11-15 (29.86% of monthly scheduled rent 35500); 2 manager review, 1 on plan, 3 reminder. Over 60 days: 1850. Late fees to look at for 2 tenant(s) (150).

▶ Draft a courtesy reminder for unit 205 (Auto is opted in for drafts here)
  status: executed  decision: allow  (auto)
  reminder 205 drafted for 475 with 0 open marker(s). Nothing was sent.

▶ Draft for unit 402 is refused: on a payment plan
  status: error  decision: allow
  reason: Rosa Delgado is on a payment plan; reminders are paused

▶ Auto: approve sending the reminder, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to serve a notice to pay or quit
  status: blocked  decision: block
  reason: Quartz never drafts or serves a notice to pay or quit or any other legal notice; that is for a person and counsel under local law.

▶ Agent tries to file an eviction
  status: blocked  decision: block
  reason: Quartz never files an eviction or any court paper.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `quartz_check` | Age every tenant balance (from a ledger, oldest first, or from an aging report), put each delinquent tenant at a stage from your own policy, and check late fees against your grace period and fee cap. | runs |
| `quartz_explain` | Show one tenant's open charges by age, stage, deposit, last payment and every finding. | runs |
| `quartz_write_report` | Write the delinquency worklist as quartz-delinquency.csv (one row per item, blank decision columns) and quartz-delinquency.html into out_dir (default keystone-out/quartz). | runs |
| `quartz_draft_reminder` | Write drafts/reminder-<unit>.md: a courtesy payment reminder listing the open charges, marked DRAFT and "not a legal notice". | asks first (Auto can be opted in) |
| `quartz_request_send` | After one named human click (even in Auto), record that the reviewed reminder draft is approved in reminder-requests.csv. | one named click, even in Auto (`binding_send`) |
| `serve_legal_notice` | Quartz never drafts or serves a notice to pay or quit or any other legal notice; that is for a person and counsel under local law. | refused |
| `file_eviction` | Quartz never files an eviction or any court paper. | refused |
| `report_to_credit_bureau` | Quartz never reports a tenant to a credit bureau or collection agency. | refused |
| `post_tenant_charge` | Quartz never posts late fees, reverses fees or applies payments; your accounting team does. | refused |
| `email_send` | Quartz never sends reminders; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Tenant ledger (`ledger`)

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

### Aging or delinquency report (`aging`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `unit` | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `tenant` (required) | text | Tenant, Tenant Name, Tenants, Resident, Resident Name, Name | Mieter, Locataire, 賃借人, 租户 |
| `lease_id` | text | Lease, Lease ID, Lease Code, Lease Number, Lease #, Tenant Code | Mietvertrag, Bail, 契約番号, 合同编号 |
| `status` | text | Tenant Status, Resident Status, Status, Lease Status | Status, Statut, ステータス, 状态 |
| `balance` | amount | Amount Receivable, Total Unpaid, Balance, Total Balance, Total Due, Total | Saldo, Solde, 残高, 余额 |
| `current` | amount | Current, 0-30, 00 - 30, 0 - 30, 0-30 Days, 1-30 | - |
| `d30` | amount | 30-60, 30 - 60, 31-60, 31-60 Days | - |
| `d60` | amount | 60-90, 60 - 90, 61-90, 61-90 Days | - |
| `d90` | amount | 90+, Over 90, 90+ Days, > 90, Over 90 Days, 91+ | - |
| `prepaid` | amount | Prepays, Prepaid, Prepayments, Credits | - |
| `deposit` | amount | Deposit, Deposits Held, Security Deposit | Kaution, Dépôt de garantie, 敷金, 押金 |
| `last_payment` | date | Last Payment, Last Payment Date, Last Receipt | - |
| `in_collections` | text | In Collections, Collections, Collection Status | - |
| `email` | text | Email, Email Address, Tenant Email | E-Mail, E-mail, メールアドレス, 邮箱 |
| `phone` | text | Phone, Phone Number, Mobile, Cell | Telefon, Téléphone, 電話番号, 电话 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| AppFolio | Reports > Delinquency (CSV or Excel) | Unit, Name, Amount Receivable, 00 - 30 or 90+ | no |
| Yardi Voyager | Aged Receivables (Excel) | Resident, Total Unpaid, Over 90 | no |
| Buildium | Reports > Outstanding balances (CSV) | Tenant, Total balance, 0-30 days or 91+ days | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx quartz-of-delinquency inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y quartz-of-delinquency demo
npx -y quartz-of-delinquency mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "quartz-of-delinquency": {
      "command": "npx",
      "args": [
        "-y",
        "quartz-of-delinquency",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add quartz-of-delinquency -- npx -y quartz-of-delinquency mcp --root .`, or install the `quartz-of-delinquency` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `quartz-of-delinquency approve <id> --as "Your Name"` (or on the local approvals page, `quartz-of-delinquency approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`quartz-of-delinquency kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
quartz-of-delinquency tools                 # every tool, its policy and arguments
quartz-of-delinquency sources               # the columns each input is read from
quartz-of-delinquency inspect <file>        # how a file would be read (names and shapes, never values)
quartz-of-delinquency call quartz_check '{}'
quartz-of-delinquency eval                  # the private eval cases on the fictional fixtures
quartz-of-delinquency demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Late-fee and notice rules differ by state and country. Quartz checks fees against the policy you write, not against any law.
- It does not decide who to pursue. A person and, where needed, counsel do.
- Not legal or accounting advice.
