# Gypsum of Capex (`gypsum-of-capex`)

Tracks capital projects against their approved budget, open commitments, schedule and the reserve that pays for them. It flags projects over budget or heading over once open commitments are counted, spending ahead of the schedule, past their finish date, approved but never started, or closed with commitments still open, and shows whether each reserve covers what is left to spend. It drafts budget change requests to the owner. It never approves a change order, pays an invoice or posts to your books.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y gypsum-of-capex demo
npx -y gypsum-of-capex mcp --root ./capex
```

## What it checks

| Finding | Meaning |
|---|---|
| `over_budget` | Spent more than the budget by over `tolerance_pct` (default 5) |
| `forecast_over` | Spent plus open commitments over the budget by over `tolerance_pct` |
| `spending_ahead` (watch) | Share of budget spent runs `ahead_pct` (default 25) points ahead of the share of the schedule gone |
| `past_finish` | Planned finish passed and the status is not complete |
| `not_started` | Planned start more than `stalled_days` (default 60) ago, nothing spent or committed |
| `open_commitments_after_completion` | Marked complete with commitments still open |
| `no_budget` | No approved budget |
| `below_capitalization_threshold` (note) | Below your `capitalize_min`; the accountant decides |

With `reserves` (balance per funding source) in the policy, each reserve is compared with the remaining budgets of open projects it funds. Several rows per project (for example a job cost export by cost code) are added up. Status words are read in nine languages (Complete, Abgeschlossen, Terminé, 完了…).


<!-- generated:start -->

## A demo run

`npx -y gypsum-of-capex demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Gypsum of Capex demo (fictional projects) in <demo folder>

▶ Check eight capital projects against budget, schedule and reserves
  status: executed  decision: allow
  8 project(s) as of 2026-11-15: budget 658500, spent 324800, committed 75000. 5 need attention (1 over budget, 1 heading over, 1 past their finish date). Reserve short: Replacement reserve by 154000.
    P-01  Roof replacement             issue  forecast_over, past_finish
    P-02  Parking lot resurfacing      issue  over_budget
    P-04  Lobby refresh                issue  open_commitments_after_completion
    P-05  LED lighting retrofit        issue  no_budget
    P-07  Elevator modernization       issue  not_started
    P-08  Fire alarm panel upgrade     watch  spending_ahead
    P-03  HVAC RTU-3 replacement       ok     
    P-06  Pylon sign repair            ok     below_capitalization_threshold
    reserve Replacement reserve: Remaining budgets 304000 exceed the Replacement reserve balance 150000 by 154000.
    reserve Operating: Balance 40000 covers remaining budgets 0. 1 open project(s) with no budget are not counted.

▶ Explain the roof replacement
  status: executed  decision: allow
  P-01 Roof replacement (In progress, Replacement reserve): budget 180000, spent 175000, committed 20000, spent plus committed 195000, finish 2026-10-31. Spent 175000 plus open commitments 20000 is 195000, 15000 (8.33%) over the 180000 budget. Planned finish 2026-10-31 passed 15 days ago and the status is "In progress".

▶ Read a Japanese project list (工事名, 予算, 発注残, 実績)
  status: executed  decision: allow
  3 project(s) as of 2026-11-15: budget 8300000, spent 7950000, committed 300000. 2 need attention (1 over budget, 1 heading over, 1 past their finish date).

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 8 project(s) as of 2026-11-15: budget 658500, spent 324800, committed 75000. 5 need attention (1 over budget, 1 heading over, 1 past their finish date). Reserve short: Replacement reserve by 154000.

▶ Draft a budget change request for the roof
  status: executed  decision: allow  (auto)
  request P-01 drafted with 1 open marker(s) ([TO CONFIRM: owner or asset manager]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to approve the change order itself
  status: blocked  decision: block
  reason: Gypsum never approves a change order or raises a budget; the owner decides.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `gypsum_check` | Every project against its budget: over budget, heading over (spent plus open commitments), spending ahead of the schedule, past its finish date, not started, completed with open commitments, no budget. | runs |
| `gypsum_explain` | Show one project's budget, spend, commitments, dates and findings. | runs |
| `gypsum_write_report` | Write the capital projects worklist as gypsum-capex.csv (one row per item, blank decision columns) and gypsum-capex.html into out_dir (default keystone-out/gypsum). | runs |
| `gypsum_draft_request` | Write drafts/request-<project>.md: a budget change request to the owner for a project over budget, heading over or with no budget, with the figures from the file. | asks first (Auto can be opted in) |
| `gypsum_request_send` | After one named human click (even in Auto), record that the reviewed request draft is approved in request-requests.csv. | one named click, even in Auto (`binding_send`) |
| `approve_change_order` | Gypsum never approves a change order or raises a budget; the owner decides. | refused |
| `approve_invoice` | Gypsum never approves or pays a contractor invoice. | refused |
| `gl_post` | Gypsum never posts journal entries or capitalizes costs in your books. | refused |
| `email_send` | Gypsum never sends requests; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Capital projects (`projects`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `project` (required) | text | Project, Project Name, Job, Job Name, Capital Project, Projekt | - |
| `project_id` | text | Project ID, Project Code, Job Code, Job #, Projektnummer, N° de projet | Kennung, Identifiant, 番号, 编号 |
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `category` | text | Category, Type, Component, Gewerk, 区分, 工種 | Kategorie, Catégorie, 経費科目, 费用类别 |
| `budget` | amount | Budget, Approved Budget, Budget Amount, Revised Budget | Budget, Budget, 予算, 预算 |
| `committed` | amount | Committed, Commitments, Contracted, PO Amount, Open Commitments, Beauftragt | - |
| `spent` | amount | Spent, Actual, Actual to Date, Paid to Date, Invoiced, Cost to Date | Ist, Réel, 実績, 实际 |
| `status` | text | Status, Project Status, Phase | Status, Statut, ステータス, 状态 |
| `start` | date | Start, Start Date, Planned Start | Eintrittsdatum, Date d'entrée, 入社日, 入职日期 |
| `finish` | date | Finish, End, End Date, Completion, Planned Finish, Target Completion | Austrittsdatum, Date de sortie, 退職日, 离职日期 |
| `funding` | text | Funding, Funding Source, Reserve, Paid From, Finanzierung, Rücklage | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx gypsum-of-capex inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y gypsum-of-capex demo
npx -y gypsum-of-capex mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "gypsum-of-capex": {
      "command": "npx",
      "args": [
        "-y",
        "gypsum-of-capex",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add gypsum-of-capex -- npx -y gypsum-of-capex mcp --root .`, or install the `gypsum-of-capex` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `gypsum-of-capex approve <id> --as "Your Name"` (or on the local approvals page, `gypsum-of-capex approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`gypsum-of-capex kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
gypsum-of-capex tools                 # every tool, its policy and arguments
gypsum-of-capex sources               # the columns each input is read from
gypsum-of-capex inspect <file>        # how a file would be read (names and shapes, never values)
gypsum-of-capex call gypsum_check '{"projects":"<projects>"}'
gypsum-of-capex eval                  # the private eval cases on the fictional fixtures
gypsum-of-capex demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Gypsum adds up the figures in your files. It does not read contracts, bids or invoices.
- Whether a cost is capitalized or expensed is your accountant's decision. Not accounting, tax or legal advice.
