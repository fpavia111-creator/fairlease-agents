# Fairlease Tenant Insurance (`fairlease-tenant-insurance`)

Checks every tenant's certificate of insurance against what **their own lease** requires: liability per occurrence, aggregate, renters liability, the landlord named as additional insured, and the expiration date. It lists leases with no certificate, certificates that expired or expire soon, and certificates that match no lease in force. It drafts requests for updated certificates. It never charges a tenant, buys cover for them or serves a notice of default.

MIT · Node 20 or newer · local files only · no credentials · built on [`fairlease-core`](../fairlease-core)

```bash
npx -y fairlease-tenant-insurance demo
npx -y fairlease-tenant-insurance mcp --root ./insurance
```

## What it checks

| Finding | Meaning |
|---|---|
| `certificate_missing` | Lease in force, nothing in the certificate log |
| `expired`, `expiring` | Past the expiration date, or within `warn_days` (default 30) |
| `expiry_missing` | Certificate has no expiration date |
| `insured_name_differs` | The certificate names someone other than the tenant on the lease |
| `liability_below`, `aggregate_below` | Below the lease's `gl_per_occurrence` / `renters_liability`, or `gl_aggregate`. Limits written `$1M`, `2MM` or `500K` are read |
| `additional_insured_missing` | Lease requires it; the log says no, or does not say |
| `holdover` (note) | Lease ended but its notes say month-to-month, so it is still checked |
| `no_requirement` (note) | The leases file sets no insurance clause for this lease |

Requirements come from each lease's `insurance` block in the leases JSON. Certificates are matched by lease ID, or by unit and tenant. When several certificates are on file, the latest expiration is used.


<!-- generated:start -->

## A demo run

`npx -y fairlease-tenant-insurance demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairlease Tenant Insurance demo (fictional tenants) in <demo folder>

▶ Check the retail leases in force against their certificate log
  status: executed  decision: allow
  5 lease(s) in force on 2026-11-15: 1 with no certificate, 1 expired, 2 short of the lease's limits or wording, 1 expiring within 30 days. 1 certificate(s) match no lease in force.
    Suite 110  Brightside Dental PC     issue     expiring, additional_insured_missing
    Suite 120  Cobalt Fitness Inc       issue     liability_below, aggregate_below
    Suite 140  Fairstay Grocers Ltd    issue     expired
    Suite 150  Fable Books              issue     certificate_missing
    Suite 100  Acme Bagels LLC          ok        

▶ Explain Suite 120 (limits below the lease)
  status: executed  decision: allow
  Suite 120 Cobalt Fitness Inc (lease L-103): issue. Requires 2,000,000 per occurrence, 4,000,000 aggregate, additional insured; on file Sample Casualty (fictional), expires 2027-01-01, liability 1000000. Liability 1,000,000 is below the 2,000,000 the lease requires. Aggregate 3,000,000 is below the 4,000,000 the lease requires.

▶ Read a Spanish renters insurance log (Unidad, Aseguradora, Responsabilidad, Vencimiento)
  status: executed  decision: allow
  22 lease(s) in force on 2026-11-15: 19 with no certificate, 1 expired, 1 short of the lease's limits or wording, 0 expiring within 30 days.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 5 lease(s) in force on 2026-11-15: 1 with no certificate, 1 expired, 2 short of the lease's limits or wording, 1 expiring within 30 days. 1 certificate(s) match no lease in force.

▶ Draft a certificate request to Fairstay Grocers
  status: executed  decision: allow  (auto)
  request Suite 140 drafted with 1 open marker(s) ([TO CONFIRM: tenant notice address or email]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to buy cover and charge the tenant itself
  status: blocked  decision: block
  reason: Fairlease Tenant Insurance never buys insurance on a tenant's behalf or charges them for it.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `coi_check` | Every lease in force against its own insurance clause: certificate missing, expired, expiring within warn_days, liability or aggregate below the lease, landlord not named as additional insured. | runs |
| `coi_explain` | Show one lease's requirement, the certificate on file and each finding. | runs |
| `coi_write_report` | Write the tenant insurance worklist as coi-insurance.csv (one row per item, blank decision columns) and coi-insurance.html into out_dir (default keystone-out/coi). | runs |
| `coi_draft_request` | Write drafts/request-<unit>.md: a request to the tenant for an updated certificate, listing exactly what is missing, expired or short of the lease. | asks first (Auto can be opted in) |
| `coi_request_send` | After one named human click (even in Auto), record that the reviewed request draft is approved in request-requests.csv. | one named click, even in Auto (`binding_send`) |
| `force_place_insurance` | Fairlease Tenant Insurance never buys insurance on a tenant's behalf or charges them for it. | refused |
| `post_tenant_charge` | Fairlease Tenant Insurance never posts a non-compliance fee or any charge to a tenant ledger. | refused |
| `serve_default_notice` | Fairlease Tenant Insurance never serves a notice of default; that is a person's decision. | refused |
| `email_send` | Fairlease Tenant Insurance never sends requests; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Tenant certificates of insurance (`certificates`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `unit` (required) | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `tenant` | text | Tenant, Tenant Name, Tenants, Resident, Resident Name, Name | Mieter, Locataire, 賃借人, 租户 |
| `lease_id` | text | Lease, Lease ID, Lease Code, Lease Number, Lease #, Tenant Code | Mietvertrag, Bail, 契約番号, 合同编号 |
| `insurer` | text | Insurer, Insurance Company, Carrier, Insurance Carrier, Provider, Versicherer | - |
| `policy` | text | Policy, Policy Number, Policy #, Policennummer, Police, N° de police | - |
| `liability` | amount | Liability, Liability Limit, Liability Coverage, Personal Liability, GL Per Occurrence, Each Occurrence | - |
| `aggregate` | amount | Aggregate, General Aggregate, GL Aggregate | - |
| `expires` | date | Expires, Expiration, Expiration Date, Policy End, Policy Expiration, End Date | Ablaufdatum, Date d'expiration, 有効期限, 到期日 |
| `additional_insured` | text | Additional Insured, Additional Interest, Landlord Named, Interested Party, Mitversichert, Assuré additionnel | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx fairlease-tenant-insurance inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairlease-tenant-insurance demo
npx -y fairlease-tenant-insurance mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairlease-tenant-insurance": {
      "command": "npx",
      "args": [
        "-y",
        "fairlease-tenant-insurance",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairlease-tenant-insurance -- npx -y fairlease-tenant-insurance mcp --root .`, or install the `fairlease-tenant-insurance` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairlease-tenant-insurance approve <id> --as "Your Name"` (or on the local approvals page, `fairlease-tenant-insurance approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairlease-tenant-insurance kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairlease-tenant-insurance tools                 # every tool, its policy and arguments
fairlease-tenant-insurance sources               # the columns each input is read from
fairlease-tenant-insurance inspect <file>        # how a file would be read (names and shapes, never values)
fairlease-tenant-insurance call coi_check '{"leases":"<leases>","certificates":"<certificates>"}'
fairlease-tenant-insurance eval                  # the private eval cases on the fictional fixtures
fairlease-tenant-insurance demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Fairlease Tenant Insurance compares the fields in your certificate log with the clause in your leases file. It does not read certificate PDFs, verify a policy with an insurer, or judge whether cover is adequate.
- Not legal or insurance advice.
