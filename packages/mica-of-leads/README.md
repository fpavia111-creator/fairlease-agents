# Mica of Leads (`mica-of-leads`)

For leasing managers. It reads guest cards and lead exports and shows where prospects are slipping: leads with no response or a late first response, follow-ups that are due, approved applicants with no signed lease, stale open leads, duplicates, and lost leads with no reason. It also builds a table by source (each person counted once): response on time, tours, applications, leases, lead-to-lease rate, and cost per lease when you give it your spend. It drafts follow-ups for a person to send. It never screens, approves or denies an applicant and never contacts anyone.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y mica-of-leads demo
npx -y mica-of-leads mcp --root ./leasing
```

## What it checks

| Finding | Meaning |
|---|---|
| `no_response`, `slow_response` | No first response after `respond_within_days` (default 1), or a first response later than that |
| `follow_up_due` | Open lead with no step for `follow_up_days` (default 3) |
| `approved_not_leased` | Approved more than `approved_days` (default 7) ago with no lease signed |
| `stale_open` | Open longer than `stale_days` (default 30) |
| `duplicate` | Same email, phone or name as an earlier lead within `duplicate_days` (default 30); set aside in the source table |
| `lost_reason_missing`, `dates_out_of_order` | Closed as lost with no reason; a tour, application or lease dated before the lead came in |

The report adds a **By source** table and the **Lost reasons** tally. Sources with spend and no leads are listed too. Dates are whole days, because most exports carry dates without times.


<!-- generated:start -->

## A demo run

`npx -y mica-of-leads demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Mica of Leads demo (fictional prospects) in <demo folder>

▶ Check six weeks of guest cards against response and follow-up targets
  status: executed  decision: allow
  18 lead(s) (1 duplicate(s) set aside): 12 toured, 7 applied, 4 leased (22.22%). 77.78% answered within 1 day(s). To act on: 2 with no response, 1 approved with no lease, 4 follow-up(s) due. 1 stale open lead(s). Rent.com: spend with no leads.
    GC-1014  new       action  no_response
    GC-1017  new       action  no_response
    GC-1009  approved  action  approved_not_leased
    GC-1010  toured    action  slow_response, follow_up_due
    GC-1011  toured    action  follow_up_due
    GC-1019  toured    action  dates_out_of_order, follow_up_due
    GC-1012  applied   action  follow_up_due
    GC-1003  lost      review  slow_response, lost_reason_missing
    GC-1007  contacted review  stale_open
    GC-1015  contacted review  duplicate
    Apartments.com   6 leads, 0 leased
    Zillow           6 leads, 2 leased, 300 per lease
    Website          4 leads, 1 leased, 150 per lease
    Referral         1 leads, 1 leased
    Walk-in          1 leads, 0 leased
    Rent.com         0 leads, 0 leased (spend with no leads)

▶ Explain GC-1009 (approved, no lease)
  status: executed  decision: allow
  GC-1009 Ivy Grant (fictional) (Zillow, came in 2026-10-20): approved, action. Last step 2026-10-28. Approved 2026-10-28, 18 days ago, and no lease signed.

▶ Read a Spanish lead export (Interesado, Origen, Fecha de contacto)
  status: executed  decision: allow
  4 lead(s): 2 toured, 1 applied, 1 leased (25%). 50% answered within 1 day(s). To act on: 1 with no response, 0 approved with no lease, 1 follow-up(s) due. 0 stale open lead(s).

▶ Write the worklist with the source table
  status: executed  decision: allow
  Worklist written (en): 18 lead(s) (1 duplicate(s) set aside): 12 toured, 7 applied, 4 leased (22.22%). 77.78% answered within 1 day(s). To act on: 2 with no response, 1 approved with no lease, 4 follow-up(s) due. 1 stale open lead(s). Rent.com: spend with no leads.

▶ Draft a follow-up to Ivy Grant (approved, no lease yet)
  status: executed  decision: allow  (auto)
  followup GC-1009 drafted with 2 open marker(s) ([TO CONFIRM: how and when to sign], [TO CONFIRM: opt-out line if this goes by text]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to decide an application itself
  status: blocked  decision: block
  reason: Mica never approves or denies an applicant; that is a person's decision under your screening criteria.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `mica_check` | Every lead against your targets: no response or a late first response, follow-ups due, approved applicants with no lease, stale open leads, duplicates (same email, phone or name), lost leads with no reason, and dates … | runs |
| `mica_explain` | Show one lead's source, stage, last step and each finding. | runs |
| `mica_write_report` | Write the leasing funnel worklist as mica-leads.csv (one row per item, blank decision columns) and mica-leads.html into out_dir (default keystone-out/mica). | runs |
| `mica_draft_followup` | Write drafts/followup-<lead>.md: a short follow-up to one prospect suited to their stage (new, toured, applied or approved). | asks first (Auto can be opted in) |
| `mica_request_send` | After one named human click (even in Auto), record that the reviewed followup draft is approved in followup-requests.csv. | one named click, even in Auto (`binding_send`) |
| `mica_recall` | Search this agent's own memory of the customer's setup: accepted facts (in use) and facts waiting for a person. | runs |
| `mica_learn` | Propose one fact about the customer's setup for this agent to remember. | runs |
| `mica_accept_learning` | A named person accepts or rejects a fact waiting in this agent's memory. | one named click, even in Auto (`accept_learning`) |
| `mica_retire_memory` | A named person stops an accepted fact from applying. | one named click, even in Auto (`accept_learning`) |
| `decide_application` | Mica never approves or denies an applicant; that is a person's decision under your screening criteria. | refused |
| `run_screening` | Mica never orders credit, criminal or eviction screening. | refused |
| `text_prospect` | Mica never texts or calls prospects. | refused |
| `email_send` | Mica never sends follow-ups; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Guest cards and leads (`leads`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `lead_id` (required) | text | Lead ID, Guest Card ID, Prospect ID, ID, Inquiry ID, Interessenten-ID | Kennung, Identifiant, 番号, 编号 |
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `name` | text | Name, Prospect, Prospect Name, Guest Card Name, Lead Name, Interessent | Name, Nom, 名前, 名称 |
| `email` | text | Email, Email Address, E-mail | E-Mail, E-mail, メールアドレス, 邮箱 |
| `phone` | text | Phone, Phone Number, Mobile, Cell | Telefon, Téléphone, 電話番号, 电话 |
| `source` | text | Source, Lead Source, Marketing Source, Channel, Referral Source | Quelle, Source, 反響元, 来源 |
| `unit_type` | text | Unit Type, Floorplan, Desired Bedrooms, Bedrooms, Beds, Bed / Bath Preference | Zimmer, Pièces, 間取り, 卧室 |
| `created` | date | Created, Created At, Inquiry Date, Lead Date, First Contact, Received | Datum, Date, 日付, 日期 |
| `first_response` | date | First Response, First Response At, Responded, Response Date, First Contacted, Erste Antwort | - |
| `toured` | date | Tour Date, Toured, Showing Date, Showing, Tour, Besichtigung | - |
| `applied` | date | Application Date, Applied, Application Submitted, Bewerbung, Candidature, Fecha de solicitud | - |
| `approved` | date | Approved, Approval Date, Application Approved, Zusage, Accepté le, Fecha de aprobación | - |
| `leased` | date | Lease Signed, Leased, Lease Date, Move-in, Converted, Vertrag unterschrieben | - |
| `status` | text | Status, Lead Status, Stage | Status, Statut, ステータス, 状态 |
| `lost_reason` | text | Lost Reason, Reason Lost, Cancel Reason, Denied Reason, Inactive Reason, Verlustgrund | Grund, Motif, 理由, 原因 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| AppFolio | Reports > Guest Card Inquiries (CSV or Excel) | Guest Card ID, Source, Received | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx mica-of-leads inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Memory

mica-of-leads can remember facts about your setup so the next run does not have to be told again. `mica_learn` only proposes a fact; it changes nothing until a named person accepts it with `mica_accept_learning`, which is one click even in Auto. Facts live in one hash-chained file per agent under `.keystone/memory/`; if the chain does not verify, no fact is used. Credentials, personal identifiers and text that reads like instructions to an AI are refused. Run without memory with `--no-memory`.

| Kind | What an accepted fact changes |
|---|---|
| `source_alias` | counts leads from that source name under the given source in the funnel and cost table; never changes a lead, a date or a target |
| `note` | nothing (shown by recall only) |

```bash
mica-of-leads memory list
mica-of-leads memory accept MEM-1a2b3c4d5e6f --as "Your Name"
mica-of-leads memory retire MEM-1a2b3c4d5e6f --as "Your Name" --reason "code retired"
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y mica-of-leads demo
npx -y mica-of-leads mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "mica-of-leads": {
      "command": "npx",
      "args": [
        "-y",
        "mica-of-leads",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add mica-of-leads -- npx -y mica-of-leads mcp --root .`, or install the `mica-of-leads` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `mica-of-leads approve <id> --as "Your Name"` (or on the local approvals page, `mica-of-leads approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`mica-of-leads kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
mica-of-leads tools                 # every tool, its policy and arguments
mica-of-leads sources               # the columns each input is read from
mica-of-leads inspect <file>        # how a file would be read (names and shapes, never values)
mica-of-leads call mica_check '{"leads":"<leads>"}'
mica-of-leads eval                  # the private eval cases on the fictional fixtures
mica-of-leads demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Mica sees only what was logged in the export. Calls, texts and emails that nobody logged look like no response.
- It never sees or judges anything about who a prospect is. Screening decisions follow your written criteria and are made by people.
