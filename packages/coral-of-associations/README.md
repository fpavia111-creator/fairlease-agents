# Coral of Associations (`coral-of-associations`)

For community association managers (HOAs, condominiums, owners' communities). It checks every owner account against **your** assessment and collection policy, and every violation case against **your** notice, cure and hearing steps. It drafts statement-of-account reminders and violation notices. It never posts a fine or charge, records a lien or sends anything.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y coral-of-associations demo
npx -y coral-of-associations mcp --root ./association
```

## What it checks

Owner accounts (from the owner ledger):

| Finding | Meaning |
|---|---|
| `missing_assessment`, `wrong_amount` | A period with no assessment, or one that differs from the policy (per-unit amounts supported) |
| `late_fee_missing`, `late_fee_not_due`, `late_fee_amount` | Paid after the grace period with no late fee; a late fee when the assessment was on time; a fee that differs from the policy |
| `balance_differs` | The ledger's own balance column does not equal its charges less payments |
| `past_due` | Amount past the grace period, days since the oldest unpaid charge, and the step your `collection_steps` name at that age (and the next one) |
| `credit_balance` (note) | Paid ahead or overpaid |

Payments are applied oldest charge first. Assessment and late fee lines are recognised by words in many languages (Assessment, HOA dues, Hausgeld, cuota de comunidad, spese condominiali, 管理費, 物业费, 관리비 …); set `assessment.words` or `late_fee.words` to use your own.

Violations (from the violations log): `first_notice_late`, `second_notice_due` (cure period over with no follow-up), `fine_without_hearing` (when your policy holds a hearing before a fine), `stale`, `repeat` (same rule at the same unit within `repeat_days`), `dates_out_of_order`.


A special assessment (`Special Assessment`, `Sonderumlage`, `derrama`, `cuota extraordinaria`) is added to the balance but never compared with the regular amount. An account whose first ledger line is later than `periods_from` is checked from that month (`account_starts_late`, a note). Units are matched across spellings ("Unit 12" is unit 12), for per-unit amounts and for repeat violations.

<!-- generated:start -->

## A demo run

`npx -y coral-of-associations demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Coral of Associations demo (fictional association) in <demo folder>

▶ Check Cedar Ridge owner accounts and violations against the association policy
  status: executed  decision: allow
  Cedar Ridge Owners Association (fictional): 8 owner account(s): 1 delinquent (550 past due), 5 with assessment or late fee issues, 1 in credit. 7 violation(s): 5 need a step, 1 open, 1 closed.
    A-102  102  delinquent past_due
    V-203  105  action     stale
    V-201  102  action     fine_without_hearing
    V-202  104  action     second_notice_due
    V-204  105  action     second_notice_due, repeat
    V-205  106  action     first_notice_late
    A-108  108  issue      balance_differs
    A-103  103  issue      wrong_amount
    A-104  104  issue      missing_assessment
    A-105  105  issue      late_fee_missing
    A-106  106  issue      late_fee_not_due
    V-207  107  open       
    A-107  107  credit     credit_balance
    A-101  101  ok         
    V-206  101  closed     

▶ Explain account A-102 (three months unpaid)
  status: executed  decision: allow
  A-102 Ben Ortiz (fictional) (unit 102): delinquent. Balance 800, past due 550 since 2026-09-01. 2026-07 250/250 paid 2026-07-03; 2026-08 250/250 paid 2026-08-04; 2026-09 250/250 unpaid; 2026-10 250/250 unpaid; 2026-11 250/250 unpaid. 550 past due; oldest unpaid charge 2026-09-01 (75 days). Your policy's step at 60 days: send a second reminder and offer a payment plan. Next at 90 days: refer the account to the board for a collection decision. A person decides.

▶ Read a Spanish community ledger (Propietario, Vivienda, Concepto, Cargo, Abono)
  status: executed  decision: allow
  Comunidad de Propietarios Calle Olivo 12 (ficticia): 2 owner account(s): 1 delinquent (240 past due), 0 with assessment or late fee issues, 0 in credit.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): Cedar Ridge Owners Association (fictional): 8 owner account(s): 1 delinquent (550 past due), 5 with assessment or late fee issues, 1 in credit. 7 violation(s): 5 need a step, 1 open, 1 closed.

▶ Draft a statement-of-account reminder to Ben Ortiz
  status: executed  decision: allow  (auto)
  notice A-102 drafted with 1 open marker(s) ([TO CONFIRM: owner email or mailing address]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to post a fine itself
  status: blocked  decision: block
  reason: Coral never posts a fine or fee to an owner account.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `coral_check` | Owner accounts against your assessment policy: missing or wrong assessments, late fees missed, not due or of the wrong amount, ledger balance that does not add up, amount and days past due with the step your collectio… | runs |
| `coral_explain` | Show one owner account period by period, or one violation step by step, with each finding. | runs |
| `coral_write_report` | Write the association worklist as coral-association.csv (one row per item, blank decision columns) and coral-association.html into out_dir (default keystone-out/coral). | runs |
| `coral_draft_notice` | Write drafts/notice-<id>.md: a statement-of-account reminder for a past-due owner account, or a violation notice for an open case. | asks first (Auto can be opted in) |
| `coral_request_send` | After one named human click (even in Auto), record that the reviewed notice draft is approved in notice-requests.csv. | one named click, even in Auto (`binding_send`) |
| `record_lien` | Coral never records a lien or starts collection; the board decides and a person acts. | refused |
| `post_fine` | Coral never posts a fine or fee to an owner account. | refused |
| `post_owner_charge` | Coral never posts or reverses charges on an owner ledger. | refused |
| `email_send` | Coral never sends notices; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Owner ledger (`ledger`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `account` | text | Account, Owner Account, Account #, Homeowner ID, Owner ID | Kennung, Identifiant, 番号, 编号 |
| `owner` (required) | text | Owner, Homeowner, Owner Name, Member, Name | Verantwortlich, Responsable, 担当者, 负责人 |
| `unit` | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `date` | date | Date, Charge Date, Post Date, Due Date | Datum, Date, 日付, 日期 |
| `type` | text | Type, Charge Type, Assessment Type, Description, Code | Buchungsart, Code de charge, 費目, 费用项目 |
| `charge` | amount | Charge, Charges, Assessment, Amount Due, Billed, Cargo | - |
| `payment` | amount | Payment, Payments, Paid, Received, Haben, Crédit | Zahlung, Paiement, 入金, 收款 |
| `balance` | amount | Balance, Balance Due, Account Balance | Saldo, Solde, 残高, 余额 |

### Violations log (`violations`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `violation_id` (required) | text | Violation ID, Violation #, Case, Case Number, ID | Kennung, Identifiant, 番号, 编号 |
| `unit` | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `owner` | text | Owner, Homeowner, Owner Name, Name | Verantwortlich, Responsable, 担当者, 负责人 |
| `type` | text | Type, Violation Type, Category, Rule, Issue | Kategorie, Catégorie, 経費科目, 费用类别 |
| `opened` | date | Opened, Date Opened, Observed, Violation Date, Created | Datum, Date, 日付, 日期 |
| `notice_1` | date | First Notice, Notice 1, Courtesy Notice, 1st Notice | - |
| `notice_2` | date | Second Notice, Notice 2, 2nd Notice | - |
| `hearing` | date | Hearing, Hearing Date, Board Hearing | - |
| `closed` | date | Closed, Date Closed, Cured, Resolved | Erledigt am, Date de clôture, 完了日, 完成日期 |
| `status` | text | Status, Violation Status | Status, Statut, ステータス, 状态 |
| `fine` | amount | Fine, Fine Amount, Fines | Betrag, Montant, 金額, 金额 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx coral-of-associations inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y coral-of-associations demo
npx -y coral-of-associations mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "coral-of-associations": {
      "command": "npx",
      "args": [
        "-y",
        "coral-of-associations",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add coral-of-associations -- npx -y coral-of-associations mcp --root .`, or install the `coral-of-associations` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `coral-of-associations approve <id> --as "Your Name"` (or on the local approvals page, `coral-of-associations approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`coral-of-associations kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
coral-of-associations tools                 # every tool, its policy and arguments
coral-of-associations sources               # the columns each input is read from
coral-of-associations inspect <file>        # how a file would be read (names and shapes, never values)
coral-of-associations call coral_check '{"policy":"<policy>"}'
coral-of-associations eval                  # the private eval cases on the fictional fixtures
coral-of-associations demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Coral repeats the steps your policy file names. It does not read governing documents or decide whether a fee, fine or collection step is allowed where you are.
- Not legal advice. Collection and enforcement decisions belong to the board and its advisers.
