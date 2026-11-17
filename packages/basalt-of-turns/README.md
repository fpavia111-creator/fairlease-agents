# Basalt of Turns (`basalt-of-turns`)

Tracks every unit turn from move-out to make-ready to move-in: days to ready against your target, days vacant, cost by trade against your budget, the part chargeable to the former tenant and the rent lost while the unit sits. It never dispatches a vendor, approves an invoice or bills a former tenant.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y basalt-of-turns demo
npx -y basalt-of-turns mcp --root ./turns
```

## What it checks

| Finding | Meaning |
|---|---|
| `over_target`, `open_over_target` | Days from move-out to ready over `target_days` (default 7), finished or still open |
| `over_budget` | Turn cost over your budget for the unit's bedroom count (or `default_budget`) |
| `ready_not_leased` | Ready for more than `ready_to_lease_days` (default 14) with no move-in |
| `dates_out_of_order` | Ready or move-in dated before the move-out; those days are not counted |
| `cost_missing`, `vendor_missing` | Lines without a cost or a vendor |
| `chargeable_unknown`, `chargeable_partial`, `tenant_chargeable` | What to put on the deposit statement ([Jasper of Deposits](../jasper-of-deposits) checks that) |

Units are matched across spellings ("Apt 0202" is unit 202) and per property; a cost line with no dates joins the turn above it for the same unit. `Tenant` and `Resident` count as chargeable, `Owner` as not, and any other word as unknown.

Rent lost = market rent × 12 ÷ 365 × days from move-out to move-in (or to `as_of`).


<!-- generated:start -->

## A demo run

`npx -y basalt-of-turns demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Basalt of Turns demo (fictional apartment building) in <demo folder>

▶ Check five turns against a 7-day target and budgets by bedroom count
  status: executed  decision: allow
  5 turn(s) as of 2026-11-15: 1 in progress, 1 ready and not leased. Average 10.5 days to ready (target 7). Cost 8130, of which 2250 chargeable to former tenants; rent lost while vacant 10181.92. 4 turn(s) need attention.
    204 in_progress   46 days  cost    2350  budget   1800  open_over_target, over_budget, cost_missing, chargeable_unknown, tenant_chargeable
    305 leased         9 days  cost     600  budget   2400  over_target, vendor_missing, tenant_chargeable
    202 moved_in       8 days  cost    1000  budget   1200  over_target
    404 moved_in      19 days  cost    3830  budget   1800  over_target, over_budget, chargeable_partial
    105 ready          6 days  cost     350  budget   2400  tenant_chargeable

▶ Explain unit 204 (still open after 46 days)
  status: executed  decision: allow
  Unit 204: moved out 2026-09-30, in progress; 46 days to ready, cost 2350 (budget 1800), chargeable 1450, rent lost 2797.81. Still not ready after 46 days; your target is 7. Turn cost 2350 is over the 1800 budget for a 2-bedroom unit. No cost yet for: Appliances. Not marked whether the tenant is charged: Paint. 1450 marked chargeable to the former tenant; it belongs on the deposit statement.

▶ Read Italian turn lines (Unità, Data uscita, Costo)
  status: executed  decision: allow
  1 turn(s) as of 2026-11-15: 1 in progress, 0 ready and not leased. Average - days to ready (target 7). Cost 1450, of which 0 chargeable to former tenants; rent lost while vacant 0. 1 turn(s) need attention.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 5 turn(s) as of 2026-11-15: 1 in progress, 1 ready and not leased. Average 10.5 days to ready (target 7). Cost 8130, of which 2250 chargeable to former tenants; rent lost while vacant 10181.92. 4 turn(s) need attention.

▶ Agent tries to dispatch the flooring vendor itself
  status: blocked  decision: block
  reason: Basalt never dispatches or schedules a vendor.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `basalt_check` | For every turn: days from move-out to ready against your target, days vacant, cost by trade against your budget, the part chargeable to the former tenant and rent lost while vacant. | runs |
| `basalt_explain` | Show one turn's dates, trades, costs and findings. | runs |
| `basalt_write_report` | Write the unit turn worklist as basalt-turns.csv (one row per item, blank decision columns) and basalt-turns.html into out_dir (default keystone-out/basalt). | runs |
| `vendor_dispatch` | Basalt never dispatches or schedules a vendor. | refused |
| `approve_invoice` | Basalt never approves or pays a vendor invoice. | refused |
| `post_tenant_charge` | Basalt never bills a former tenant; chargeable items go on the deposit statement a person approves. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Unit turn lines (`turns`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `unit` (required) | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `move_out` | date | Move-out, Move Out, Vacated, Move-Out Date, Vacate Date | Auszug, Date de sortie, 退去日, 退租日期 |
| `ready` | date | Ready, Make Ready, Ready Date, Made Ready, Rent Ready, Completed | Erledigt am, Date de clôture, 完了日, 完成日期 |
| `move_in` | date | Move-in, Move In, Next Move-In, New Move-In, Move-In Date | Einzug, Date d’entrée, 入居日, 入住日期 |
| `category` | text | Category, Item, Trade, Type, Scope | Kategorie, Catégorie, 経費科目, 费用类别 |
| `vendor` | text | Vendor, Contractor, Assigned To | Lieferant, Fournisseur, 仕入先, 供应商 |
| `cost` | amount | Cost, Amount, Total, Invoice Amount, Turn Cost, Kosten | Betrag, Montant, 金額, 金额 |
| `chargeable` | text | Chargeable, Tenant Chargeable, Bill to Tenant, Damage | - |
| `rent` | amount | Rent, Market Rent, Monthly Rent | Miete, Loyer, 賃料, 租金 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx basalt-of-turns inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y basalt-of-turns demo
npx -y basalt-of-turns mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "basalt-of-turns": {
      "command": "npx",
      "args": [
        "-y",
        "basalt-of-turns",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add basalt-of-turns -- npx -y basalt-of-turns mcp --root .`, or install the `basalt-of-turns` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `basalt-of-turns approve <id> --as "Your Name"` (or on the local approvals page, `basalt-of-turns approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`basalt-of-turns kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
basalt-of-turns tools                 # every tool, its policy and arguments
basalt-of-turns sources               # the columns each input is read from
basalt-of-turns inspect <file>        # how a file would be read (names and shapes, never values)
basalt-of-turns call basalt_check '{"turns":"<turns>"}'
basalt-of-turns eval                  # the private eval cases on the fictional fixtures
basalt-of-turns demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- What a former tenant can be charged is decided by a person under the lease and local rules.
- Not legal or accounting advice.
