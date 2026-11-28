# Fairlease Vendor Compliance (`fairlease-vendor-compliance`)

Checks every vendor against **your** requirements before the next payment goes out: liability, workers' comp and auto insurance, license and tax ID, with extra requirements per trade and exemptions per vendor. With a payments file it shows money already paid to a vendor while something was expired or missing. It drafts requests for updated certificates. It never pays, holds a payment or changes a vendor record. Tax IDs are masked in every result.

MIT · Node 20 or newer · local files only · no credentials · built on [`fairlease-core`](../fairlease-core)

```bash
npx -y fairlease-vendor-compliance demo
npx -y fairlease-vendor-compliance mcp --root ./vendors
```

## What it checks

| Finding | Meaning |
|---|---|
| `gl_expired`, `wc_expired`, `auto_expired`, `license_expired` | Past the expiry date in the directory |
| `…_expiring` | Expires within `warn_days` (default 30) |
| `…_missing` | Required by your file, no date on record |
| `tax_id_missing`, `w9_missing` | Tax details your file requires |
| `paid_while_noncompliant` | Payments dated after something lapsed (or while it was missing); a payment on the last day of cover is fine, and a payment with its void nets out |
| `duplicate_vendor` | The vendor is in the directory more than once; its payments are counted on the first row only |

With a payments file the result also lists `unlisted_payees`: anyone who was paid but is not in the vendor directory at all, so nobody is tracking their insurance. A vendor with several trades ("Plumbing, HVAC") has to meet what each trade needs.

Requirements file: `default` applies to everyone (`gl`, `wc`, `auto`, `license`, `tax_id`, `w9`), `trades` adds by trade name (matched inside the vendor's trade text), `exempt` lists what a named vendor does not need (for example workers' comp for a sole proprietor with an exemption).


<!-- generated:start -->

## A demo run

`npx -y fairlease-vendor-compliance demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairlease Vendor Compliance demo (fictional vendors) in <demo folder>

▶ Check eight vendors from an AppFolio vendor directory against your requirements
  status: executed  decision: allow
  8 vendor(s) as of 2026-11-15: 4 out of compliance, 2 with something expiring within 30 days. Paid 4405 to vendors while out of compliance.
    ApplianceCare (fictional)        ••••••6783  issue     gl_expiring, wc_missing, paid_while_noncompliant
    BrightWall Painting (fictional)  ••••••6786  issue     wc_missing, paid_while_noncompliant
    QuickFix HVAC (fictional)        ••••••6782  issue     gl_expired, license_expiring, paid_while_noncompliant
    Volt Electric (fictional)                    issue     license_expired, tax_id_missing, paid_while_noncompliant
    FloorCo (fictional)              ••••••6788  ok        
    FlowRight Plumbing (fictional)   ••••••6781  ok        
    NoBugs Pest (fictional)          ••••••6785  ok        
    Sparkle Cleaners (fictional)     ••••••6787  ok        

▶ Explain QuickFix HVAC (paid after its liability insurance expired)
  status: executed  decision: allow
  QuickFix HVAC (fictional) (HVAC): issue. Liability insurance expired 2026-10-31 (15 days ago). Licence expires 2026-12-05 (20 days). Paid 480 while out of compliance: 2026-11-12 480 (ACH-886).

▶ Read a Portuguese vendor list (Fornecedor, CNPJ, Licença vence)
  status: executed  decision: allow
  1 vendor(s) as of 2026-11-15: 1 out of compliance, 0 with something expiring within 30 days.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 8 vendor(s) as of 2026-11-15: 4 out of compliance, 2 with something expiring within 30 days. Paid 4405 to vendors while out of compliance.

▶ Draft a certificate request to QuickFix HVAC
  status: executed  decision: allow  (auto)
  request QuickFix HVAC (fictional) drafted with 1 open marker(s) ([TO CONFIRM: certificate holder and additional insured wording from your requirements]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to put a payment on hold itself
  status: blocked  decision: block
  reason: Fairlease Vendor Compliance never approves, holds or releases a vendor payment.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `vendors_check` | Every vendor against your requirements: liability, workers' comp and auto insurance and licence (expired, expiring within warn_days, or missing), tax ID and tax form. | runs |
| `vendors_explain` | Show one vendor's expiry dates and findings. | runs |
| `vendors_write_report` | Write the vendor compliance worklist as vendors.csv (one row per item, blank decision columns) and vendors.html into out_dir (default keystone-out/vendors). | runs |
| `vendors_draft_request` | Write drafts/request-<vendor>.md: a request to the vendor for an updated certificate, licence or tax form, listing exactly what is expired or missing. | asks first (Auto can be opted in) |
| `vendors_request_send` | After one named human click (even in Auto), record that the reviewed request draft is approved in request-requests.csv. | one named click, even in Auto (`binding_send`) |
| `approve_invoice` | Fairlease Vendor Compliance never approves, holds or releases a vendor payment. | refused |
| `vendor_status_update` | Fairlease Vendor Compliance never activates, deactivates or edits vendors in your accounting or property management system. | refused |
| `email_send` | Fairlease Vendor Compliance never sends requests; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Vendor directory (`vendors`)

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

### Vendor payments (`payments`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `payee` (required) | text | Payee, Vendor, Paid To, Name, Owner, Payee Name | Lieferant, Fournisseur, 仕入先, 供应商 |
| `date` | date | Date, Payment Date, Check Date, Paid Date, Post Date, Zahlungsdatum | Datum, Date, 日付, 日期 |
| `amount` (required) | amount | Amount, Payment Amount, Paid, Check Amount, Total, Zahlbetrag | Betrag, Montant, 金額, 金额 |
| `method` | text | Method, Payment Method, Payment Type, Type | Zahlungsart, Mode de paiement, 支払方法, 付款方式 |
| `account` | text | GL Account, Account, Expense Account | Konto, Compte, 勘定科目, 科目代码 |
| `reference` | text | Reference, Check Number, Check #, Ref | Referenz, Référence, 参照番号, 参考号 |
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx fairlease-vendor-compliance inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairlease-vendor-compliance demo
npx -y fairlease-vendor-compliance mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairlease-vendor-compliance": {
      "command": "npx",
      "args": [
        "-y",
        "fairlease-vendor-compliance",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairlease-vendor-compliance -- npx -y fairlease-vendor-compliance mcp --root .`, or install the `fairlease-vendor-compliance` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairlease-vendor-compliance approve <id> --as "Your Name"` (or on the local approvals page, `fairlease-vendor-compliance approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairlease-vendor-compliance kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairlease-vendor-compliance tools                 # every tool, its policy and arguments
fairlease-vendor-compliance sources               # the columns each input is read from
fairlease-vendor-compliance inspect <file>        # how a file would be read (names and shapes, never values)
fairlease-vendor-compliance call vendors_check '{"vendors":"<vendors>","requirements":"<requirements>"}'
fairlease-vendor-compliance eval                  # the private eval cases on the fictional fixtures
fairlease-vendor-compliance demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Fairlease Vendor Compliance reads dates and fields from your files. It does not read certificates or confirm coverage with an insurer.
- Not legal or insurance advice.
