# Opal of Vendors (`opal-of-vendors`)

Checks every vendor against **your** requirements before the next payment goes out: liability, workers' comp and auto insurance, licence and tax ID, with extra requirements per trade and exemptions per vendor. With a payments file it shows money already paid to a vendor while something was expired or missing. It drafts requests for updated certificates. It never pays, holds a payment or changes a vendor record. Tax IDs are masked in every result.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y opal-of-vendors demo
npx -y opal-of-vendors mcp --root ./vendors
```

## What it checks

| Finding | Meaning |
|---|---|
| `gl_expired`, `wc_expired`, `auto_expired`, `license_expired` | Past the expiry date in the directory |
| `…_expiring` | Expires within `warn_days` (default 30) |
| `…_missing` | Required by your file, no date on record |
| `tax_id_missing`, `w9_missing` | Tax details your file requires |
| `paid_while_noncompliant` | Payments dated after something lapsed (or while it was missing) |

Requirements file: `default` applies to everyone (`gl`, `wc`, `auto`, `license`, `tax_id`, `w9`), `trades` adds by trade name (matched inside the vendor's trade text), `exempt` lists what a named vendor does not need (for example workers' comp for a sole proprietor with an exemption).

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `opal_check`, `opal_explain` | read | allow |
| `opal_write_report` | report: `opal-vendors.csv` and `.html` (in `--lang`) | allow |
| `opal_draft_request` | write: a request listing exactly what is expired or missing | ask |
| `opal_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `approve_invoice`, `vendor_status_update`, `email_send` | refused | block |

AppFolio vendor directory and Buildium vendor exports are recognised; local headers such as Fornecedor, CNPJ, Haftpflicht bis or 賠償責任保険期限 are read.

## Limits

- Opal reads dates and fields from your files. It does not read certificates or confirm coverage with an insurer.
- Not legal or insurance advice.
