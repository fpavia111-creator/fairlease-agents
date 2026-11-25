# Fairlease property management agents

Thirty small MCP agents for property management, aimed at commercial and mid-size residential operators. Each one owns **one job**, such as checking a rent roll against the leases, reconciling a trust account, recomputing CAM or chasing tenant insurance certificates, and cannot act outside it. They read the files you already export from AppFolio, Yardi, Buildium, Rent Manager and other systems, write reports on your machine, never move money or change a live system, and wait for a named person before any letter or notice goes out.

MIT licence · Node 20 or newer · local files only · no credentials · no dependencies

Also in: [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [한국어](README.ko.md) (translated by Claude; native review pending)

## Try one

From a checkout of this repository:

```bash
npm ci
node packages/fairlease-rent-roll-audit/bin/fairlease-rent-roll-audit.js demo     # rent roll against lease abstracts, fictional data
node packages/fairlease-trust-reconciliation/bin/fairlease-trust-reconciliation.js demo           # trust account three-way reconciliation, fictional data
```

Once the packages are on npm, the same works as `npx -y fairlease-rent-roll-audit demo`. Every agent has a `demo` that runs on fictional files, an `eval` that checks it against its own test cases, an `inspect <file>` that shows how a file's columns were read, and an MCP server (`<agent> mcp --root <folder>`) for Claude Desktop, Claude Code, Cursor and other MCP hosts. With `--lang` (en, de, fr, es, pt-BR, it, ja, zh-Hans, ko) the report titles, headings and column labels and the approvals page come out in that language; the finding sentences and tool results stay in English. Each agent's README lists its tools.

## The agents

**Rent roll, leases and revenue**

| Agent | What it does | Never does (blocked) |
|---|---|---|
| [`fairlease-rent-roll-audit`](packages/fairlease-rent-roll-audit) | Rent roll against your lease abstracts, unit by unit: rents, escalations, dates, deposits, areas, tenants, vacancies, holdovers | Change the property management system or post charges |
| [`fairlease-lease-abstracts`](packages/fairlease-lease-abstracts) | Commercial lease text abstracted term by term with a citation for each, and existing abstracts checked against the text | Change the system or send for signature |
| [`fairlease-rent-escalations`](packages/fairlease-rent-escalations) | Rent billed against each lease's escalation schedule (steps, percentages, CPI with floors and caps); increases coming up | Post charges |
| [`fairlease-lease-renewals`](packages/fairlease-lease-renewals) | Leases coming up for renewal, offer deadlines, proposed rents within your own cap, offer letters drafted | Send for signature or email |
| [`fairlease-occupancy-and-vacancy`](packages/fairlease-occupancy-and-vacancy) | Occupancy, leased percentage, exposure, vacancy loss and loss to lease from a rent roll | Change the system or publish listings |
| [`fairlease-percentage-rent`](packages/fairlease-percentage-rent) | Percentage rent from tenant sales reports, late and missing reports, tenant statements drafted | Post charges or start a sales audit |
| [`fairlease-estoppel-review`](packages/fairlease-estoppel-review) | Returned estoppel certificates against your lease abstracts before a sale or refinancing | Send for signature or upload to a data room |
| [`fairlease-acquisition-diligence`](packages/fairlease-acquisition-diligence) | A seller's rent roll against the trailing twelve months before you buy or lend | Submit an offer or upload to a data room |
| [`fairlease-pms-migration`](packages/fairlease-pms-migration) | Old system's rent roll against the new one's at cutover: units, tenants, rents, deposits, balances, dates, totals that do not tie | Approve go-live or delete old data |

**Residents, leasing and collections**

| Agent | What it does | Never does (blocked) |
|---|---|---|
| [`fairlease-delinquency-worklist`](packages/fairlease-delinquency-worklist) | Aging or tenant ledger turned into a worklist with stages from your own policy, late-fee checks, reminders drafted | Serve notices, file evictions or report to credit bureaus |
| [`fairlease-security-deposits`](packages/fairlease-security-deposits) | Move-out deposits against your own rules (deadline, itemisation, wear and tear, useful life); statement drafted | Issue refunds or send to collections |
| [`fairlease-tenant-insurance`](packages/fairlease-tenant-insurance) | Tenant insurance certificates against the limits, additional insured and dates the lease requires | Force-place insurance or serve default notices |
| [`fairlease-utility-billback`](packages/fairlease-utility-billback) | RUBS utility billbacks re-worked by your own method; over-recovery, vacant units billed, spikes | Post charges or change utility portals |
| [`fairlease-listing-checks`](packages/fairlease-listing-checks) | Listings across sites against the rent roll; wording flagged for a person to review | Publish listings, change asking rent or reply to prospects |
| [`fairlease-leasing-funnel`](packages/fairlease-leasing-funnel) | Leasing funnel from guest cards: slow or missing responses, follow-ups due, conversion and cost per lease by source | Decide applications, run screening or text prospects |
| [`fairlease-affordable-recerts`](packages/fairlease-affordable-recerts) | Affordable housing recertification dates and notices against the schedule in your policy file. Dates only | Certify households, submit to an agency or change rent |
| [`fairlease-short-term-rental-payouts`](packages/fairlease-short-term-rental-payouts) | Short-term rental payouts from Airbnb, Vrbo and others against reservations and bank deposits | Refund guests, pay owners or change channel listings |

**Owners, trust accounts and the books**

| Agent | What it does | Never does (blocked) |
|---|---|---|
| [`fairlease-trust-reconciliation`](packages/fairlease-trust-reconciliation) | Three-way reconciliation: bank statement, book register, owner and tenant ledgers | Move funds, void checks or post to the ledger |
| [`fairlease-owner-statements`](packages/fairlease-owner-statements) | Owner statements checked before they go out: math, carry-forward, reserves, distributions | Pay owners or publish statements |
| [`fairlease-management-fees`](packages/fairlease-management-fees) | Management, leasing and markup fees recomputed from each management agreement | Post owner credits or change fee setup |
| [`fairlease-cam-reconciliation`](packages/fairlease-cam-reconciliation) | CAM and operating expense reconciliation: pools, shares, gross-ups, caps, base years, admin fees | Post charges or change the system |
| [`fairlease-budget-variance`](packages/fairlease-budget-variance) | Budget against actuals, variances your agreement says must be explained, year-end forecast, owner memo drafted | Change the budget or post to the ledger |
| [`fairlease-tax-forms`](packages/fairlease-tax-forms) | 1099 readiness: payee totals against the threshold you give, tax ID and address gaps; tax IDs always masked | File 1099s, submit TIN matching or start backup withholding |
| [`fairlease-hoa-accounts`](packages/fairlease-hoa-accounts) | HOA and condo owner accounts against your assessment and collection policy; violations against your notice steps | Record liens or post fines |
| [`fairlease-property-taxes`](packages/fairlease-property-taxes) | Property tax assessments, installments and the appeal deadlines you enter; a calendar of due dates | File appeals or pay taxes |

**Operations and vendors**

| Agent | What it does | Never does (blocked) |
|---|---|---|
| [`fairlease-work-orders`](packages/fairlease-work-orders) | Open work orders aged against your targets, repeat problems, likely emergencies filed as routine, slow vendors | Dispatch vendors, approve invoices or close work orders |
| [`fairlease-unit-turns`](packages/fairlease-unit-turns) | Unit turns from move-out to move-in: days, cost by trade, chargeable items, rent lost | Dispatch vendors or post charges |
| [`fairlease-unit-inspections`](packages/fairlease-unit-inspections) | Move-out against move-in item by item, overdue inspections, poor items with no work order | Post charges or dispatch vendors |
| [`fairlease-capital-projects`](packages/fairlease-capital-projects) | Capital projects against budget, commitments, schedule and reserves | Approve change orders or invoices |
| [`fairlease-vendor-compliance`](packages/fairlease-vendor-compliance) | Vendor insurance, licence and tax form against your requirements; payments made while out of compliance | Approve invoices or change vendor status |

## How they stay safe

- **Allowlist per agent.** Each agent can call only its own tools. Anything else is blocked, including tools a host model invents.
- **Refused tools.** Each agent names the live actions near its job (refunds, charges, evictions, filings, sending email) and blocks them, so a model asking for them gets a clear refusal.
- **One named click.** Sending a drafted letter, accepting something the agent should remember, or approving a go-live waits for a named person, even in Auto mode. The approval is tied to the sha256 of the reviewed draft; if the draft changes, the approval no longer matches.
- **Audit log.** Every call is written to a hash-chained log under `.keystone/`, signed with an Ed25519 key when you configure one.
- **Kill switch.** `<agent> kill` stops every tool until `<agent> unkill`.
- **Hostile input tested.** Spreadsheet formulas, HTML, path tricks and text aimed at the model are planted in every agent's data (`npm run hostile`).
- **Personal data kept small.** Tax IDs are masked in every report. The audit log stores a hash of each call's arguments, not the arguments, and the agents keep no copy of your files.

## Use with Claude Code

This repository is a Claude Code plugin marketplace. Each agent is a plugin that starts its MCP server with `npx`:

```text
/plugin marketplace add <path or git URL of this repository>
/plugin install fairlease-rent-roll-audit@keystone-property
```

The plugins start `npx -y <agent>@<version>`, so they need that version on npm. Until then, add an agent from a local checkout:

```bash
claude mcp add fairlease-rent-roll-audit -- node /path/to/fairlease-agents/packages/fairlease-rent-roll-audit/bin/fairlease-rent-roll-audit.js mcp --root .
```

## Develop

```bash
npm ci
npm test                       # every package's tests and evals
npm run hostile                # planted hostile inputs in every agent
npm run bench                  # timings on 1,000 and 10,000 rows
npm run plugin:check           # plugin files match the packages
npm run intl                   # every eval again on files from eight other markets
npm run mcp:check              # official MCP SDK client against every agent (npm i --no-save @modelcontextprotocol/sdk ajv ajv-formats first)
npm run release:check:offline  # pack contents, licences, docs and versions
node scripts/new-agent.mjs <mineral>-of-<word> "<description>" kw1,kw2
```

The CI workflow runs on Node 20, 22 and 24, on Linux and Windows.

## Limits

- Every agent works from the files you give it. None of them logs in to a property management system, bank, listing site, channel or government portal.
- The named export layouts were written from knowledge of those systems' exports and were not checked against live accounts. When a header differs, `inspect` shows what was matched and `keystone-sources.json` lets you name columns by hand.
- Findings are only as good as those files. Each report says what it assumed.
- Not legal, tax, fair housing or accounting advice. Thresholds, deadlines and fee rules come from your own policy files. People decide and act.
