# Pearl of Filings (`pearl-of-filings`)

Gets year-end 1099s for vendors and owners ready. It totals each payee's payments for the tax year, leaves out the payment methods you exclude (card and payment apps by default), and compares each total with **the threshold you give it**. It flags what would stop a form going out: a missing or malformed tax ID, no mailing address, no W-9, several directory records on one tax ID, and payees who are not in the directory at all. It drafts W-9 requests. Tax IDs are always masked. It never files anything.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y pearl-of-filings demo
npx -y pearl-of-filings mcp --root ./year-end
```

## What it checks

| Finding | Meaning |
|---|---|
| `tin_missing`, `tin_invalid` | No tax ID, or one that fails the format check (not nine digits, or a placeholder like 000000000) |
| `address_missing`, `w9_missing` | No mailing address, or the directory says no W-9 is on file |
| `shared_tin` | Several directory records carry one tax ID; their payments are added together for the threshold |
| `payee_not_in_directory` | Paid, but nowhere in the vendor directory |
| `directory_says_no_1099` | The directory says no 1099, but the payee is over your threshold |
| `attorney`, `corporation` | Looks like a law firm or a corporation; confirm with your tax preparer |
| `excluded_methods` | Payments by an excluded method, shown and left out of the total |
| `possible_duplicate_payments` | The same date, amount and reference more than once in the payments file |
| `same_name_different_tin` | Two directory records share a name but not a tax ID; payments by name all went to the first |
| `rent_and_services` | Rent and other payments to one payee, with both amounts |
| `owner_rents_basis` | For an owner the total is what was paid out; a 1099 for rents usually reports rents collected, so take that figure from the owner statements and confirm it |

Status is `fix`, `confirm`, `ready`, `below_threshold` or `excluded_only`. The suggested form is 1099-MISC for rents paid to owners (owner trade or rent accounts) and 1099-NEC otherwise; it is a suggestion for your preparer, not a determination.


<!-- generated:start -->

## A demo run

`npx -y pearl-of-filings demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Pearl of Filings demo (fictional payees) in <demo folder>

▶ Total 2026 payments per payee against a 2000 threshold given by the tax preparer
  status: executed  decision: allow
  10 payee(s) paid in 2026. 8 at or above your 2000 threshold (40450): 1 ready, 5 to fix, 2 to confirm with your tax preparer. 1 below the threshold, 1 paid only by excluded methods. 1 payment(s) had no readable date and were skipped. 1 payment(s) outside 2026 ignored.
    Maple Court Holdings LLC     12000 1099-MISC  fix              address_missing
    FlowRight Plumbing LLC        4850 1099-NEC   fix              shared_tin
    Volt Electric                 3200 1099-NEC   fix              tin_missing, w9_missing, excluded_methods
    Sparkle Cleaning              2600 1099-NEC   fix              tin_invalid
    Joe's Handyman                2300 1099-NEC   fix              payee_not_in_directory
    Example Flooring Inc          9800 1099-NEC   confirm          directory_says_no_1099
    Smith & Lee Law PC            3500 1099-NEC   confirm          attorney
    Greenleaf Landscaping         2200 1099-NEC   ready            
    QuickFix Handyman             1450            below_threshold  
    Ace Supply Co                    0            excluded_only    excluded_methods

▶ Explain FlowRight (two directory records, one tax ID)
  status: executed  decision: allow
  FlowRight Plumbing LLC (V-101): fix. Paid 4850 in 3 payment(s); tax ID •••••6781; suggested form 1099-NEC. 2 directory records share tax ID •••••6781: FlowRight Plumbing LLC; FlowRight LLC. Their payments are added together for the threshold; confirm they are one payee and merge the records.

▶ Read a Spanish payment file and directory (Beneficiario, Importe, Forma de pago)
  status: executed  decision: allow
  3 payee(s) paid in 2026. 2 at or above your 2000 threshold (9250): 2 ready, 0 to fix, 0 to confirm with your tax preparer. 1 below the threshold.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 10 payee(s) paid in 2026. 8 at or above your 2000 threshold (40450): 1 ready, 5 to fix, 2 to confirm with your tax preparer. 1 below the threshold, 1 paid only by excluded methods. 1 payment(s) had no readable date and were skipped. 1 payment(s) outside 2026 ignored.

▶ Draft a W-9 request to Volt Electric (no tax ID on file)
  status: executed  decision: allow  (auto)
  request Volt Electric drafted with 0 open marker(s). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to file the 1099s itself
  status: blocked  decision: block
  reason: Pearl never files or e-files information returns; a person files them, usually through a tax preparer.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `pearl_check` | Totals each payee's payments for the tax year (records sharing a tax ID are added together), leaves out excluded payment methods, and compares each total with your threshold. | runs |
| `pearl_explain` | Show one payee's total, excluded payments, masked tax ID, suggested form and each finding. | runs |
| `pearl_write_report` | Write the 1099 readiness worklist as pearl-1099.csv (one row per item, blank decision columns) and pearl-1099.html into out_dir (default keystone-out/pearl). | runs |
| `pearl_draft_request` | Write drafts/request-<payee>.md: a W-9 request to one payee listing exactly what is missing (tax ID, address, W-9, name confirmation). | asks first (Auto can be opted in) |
| `pearl_request_send` | After one named human click (even in Auto), record that the reviewed request draft is approved in request-requests.csv. | one named click, even in Auto (`binding_send`) |
| `file_1099` | Pearl never files or e-files information returns; a person files them, usually through a tax preparer. | refused |
| `tin_match_submit` | Pearl never submits tax IDs to an outside matching service. | refused |
| `backup_withholding_start` | Pearl never starts or changes withholding on a payee. | refused |
| `email_send` | Pearl never sends requests; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Payments to vendors and owners (`payments`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `payee` (required) | text | Payee, Vendor, Paid To, Name, Owner, Payee Name | Lieferant, Fournisseur, 仕入先, 供应商 |
| `date` | date | Date, Payment Date, Check Date, Paid Date, Post Date, Zahlungsdatum | Datum, Date, 日付, 日期 |
| `amount` (required) | amount | Amount, Payment Amount, Paid, Check Amount, Total, Zahlbetrag | Betrag, Montant, 金額, 金额 |
| `method` | text | Method, Payment Method, Payment Type, Type | Zahlungsart, Mode de paiement, 支払方法, 付款方式 |
| `account` | text | GL Account, Account, Expense Account | Konto, Compte, 勘定科目, 科目代码 |
| `reference` | text | Reference, Check Number, Check #, Ref | Referenz, Référence, 参照番号, 参考号 |
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |

### Vendor and owner directory (`vendors`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `vendor` (required) | text | Vendor, Company Name, Vendor Name, Name, Payee, Company | Lieferant, Fournisseur, 仕入先, 供应商 |
| `vendor_id` | text | Vendor ID, Vendor Code, Code, Vendor # | Lieferantennummer, Code fournisseur, 仕入先コード, 供应商编号 |
| `trade` | text | Trade, Vendor Type, Category, Service, Services | Kategorie, Catégorie, 経費科目, 费用类别 |
| `tax_id` | text | Tax ID, TIN, EIN, SSN/EIN, Federal ID, Tax Payer ID | Steuernummer, Numéro de TVA, 法人番号, 统一社会信用代码 |
| `w9_on_file` | text | W-9 On File, W9 On File, W-9, W9, W-9 Received, W-9 recibido | - |
| `type_1099` | text | 1099 Type, 1099, Send 1099, 1099 Eligible, 1099 Box, 1099 reporting | - |
| `gl_expires` | date | Liability Ins. Expires, Liability Insurance Expires, GL Expiration, General Liability Expires, Insurance Expiration, COI Expires | - |
| `wc_expires` | date | Workers Comp Expires, Workers Comp Expiration, Workers' Comp Expires, WC Expiration, WC Expires, Unfallversicherung bis | - |
| `auto_expires` | date | Auto Insurance Expires, Auto Ins Expires, Auto Expiration | - |
| `license_expires` | date | License Expires, License Expiration, State License Expires, Licence Expires, State Lic. Expires, Lizenz gültig bis | Ablaufdatum, Date d'expiration, 有効期限, 到期日 |
| `license_number` | text | License Number, License #, State License, Licence Number | - |
| `email` | text | Email, Email Address, Primary Email | E-Mail, E-mail, メールアドレス, 邮箱 |
| `phone` | text | Phone, Phone Number, Primary Phone | Telefon, Téléphone, 電話番号, 电话 |
| `address` | text | Address, Mailing Address, Remit To Address, Remit Address, Street, Address 1 | Adresse, Adresse, 住所, 地址 |
| `entity_type` | text | Entity Type, Tax Classification, Federal Tax Classification, Business Type, Rechtsform, Forme juridique | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| AppFolio | Reports > Vendor Directory (CSV or Excel) | Company Name, Liability Ins. Expires or Workers Comp Expires or Send 1099? | no |
| Buildium | Vendors > Export (CSV) | Company name, Taxpayer ID or 1099 reporting or Insurance expiration | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx pearl-of-filings inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y pearl-of-filings demo
npx -y pearl-of-filings mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "pearl-of-filings": {
      "command": "npx",
      "args": [
        "-y",
        "pearl-of-filings",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add pearl-of-filings -- npx -y pearl-of-filings mcp --root .`, or install the `pearl-of-filings` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `pearl-of-filings approve <id> --as "Your Name"` (or on the local approvals page, `pearl-of-filings approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`pearl-of-filings kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
pearl-of-filings tools                 # every tool, its policy and arguments
pearl-of-filings sources               # the columns each input is read from
pearl-of-filings inspect <file>        # how a file would be read (names and shapes, never values)
pearl-of-filings call pearl_check '{"payments":"<payments>","tax_year":"<tax_year>","threshold":"<threshold>"}'
pearl-of-filings eval                  # the private eval cases on the fictional fixtures
pearl-of-filings demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Pearl totals your payment file and checks tax IDs for format only. It does not verify a tax ID with the IRS, decide whether a payee or payment is reportable, or file anything.
- Not tax or legal advice. Confirm forms, amounts and thresholds with your tax preparer.
