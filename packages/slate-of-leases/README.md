# Slate of Leases (`slate-of-leases`)

Turns commercial lease text into a lease abstract in the Keystone `leases` format, with a **page, section and line citation for every term** it reads, and checks abstracts you already have against the lease text. It lists what it could not find and what the text says twice (often an amendment), and it reports lines in the document that are written at an AI instead of following them.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y slate-of-leases demo
npx -y slate-of-leases mcp --root ./leases
```

## What it reads

Parties, signing date, premises and area, commencement and expiration dates, permitted use, monthly or annual base rent, fixed-percent escalation (CPI is flagged for a person), rent abatement, security deposit, pro rata share, admin fee, gross-up, cap on controllable expenses (percent, type, base year), percentage rent (rate, natural breakpoint, reporting days), renewal option (term, notice, rent basis), liability insurance limits and additional insured, and the notice address.

Every value comes with where it was found. Nothing is inferred: a term the patterns do not find stays `[TO CONFIRM]`.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `slate_abstract` | read: abstract, citations, open items, AI-directed lines | allow |
| `slate_compare` | read: one lease in your leases file against the text | allow |
| `slate_write_abstract` | report: `abstract-<id>.md`, `abstract-<id>.json` (draft leases entry), `abstract-<id>-citations.csv` | allow |
| `pm_system_update`, `esign_send` | refused | block |

## Files it reads

`.txt`, `.md` and `.docx`. Page markers such as `--- Page 5 ---` (or form feeds from `pdftotext`) give page numbers. PDF is not read directly: convert it to text first. Files over 5 MB are refused.

## Limits

- It reads common patterns in English lease language. Leases are drafted many ways; a term written differently is not found and becomes an open item. It does not look for exclusives, co-tenancy, radius, relocation, assignment, guaranty or default terms.
- It is not a legal reading of the lease. A person reads the lease before relying on the abstract.
- Scanned leases need OCR first; Slate does not do OCR.
