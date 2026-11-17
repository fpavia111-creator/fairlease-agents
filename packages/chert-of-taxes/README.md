# Chert of Taxes (`chert-of-taxes`)

Tracks property tax by parcel and year: assessed value against the prior year, the appeal deadline **you entered** from the notice, and each installment billed and paid. It flags assessments up more than your review threshold (and says so when no deadline is on file), deadlines and installments coming up, and installments overdue, short or overpaid. It writes a calendar (.ics) of what is still owed and the deadlines you entered. It never works out a deadline, files an appeal or pays a bill.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y chert-of-taxes demo
npx -y chert-of-taxes mcp --root ./taxes
```

## What it checks

| Finding | Meaning |
|---|---|
| `assessment_jump` | Latest year's assessed value up more than `appeal_review_pct` (default 10) from the prior value or last year's row |
| `appeal_deadline_unknown` | A jump with no appeal deadline in the file or the policy; Chert never computes one |
| `appeal_deadline_soon` (due soon), `appeal_deadline_passed` (note) | Deadline you entered is within `due_soon_days` (default 30), or passed after a jump |
| `installment_overdue`, `installment_short` | Past the due date with nothing paid, or less than billed (beyond `tolerance`) |
| `installment_due_soon`, `installment_overpaid` | Due within `due_soon_days`; paid more than billed |

Deadlines in `policy.appeal_deadlines` (per parcel) win over the file. Several rows per parcel and year are read as installments.


<!-- generated:start -->

## A demo run

`npx -y chert-of-taxes demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Chert of Taxes demo (fictional parcels) in <demo folder>

▶ Check four parcels: assessments, appeal deadlines you entered, installments
  status: executed  decision: allow
  4 parcel-year(s) as of 2026-11-15: billed 274000, paid 169000. 2 assessment(s) up more than 10% (1 with no appeal deadline entered), 1 appeal deadline(s) within 30 days, 7000 past due on 2 parcel(s), 1 with an installment due within 30 days.
    08-115-020       18.18% issue     assessment_jump, appeal_deadline_unknown, installment_short
    14-22-301-001    21.57% issue     assessment_jump, appeal_deadline_soon, installment_due_soon
    14-22-301-002     1.27% issue     installment_overdue
    08-115-021       -3.85% ok        

▶ Explain the plaza parcel (assessment up 21.57%)
  status: executed  decision: allow
  14-22-301-001 (Harbor Point Plaza (fictional)), 2026: issue. Assessed 6200000 (+21.57% from 5100000); appeal deadline 2026-12-04; billed 196000, paid 98000. Assessed value 6200000 is up 21.57% from 5100000; review whether to appeal. Appeal deadline you entered: 2026-12-04 (19 days). Installment of 98000 due 2026-12-01 (16 days).

▶ Read a French taxe foncière file (Parcelle, Valeur locative cadastrale, Échéance)
  status: executed  decision: allow
  2 parcel-year(s) as of 2026-11-15: billed 8570, paid 6850. 1 assessment(s) up more than 10% (0 with no appeal deadline entered), 0 appeal deadline(s) within 30 days, 1720 past due on 1 parcel(s), 0 with an installment due within 30 days.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 4 parcel-year(s) as of 2026-11-15: billed 274000, paid 169000. 2 assessment(s) up more than 10% (1 with no appeal deadline entered), 1 appeal deadline(s) within 30 days, 7000 past due on 2 parcel(s), 1 with an installment due within 30 days.

▶ Write the calendar (.ics)
  status: executed  decision: allow
  2 date(s) from 2026-11-15: 1 appeal deadline(s) you entered, 1 installment(s) still owed.

▶ Agent tries to file the appeal itself
  status: blocked  decision: block
  reason: Chert never files an appeal or protest; a person or tax advisor does.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `chert_check` | Per parcel and year: assessed value up more than appeal_review_pct (with or without an appeal deadline entered), appeal deadlines you entered coming up, installments overdue, short, overpaid or due soon. | runs |
| `chert_explain` | Show one parcel's assessment, deadline, installments and findings. | runs |
| `chert_write_report` | Write the property tax worklist as chert-taxes.csv (one row per item, blank decision columns) and chert-taxes.html into out_dir (default keystone-out/chert). | runs |
| `chert_calendar` | Write chert-calendar.ics (installments still owed and appeal deadlines you entered, from as_of on) and chert-calendar.csv/.html into out_dir (default keystone-out/chert). | runs |
| `file_tax_appeal` | Chert never files an appeal or protest; a person or tax advisor does. | refused |
| `pay_tax` | Chert never pays a tax bill or schedules a payment. | refused |
| `gl_post` | Chert never posts accruals or payments to your books. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Property tax file (`taxes`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` (required) | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `parcel` | text | Parcel, Parcel ID, Parcel Number, APN, PIN, Folio | - |
| `tax_year` | number | Tax Year, Year, Assessment Year, Jahr, Steuerjahr, Année | - |
| `assessed_value` | amount | Assessed Value, Assessment, Total Assessed, Market Value, Appraised Value, Taxable Value | Einheitswert, Valeur locative cadastrale, 固定資産税評価額, 评估价值 |
| `prior_assessed_value` | amount | Prior Assessed Value, Prior Year Value, Previous Assessment, Prior Value, Vorjahreswert, Valeur précédente | - |
| `tax_amount` | amount | Tax, Tax Amount, Total Tax, Annual Tax, Tax Due, Installment Amount | Betrag, Montant, 金額, 金额 |
| `notice_date` | date | Notice Date, Notice Mailed, Mailing Date, Notice of Value Date | - |
| `appeal_deadline` | date | Appeal Deadline, Protest Deadline, Appeal By, Filing Deadline, Einspruchsfrist, Date limite de réclamation | - |
| `due_date` | date | Due Date, Installment Due, Payment Due, Fälligkeit, Échéance, Vencimiento | Fälligkeitsdatum, Date d'échéance, 期日, 截止日期 |
| `paid` | amount | Paid, Amount Paid, Paid Amount, Bezahlt, Payé, Pagado | Zahlung, Paiement, 入金, 收款 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx chert-of-taxes inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y chert-of-taxes demo
npx -y chert-of-taxes mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "chert-of-taxes": {
      "command": "npx",
      "args": [
        "-y",
        "chert-of-taxes",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add chert-of-taxes -- npx -y chert-of-taxes mcp --root .`, or install the `chert-of-taxes` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `chert-of-taxes approve <id> --as "Your Name"` (or on the local approvals page, `chert-of-taxes approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`chert-of-taxes kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
chert-of-taxes tools                 # every tool, its policy and arguments
chert-of-taxes sources               # the columns each input is read from
chert-of-taxes inspect <file>        # how a file would be read (names and shapes, never values)
chert-of-taxes call chert_check '{"taxes":"<taxes>"}'
chert-of-taxes eval                  # the private eval cases on the fictional fixtures
chert-of-taxes demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Chert uses only values and dates in your files; nothing is looked up. Every deadline comes from you.
- Whether to appeal is for you and your tax advisor. Not tax or legal advice.
