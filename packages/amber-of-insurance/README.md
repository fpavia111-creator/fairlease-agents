# Amber of Insurance (`amber-of-insurance`)

Checks every tenant's certificate of insurance against what **their own lease** requires: liability per occurrence, aggregate, renters liability, the landlord named as additional insured, and the expiration date. It lists leases with no certificate, certificates that expired or expire soon, and certificates that match no lease in force. It drafts requests for updated certificates. It never charges a tenant, buys cover for them or serves a notice of default.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y amber-of-insurance demo
npx -y amber-of-insurance mcp --root ./insurance
```

## What it checks

| Finding | Meaning |
|---|---|
| `certificate_missing` | Lease in force, nothing in the certificate log |
| `expired`, `expiring` | Past the expiration date, or within `warn_days` (default 30) |
| `expiry_missing` | Certificate has no expiration date |
| `liability_below`, `aggregate_below` | Below the lease's `gl_per_occurrence` / `renters_liability`, or `gl_aggregate` |
| `additional_insured_missing` | Lease requires it; the log says no, or does not say |
| `holdover` (note) | Lease ended but its notes say month-to-month, so it is still checked |
| `no_requirement` (note) | The leases file sets no insurance clause for this lease |

Requirements come from each lease's `insurance` block in the leases JSON. Certificates are matched by lease ID, or by unit and tenant. When several certificates are on file, the latest expiration is used.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `amber_check`, `amber_explain` | read | allow |
| `amber_write_report` | report: `amber-insurance.csv` and `.html` (in `--lang`) | allow |
| `amber_draft_request` | write: a request listing exactly what is missing, expired or short | ask |
| `amber_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `force_place_insurance`, `post_tenant_charge`, `serve_default_notice`, `email_send` | refused | block |

Local headers such as Aseguradora, Responsabilidad, Vencimiento, Versicherer, Assureur or 満期日 are read; `amber-of-insurance inspect <file>` shows how a file's columns were matched.

## Limits

- Amber compares the fields in your certificate log with the clause in your leases file. It does not read certificate PDFs, verify a policy with an insurer, or judge whether cover is adequate.
- Not legal or insurance advice.
