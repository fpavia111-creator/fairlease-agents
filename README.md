# Keystone freight agents

Thirty small MCP agents for freight and shipping cost. Each one owns **one job**, such as auditing a freight bill, building the month-end accrual, settling carrier pay or checking a customs entry, and cannot act outside it. They read the files you already export from your TMS, ERP, WMS, carrier portals and EDI provider, write reports on your machine, and wait for a named person before anything that moves money, sends a message or changes a live system.

MIT licence · Node 20 or newer · local files only · no credentials · no dependencies

Also in: [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [한국어](README.ko.md) (translated by Claude; native review pending)

## Try one

```bash
npx -y polaris-of-bills demo        # freight bill audit on fictional data
npx -y procyon-of-accruals demo     # month-end freight accrual on fictional data
```

Every agent has a `demo` that runs on fictional files, an `eval` that checks it against its own test cases, and an MCP server (`npx -y <agent> mcp --root <folder>`) for Claude Desktop, Claude Code, Cursor and other MCP hosts. Each agent's README lists its tools.

## The agents

**Audit what carriers bill**

| Agent | What it does | Waits for a person before |
|---|---|---|
| [`polaris-of-bills`](packages/polaris-of-bills) | Truckload and LTL bills (CSV, Excel or X12 210) against your contract rates, fuel table and accessorial terms; duplicates and math errors | Sending a dispute or approving payment |
| [`sirius-of-parcels`](packages/sirius-of-parcels) | UPS, FedEx, DHL and USPS invoice data: late deliveries, duplicates, surcharges, address corrections | Submitting refund claims |
| [`vega-of-detention`](packages/vega-of-detention) | Detention, layover and lumper charges against your dock times and free time | Sending a dispute |
| [`spica-of-fuel`](packages/spica-of-fuel) | Every fuel surcharge against the carrier's fuel table and the diesel price for the right week | Sending a dispute |
| [`betelgeuse-of-accessorials`](packages/betelgeuse-of-accessorials) | Where accessorial charges come from (liftgate, residential, limited access) and the address or order fixes that stop them | Changing addresses or order rules |
| [`bellatrix-of-reweighs`](packages/bellatrix-of-reweighs) | LTL weight and class corrections against your declared dimensions and density | Sending a challenge |
| [`algol-of-duplicates`](packages/algol-of-duplicates) | Years of freight payments for invoices paid twice, under variant numbers or two vendor records | Sending a recovery request |
| [`adhara-of-ocean`](packages/adhara-of-ocean) | Ocean invoices line by line against your service contract, surcharges and validity windows | Sending a dispute |
| [`canopus-of-air`](packages/canopus-of-air) | Air freight invoices: chargeable weight, rate breaks and surcharges | Sending a dispute |
| [`alcor-of-pods`](packages/alcor-of-pods) | Every delivered or invoiced shipment matched to its proof of delivery; what to chase and what to hold | Sending POD requests |
| [`fomalhaut-of-demurrage`](packages/fomalhaut-of-demurrage) | Container free time at the port and with the line, demurrage and detention exposure, charges to dispute | Sending a dispute |
| [`antares-of-entries`](packages/antares-of-entries) | Customs entry lines against commercial invoices: value, quantity, origin, duty arithmetic, codes used inconsistently. No classification advice | Sending a note to the broker |

**Plan, buy and run freight**

| Agent | What it does | Waits for a person before |
|---|---|---|
| [`altair-of-bids`](packages/altair-of-bids) | RFP bids scored lane by lane with share caps, incumbents, backups and capacity | Sending awards |
| [`regulus-of-tariffs`](packages/regulus-of-tariffs) | Your shipment history re-rated under every contract you hold, lanes ranked by money left on the table | Changing the routing guide |
| [`nunki-of-quotes`](packages/nunki-of-quotes) | Spot quotes on one all-in basis (fuel, accessorials, expiry, transit) | Tendering the load |
| [`mizar-of-lanes`](packages/mizar-of-lanes) | Spend by lane and mode, cost per hundredweight trends, consolidation opportunities | Sending a consolidation plan |
| [`rigel-of-scorecards`](packages/rigel-of-scorecards) | Carrier scorecards on on-time, tender acceptance, claims and cost | Sending a scorecard |
| [`aldebaran-of-carriers`](packages/aldebaran-of-carriers) | Warning signs of fraud and double brokering in the carrier master and booked loads | Sending a verification request |
| [`mira-of-tracking`](packages/mira-of-tracking) | Open loads with stale or late tracking, at risk of missing delivery | Sending delay notices |
| [`hadar-of-docks`](packages/hadar-of-docks) | A day of dock appointments across doors, crews and hours; no-shows and waits in past appointments | Publishing the schedule |
| [`deneb-of-cartons`](packages/deneb-of-cartons) | Every parcel's carton against its contents, dimensional weight saved by a better fit | Changing packing rules |
| [`arcturus-of-edi`](packages/arcturus-of-edi) | X12 204, 210, 214, 990 and 997 files read, converted and reconciled | Never transmits EDI |

**Close the books and cost the business**

| Agent | What it does | Waits for a person before |
|---|---|---|
| [`procyon-of-accruals`](packages/procyon-of-accruals) | Month-end freight accrual with the basis of every estimate and a draft journal | Approving the journal for posting |
| [`castor-of-allocations`](packages/castor-of-allocations) | Freight bills split across orders, customers, SKUs and cost centers, with a draft reclass journal | Approving the journal for posting |
| [`pollux-of-costing`](packages/pollux-of-costing) | Standard freight in item costs against actual freight per unit; stale standards and proposals | Loading new standards |
| [`elnath-of-margins`](packages/elnath-of-margins) | Freight charged to customers against what it cost; collect orders you paid, free-shipping leaks | Changing customer terms |
| [`alnilam-of-settlements`](packages/alnilam-of-settlements) | For brokers: carrier pay against rate confirmations, quick pay and notices of assignment | Releasing a payment batch |
| [`capella-of-claims`](packages/capella-of-claims) | Loss, shortage and damage claims with liability caps and filing deadlines | Filing a claim |
| [`achernar-of-returns`](packages/achernar-of-returns) | Returns from authorisation to credit, and return freight billed twice | Sending a carrier dispute |
| [`shaula-of-emissions`](packages/shaula-of-emissions) | Shipment emissions estimated from weight, distance and the factors you choose. Estimates only | Sending a customer statement |

## How they stay safe

- **Allowlist per agent.** Each agent can call only its own tools. Anything else is blocked, including tools a host model invents.
- **Refused tools.** Each agent names the live actions near its job (paying, emailing, changing the TMS, posting to the ledger, filing with customs) and blocks them, so a model asking for them gets a clear refusal.
- **One named click.** Approving a payment, a send, a production change or a journal waits for a named person, even in Auto mode. The approval is tied to the sha256 of the reviewed draft; if the draft changes, the approval no longer matches.
- **Audit log.** Every call is written to a hash-chained log under `.keystone/`, signed with an Ed25519 key when you configure one.
- **Kill switch.** `<agent> kill` stops every tool until `<agent> unkill`.
- **Hostile input tested.** Spreadsheet formulas, HTML, path tricks and text aimed at the model are planted in every agent's data in CI (`npm run hostile`).

## Use with Claude Code

This repository is a Claude Code plugin marketplace. Each agent is a plugin that starts its MCP server with `npx`:

```text
/plugin marketplace add <path or git URL of this repository>
/plugin install polaris-of-bills@keystone-freight
```

The plugins start `npx -y <agent>@<version>`, so they need that version on npm. Until then, add an agent from a local checkout:

```bash
claude mcp add polaris-of-bills -- node /path/to/keystone-agents/packages/polaris-of-bills/bin/polaris-of-bills.js mcp --root .
```

## Develop

```bash
npm ci
npm test                       # every package's tests and evals
npm run hostile                # planted hostile inputs in every agent
npm run plugin:check           # plugin files match the packages
npm run release:check:offline  # pack contents, licences, docs and versions
node scripts/new-agent.mjs <star>-of-<word> "<description>" kw1,kw2 <module>
```

CI runs on Node 20, 22 and 24, on Linux and Windows.

## Limits

- Every agent works from the files you give it. None of them logs in to a carrier, TMS, ERP, bank or government system.
- Findings and estimates are only as good as those files. Each report says what it assumed.
- Not legal, tax, customs or accounting advice. People decide and act.
