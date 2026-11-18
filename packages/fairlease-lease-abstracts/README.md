# Fairlease Lease Abstracts (`fairlease-lease-abstracts`)

Turns commercial lease text into a lease abstract in the Fairlease `leases` format, with a **page, section and line citation for every term** it reads, and checks abstracts you already have against the lease text. It lists what it could not find and what the text says twice (often an amendment), and it reports lines in the document that are written at an AI instead of following them.

MIT · Node 20 or newer · local files only · no credentials · built on [`fairlease-core`](../fairlease-core)

```bash
npx -y fairlease-lease-abstracts demo
npx -y fairlease-lease-abstracts mcp --root ./leases
```

## What it reads

Parties, signing date, premises and area, commencement and expiration dates, permitted use, monthly or annual base rent, fixed-percent escalation (CPI is flagged for a person), rent abatement, security deposit, pro rata share, admin fee, gross-up, cap on controllable expenses (percent, type, base year), percentage rent (rate, natural breakpoint, reporting days), renewal option (term, notice, rent basis), liability insurance limits and additional insured, and the notice address.

Every value comes with where it was found. Nothing is inferred: a term the patterns do not find stays `[TO CONFIRM]`.

Lease text wraps, so a term that runs over a line break is still found and cited at the line it starts on. Dates are read as "May 1, 2024", "April 1st, 2025", "15 March 2025", `5/1/2024` or `2024-05-01`. Amounts written out with the figure in brackets ("Six Thousand Three Hundred Dollars ($6,300.00) per month") are read from the figure. The premises are taken from the Premises clause before any other suite number in the text, such as the landlord's own address. Free rent runs from the start date to the day before the same day N months on.


## Files it reads

`.txt`, `.md` and `.docx`. Page markers such as `--- Page 5 ---` (or form feeds from `pdftotext`) give page numbers. PDF is not read directly: convert it to text first. Files over 5 MB are refused.

<!-- generated:start -->

## A demo run

`npx -y fairlease-lease-abstracts demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairlease Lease Abstracts demo (fictional leases) in <demo folder>

▶ Abstract a Word lease with a citation for every term
  status: executed  decision: allow
  27 term(s) found with citations, 0 open item(s).
    landlord               "Harbor Point Owner LLC"     p. 1, line 4
    tenant                 "Acme Bagels LLC"            p. 1, line 4
    signed                 "2023-01-15"                 p. 1, line 4
    unit                   "Suite 100"                  Sec. 1.1, p. 1, line 8
    sqft                   2000                         Sec. 1.1, p. 1, line 8
    start                  "2023-03-01"                 Sec. 1.2, p. 1, line 10
    end                    "2028-02-29"                 Sec. 1.2, p. 1, line 10
    use                    "Bagel bakery and cafe"      Sec. 1.3, p. 1, line 12
    rent_monthly           4000                         Sec. 4.1, p. 5, line 18
    escalation_pct         3                            Sec. 4.2, p. 5, line 20
    deposit                8000                         Sec. 4.3, p. 5, line 22
    share_pct              5                            Sec. 6.3, p. 9, line 34

▶ Abstract a short lease with an amendment, a gap and planted text aimed at an AI
  status: executed  decision: allow
  12 term(s) found with citations, 1 open item(s), 1 line(s) of text aimed at an AI (ignored).

▶ Check the leases file against the lease text
  status: executed  decision: allow
  3 difference(s) between the abstract and the text: end (2028-02-28 vs 2028-02-29, Sec. 1.2, p. 1, line 10); deposit (8500 vs 8000, Sec. 4.3, p. 5, line 22); escalation (fixed_pct 2.5 vs fixed_pct 3, Sec. 4.2, p. 5, line 20).

▶ Write the abstract (Markdown, JSON entry, citations CSV)
  status: executed  decision: allow
  27 term(s) found with citations, 0 open item(s). Abstract written. The JSON entry passes the leases schema.

▶ Agent tries to enter the lease into the system itself
  status: blocked  decision: block
  reason: Fairlease Lease Abstracts never writes lease terms into the property management system.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `abstracts_abstract` | Read lease text and return a leases-schema entry with a citation (page, section, line, quote) for every term: parties, premises, area, dates, use, rent, escalation, abatement, deposit, CAM share, admin fee, cap, perce… | runs |
| `abstracts_compare` | Compare one lease in your leases file with what the lease text says: tenant, unit, dates, area, first rent, escalation, deposit, CAM share, admin fee and cap. | runs |
| `abstracts_write_abstract` | Write abstract-<id>.md (terms, citations, open items) and abstract-<id>.json (a draft entry for the leases file, with [TO CONFIRM] where a term is missing) into out_dir (default keystone-out/abstracts). | runs |
| `pm_system_update` | Fairlease Lease Abstracts never writes lease terms into the property management system; a person enters the reviewed abstract. | refused |
| `esign_send` | Fairlease Lease Abstracts never sends a lease, amendment or estoppel for signature. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairlease-lease-abstracts demo
npx -y fairlease-lease-abstracts mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairlease-lease-abstracts": {
      "command": "npx",
      "args": [
        "-y",
        "fairlease-lease-abstracts",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairlease-lease-abstracts -- npx -y fairlease-lease-abstracts mcp --root .`, or install the `fairlease-lease-abstracts` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairlease-lease-abstracts approve <id> --as "Your Name"` (or on the local approvals page, `fairlease-lease-abstracts approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairlease-lease-abstracts kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairlease-lease-abstracts tools                 # every tool, its policy and arguments
fairlease-lease-abstracts sources               # the columns each input is read from
fairlease-lease-abstracts inspect <file>        # how a file would be read (names and shapes, never values)
fairlease-lease-abstracts call abstracts_abstract '{"text":"<text>"}'
fairlease-lease-abstracts eval                  # the private eval cases on the fictional fixtures
fairlease-lease-abstracts demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- It reads common patterns in English lease language. Leases are drafted many ways; a term written differently is not found and becomes an open item. It does not look for exclusives, co-tenancy, radius, relocation, assignment, guaranty or default terms.
- It is not a legal reading of the lease. A person reads the lease before relying on the abstract.
- Scanned leases need OCR first; Fairlease Lease Abstracts does not do OCR.
