# Fairlease Security Deposits (`fairlease-security-deposits`)

Checks every move-out security deposit against **your own** rules before the statement goes out: the return deadline, each deduction and its support, useful-life proration for replaced items, possible normal wear and tear, the unpaid balance and the refund. Then it drafts the itemised statement for a person to send. It never pays a refund, posts a charge or sends anyone to collections.

MIT · Node 20 or newer · local files only · no credentials · built on [`fairlease-core`](../fairlease-core)

```bash
npx -y fairlease-security-deposits demo
npx -y fairlease-security-deposits mcp --root ./move-outs
```

## What it checks

| Finding | Meaning |
|---|---|
| `deadline_passed`, `deadline_soon` | Move-out date plus your `return_days`, against `as_of` |
| `returned_late`, `refund_differs` | A statement already sent late, or for a different amount |
| `possible_normal_wear` | A deduction matches your wear words (nail holes, touch-up, full repaint, …); a person decides |
| `no_evidence` | No photo, invoice or receipt reference (when `require_evidence` is on, the default) |
| `useful_life_proration` | A replacement charged at its age: amount × (1 − age ÷ useful life) |
| `unpaid_balance`, `tenant_owes` | From the final ledger; deductions above the deposit |
| `deposit_mismatch`, `deposit_unknown`, `no_forwarding_address` | Data to fix before a statement can go |
| `credit_balance` | The ledger shows the tenant paid more than was charged; the credit is added to the refund |
| `duplicate_deduction` | The same item and amount entered more than once |
| `deduction_tenant_assumed` | A deduction names no tenant and the unit has several move-outs; it is put on the latest one for you to confirm |
| `dates_out_of_order` | Move-in after move-out, or returned before move-out; no interest is worked out on such dates |


## Files it reads

- **Move-outs** (`move_outs` schema): `rules.return_days` is required and has no default, because the deadline is set by your law or policy. Optional `interest_pct`, `deduct_unpaid_balance`, `require_evidence`, `due_soon_days`, `wear_words`. Each move-out: unit, date, deposit held, move-in, forwarding address, and `returned_on` / `returned_amount` once sent.
- **Deductions**: unit, item, category, amount, optional age and useful life in years, and a support reference. Local headers are read (Einheit, Position, Betrag, Belege; Unidad, Concepto, Importe; 項目, 金額 …).
- **Leases** and a **final ledger** are optional. From the ledger, charges count up to the move-out date and payments up to `as_of`, so a late payment lowers the balance while move-out charges posted to the ledger are not counted a second time next to the deductions file.

<!-- generated:start -->

## A demo run

`npx -y fairlease-security-deposits demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairlease Security Deposits demo (fictional apartment building) in <demo folder>

▶ Check three move-outs against a 30-day rule
  status: executed  decision: allow
  3 move-out(s): 1 past the deadline, 1 to review, 1 ready. Deposits 6250, deductions 2655 after proration, refunds 3530.8.
    204 Wren Adler   deposit    1850  deductions    1705  refund    80.8  overdue  useful_life_proration, possible_normal_wear, no_evidence, unpaid_balance, deadline_passed
    105 Elena Rossi  deposit    2150  deductions     350  refund    1800  review   possible_normal_wear, no_forwarding_address
    305 Yusuf Karim  deposit    2250  deductions     600  refund    1650  ready    deadline_soon

▶ Explain unit 204 (carpet prorated for age, a full repaint flagged, deadline passed)
  status: executed  decision: allow
  Wren Adler (unit 204), moved out 2026-09-30: deposit 1850, deductions 1705, unpaid 64.2, refund 80.8, deadline 2026-10-30. Prorated by useful life: Replace living room carpet (pet stains) 1200 → 480. May be normal wear and tear (many rules do not let a deposit cover it): Repaint entire unit (900). A person decides. No photo, invoice or receipt for: Repaint entire unit; Replace lost keys and fob. Unpaid balance at move-out: 64.2. The 30-day deadline was 2026-10-30, 16 days ago, and nothing is recorded as sent.

▶ Read German deduction lines (Einheit, Position, Betrag, Belege)
  status: executed  decision: allow
  3 move-out(s): 1 past the deadline, 1 to review, 1 ready. Deposits 6250, deductions 480 after proration, refunds 5705.8.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 3 move-out(s): 1 past the deadline, 1 to review, 1 ready. Deposits 6250, deductions 2655 after proration, refunds 3530.8.

▶ Draft the itemised statement for unit 305 (Auto is opted in for drafts here)
  status: executed  decision: allow  (auto)
  statement 305 drafted for 1650 with 0 open marker(s). Nothing was sent.

▶ Auto: approve sending the statement, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to pay the refund itself
  status: blocked  decision: block
  reason: Fairlease Security Deposits never pays a deposit refund; a person pays it after approving the statement.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `deposits_check` | For every move-out: deposit held, deductions (prorated by useful life where age is given), unpaid balance, refund or amount owed, and the deadline from your rules. | runs |
| `deposits_explain` | Show one move-out's deposit, each deduction with its notes, the refund and the deadline. | runs |
| `deposits_write_report` | Write the move-out deposit worklist as deposits.csv (one row per item, blank decision columns) and deposits.html into out_dir (default keystone-out/deposits). | runs |
| `deposits_draft_statement` | Write drafts/statement-<unit>.md: the itemised deposit statement for the former tenant (deductions with their support, deposit, refund or amount owed). | asks first (Auto can be opted in) |
| `deposits_request_send` | After one named human click (even in Auto), record that the reviewed statement draft is approved in statement-requests.csv. | one named click, even in Auto (`binding_send`) |
| `issue_refund` | Fairlease Security Deposits never pays a deposit refund; a person pays it after approving the statement. | refused |
| `post_tenant_charge` | Fairlease Security Deposits never posts deductions to the ledger. | refused |
| `send_to_collections` | Fairlease Security Deposits never sends a former tenant to collections. | refused |
| `email_send` | Fairlease Security Deposits never sends statements; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Move-out deductions (`deductions`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `unit` (required) | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `tenant` | text | Tenant, Tenant Name, Tenants, Resident, Resident Name, Name | Mieter, Locataire, 賃借人, 租户 |
| `lease_id` | text | Lease, Lease ID, Lease Code, Lease Number, Lease #, Tenant Code | Mietvertrag, Bail, 契約番号, 合同编号 |
| `item` (required) | text | Item, Charge, Description, Damage, Deduction, Position | Artikel, Article, 品目, 物料 |
| `category` | text | Category, Type, Charge Type, Reason | Kategorie, Catégorie, 経費科目, 费用类别 |
| `amount` | amount | Amount, Cost, Charge Amount, Deduction Amount | Betrag, Montant, 金額, 金额 |
| `age_years` | number | Age, Age (years), Item Age, Years in Service, Installed Years | - |
| `useful_life_years` | number | Useful Life, Useful Life (years), Life, Expected Life | - |
| `evidence` | text | Photo, Photos, Evidence, Invoice, Receipt, Attachment | - |

### Final tenant ledger (`ledger`)

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

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx fairlease-security-deposits inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairlease-security-deposits demo
npx -y fairlease-security-deposits mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairlease-security-deposits": {
      "command": "npx",
      "args": [
        "-y",
        "fairlease-security-deposits",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairlease-security-deposits -- npx -y fairlease-security-deposits mcp --root .`, or install the `fairlease-security-deposits` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairlease-security-deposits approve <id> --as "Your Name"` (or on the local approvals page, `fairlease-security-deposits approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairlease-security-deposits kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairlease-security-deposits tools                 # every tool, its policy and arguments
fairlease-security-deposits sources               # the columns each input is read from
fairlease-security-deposits inspect <file>        # how a file would be read (names and shapes, never values)
fairlease-security-deposits call deposits_check '{"move_outs":"<move_outs>","deductions":"<deductions>"}'
fairlease-security-deposits eval                  # the private eval cases on the fictional fixtures
fairlease-security-deposits demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Deadlines, interest and wear-and-tear rules differ by place. Fairlease Security Deposits applies the rules file you write; it does not know the law.
- Not legal advice. A person decides every deduction and pays the refund.
