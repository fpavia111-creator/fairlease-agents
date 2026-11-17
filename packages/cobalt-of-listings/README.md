# Cobalt of Listings (`cobalt-of-listings`)

For leasing and marketing teams. It checks your rental listings on your website and listing sites against the rent roll: vacant or soon-vacant units that are not listed or are missing from a site you require, occupied units that are still listed, listings for units that are not in the rent roll, asking rent off the rent roll's market rent or different between sites, deposits, pets, beds, baths and size that differ, stale or too-early available dates, duplicate listings, and phrases in titles or descriptions for a person to review. It drafts correction requests. It never posts, edits or removes a listing.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y cobalt-of-listings demo
npx -y cobalt-of-listings mcp --root ./listings
```

## What it checks

| Finding | Meaning |
|---|---|
| `not_listed`, `missing_on_channel` | Vacant, or on notice within `list_notice_days` (default 30), and not listed anywhere or not on a site in `required_channels` |
| `listed_while_occupied`, `not_in_rent_roll` | Active listing for an occupied unit with no move-out soon, or for a unit the rent roll does not have |
| `rent_differs`, `rent_inconsistent` | Asking rent more than `rent_tolerance_pct` (default 2) from market rent, or different between sites |
| `deposit_inconsistent`, `pets_inconsistent`, `details_differ` | Deposit or pet terms differ between sites; beds, baths or size (over 5%) differ from the rent roll |
| `available_date_stale`, `available_before_move_out` | Available date more than `stale_days` (default 14) ago, or on or before the current resident's move-out |
| `duplicate_listing` | Two active listings for one unit on one site |
| `wording_review` | A phrase from the review list appears in the title or description |

Listings marked leased, rented, expired, inactive or similar (in nine languages) are not counted as active. The review list holds phrases that fair housing guidance often asks people to look at again (for example "adults only", "no section 8", "sin niños"); set `review_words` to use your own list. **Cobalt only points to wording; it does not judge whether an advertisement is lawful.**


Rent roll statuses are read the way the systems write them: `Vacant Rented` or `Notice Leased` means the next lease is signed, so no listing is expected and one still running is `listed_but_leased`; `Notice` with no move-out date still expects a listing; `Model`, `Down`, `Admin` and `Employee` units are left out unless they are advertised (`listed_not_rentable`). A resident named "Vacanti" is a resident. A listing with no price or a zero price is not compared with the market rent. When the rent roll has the same unit number under two properties, the property name tells them apart.

<!-- generated:start -->

## A demo run

`npx -y cobalt-of-listings demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Cobalt of Listings demo (fictional building) in <demo folder>

▶ Check listings on three sites against the rent roll
  status: executed  decision: allow
  5 vacant or on-notice unit(s): 4 listed on every required site, 0 not listed, 1 missing a site. 1 occupied unit(s) still listed, 1 listing(s) for units not in the rent roll. 1 unit(s) with rent differences, 1 with details that differ, 2 with wording to review.
    103   vacant    issue   missing_on_channel, rent_differs, rent_inconsistent, wording_review, pets_inconsistent
    104   notice    issue   available_before_move_out
    105   occupied  issue   listed_while_occupied, available_date_stale
    106   vacant    issue   duplicate_listing, wording_review, available_date_stale
    108   vacant    issue   details_differ
    201   unknown   issue   not_in_rent_roll
    102   vacant    ok      

▶ Explain unit 103
  status: executed  decision: allow
  Unit 103, Birch Street Lofts (fictional): vacant, issue. Market rent 1875; listed on Website, Zillow. Not listed on Apartments.com. Zillow asks 1795; the rent roll's market rent is 1875 (-4.27%). Asking rent differs between sites: Website 1875, Zillow 1795. Website listing uses "perfect for a couple". A person should review the wording; Cobalt does not judge whether it is allowed. Pet terms differ between sites: Website "Cats and dogs", Zillow "Cats only".

▶ Read a French listings export (Référence annonce, Loyer, Disponible le)
  status: executed  decision: allow
  1 vacant or on-notice unit(s): 1 listed, 0 not listed, 0 missing a site. 0 occupied unit(s) still listed, 0 listing(s) for units not in the rent roll. 1 unit(s) with rent differences, 0 with details that differ, 1 with wording to review.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 5 vacant or on-notice unit(s): 4 listed on every required site, 0 not listed, 1 missing a site. 1 occupied unit(s) still listed, 1 listing(s) for units not in the rent roll. 1 unit(s) with rent differences, 1 with details that differ, 2 with wording to review.

▶ Draft corrections for unit 106
  status: executed  decision: allow  (auto)
  correction 106 drafted with 1 open marker(s) ([TO CONFIRM: leasing or marketing contact]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to change a listing itself
  status: blocked  decision: block
  reason: Cobalt never posts, edits or takes down a listing on any site.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `cobalt_check` | Vacant and on-notice units not listed or missing from a required site; occupied units still listed; listings for units not in the rent roll; asking rent off the rent roll's market rent or different between sites; depo… | runs |
| `cobalt_explain` | Show one unit's occupancy, market rent, the sites it is listed on and each finding. | runs |
| `cobalt_write_report` | Write the listings worklist as cobalt-listings.csv (one row per item, blank decision columns) and cobalt-listings.html into out_dir (default keystone-out/cobalt). | runs |
| `cobalt_draft_correction` | Write drafts/correction-<unit>.md: a list of listing corrections for one unit, for your leasing or marketing contact or syndication vendor. | asks first (Auto can be opted in) |
| `cobalt_request_send` | After one named human click (even in Auto), record that the reviewed correction draft is approved in correction-requests.csv. | one named click, even in Auto (`binding_send`) |
| `publish_listing` | Cobalt never posts, edits or takes down a listing on any site. | refused |
| `change_asking_rent` | Cobalt never changes asking rents in your system or on a site. | refused |
| `reply_to_prospect` | Cobalt never writes to prospects. | refused |
| `email_send` | Cobalt never sends corrections; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Listings (`listings`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `listing_id` | text | Listing ID, Listing, ID, MLS #, Ad ID, Posting ID | Kennung, Identifiant, 番号, 编号 |
| `channel` | text | Channel, Source, Site, Portal, Syndication, Portail | Quelle, Source, 反響元, 来源 |
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `unit` (required) | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `bedrooms` | number | Bedrooms, Beds, BR, Bed | Zimmer, Pièces, 間取り, 卧室 |
| `bathrooms` | number | Bathrooms, Baths, BA, Bath, Salles de bain, Badezimmer | - |
| `sqft` | number | Sqft, Sq Ft, Square Feet, Size, Area | Fläche, Surface, 面積, 面积 |
| `rent` | amount | Rent, Price, Asking Rent, Monthly Rent, List Price, Market Rent | Miete, Loyer, 賃料, 租金 |
| `deposit` | amount | Deposit, Security Deposit | Kaution, Dépôt de garantie, 敷金, 押金 |
| `available` | date | Available, Available Date, Date Available, Available On, Move-in Date, Disponible le | Datum, Date, 日付, 日期 |
| `pets` | text | Pets, Pet Policy, Pets Allowed, Cats, Dogs, Animaux | - |
| `status` | text | Status, Listing Status, Posted | Status, Statut, ステータス, 状态 |
| `title` | text | Title, Headline, Listing Title, Marketing Title, Titre, Titel | Name, Nom, 名前, 名称 |
| `description` | text | Description, Listing Description, Ad Text, Marketing Description, Body, Texte | Beschreibung, Description, 摘要, 摘要 |

### Rent roll (`rent_roll`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `unit` (required) | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `tenant` | text | Tenant, Tenant Name, Tenants, Resident, Resident Name, Name | Mieter, Locataire, 賃借人, 租户 |
| `lease_id` | text | Lease, Lease ID, Lease Code, Lease Number, Lease #, Tenant Code | Mietvertrag, Bail, 契約番号, 合同编号 |
| `status` | text | Status, Unit Status, Tenant Status, Occupancy Status, Lease Status | Status, Statut, ステータス, 状态 |
| `sqft` | number | Sqft, Sq Ft, SqFt, Square Feet, Unit Sq Ft, Area | Fläche, Surface, 面積, 面积 |
| `bedrooms` | text | BD/BA, Beds, Bedrooms, Bed, Unit Type, Floorplan | Zimmer, Pièces, 間取り, 卧室 |
| `market_rent` | amount | Market Rent, Market, Asking Rent, Scheduled Rent | Marktmiete, Loyer de marché, 相場賃料, 市场租金 |
| `rent` | amount | Rent, Monthly Rent, Current Rent, Actual Rent, Lease Rent, Base Rent | Miete, Loyer, 賃料, 租金 |
| `annual_rent` | amount | Annual Rent, Annual Base Rent, Annual Rent Amount | - |
| `deposit` | amount | Deposit, Deposits, Deposits Held, Security Deposit, Resident Deposit, Deposit Held | Kaution, Dépôt de garantie, 敷金, 押金 |
| `lease_start` | date | Lease From, Lease Start, Lease Start Date, Lease Begin, Start Date, Commencement | Mietbeginn, Date de début du bail, 契約開始日, 租期开始 |
| `lease_end` | date | Lease To, Lease End, Lease End Date, Lease Expiration, Lease Exp, Expiration | Mietende, Date de fin du bail, 契約終了日, 租期结束 |
| `move_in` | date | Move-in, Move In, Move-In Date, Move In Date | Einzug, Date d’entrée, 入居日, 入住日期 |
| `move_out` | date | Move-out, Move Out, Move-Out Date, Move Out Date, Notice Date | Auszug, Date de sortie, 退去日, 退租日期 |
| `balance` | amount | Past Due, Balance, Balance Due, Current Balance, Amount Receivable, Total Unpaid | Saldo, Solde, 残高, 余额 |
| `charge_code` | text | Charge Code, Charge Type, Charge, Code | Buchungsart, Code de charge, 費目, 费用项目 |
| `charge_amount` | amount | Charge Amount, Amount, Lease Charges, Charge Amt | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| AppFolio | Reports > Rent Roll (CSV or Excel) | Unit, Tenant, Lease From, Lease To, Market Rent or BD/BA | no |
| Yardi Voyager | Rent Roll with Lease Charges (Excel) | Unit, Resident, Charge Code, Lease Expiration or Resident Deposit | no |
| Yardi Voyager (Commercial) | Commercial Rent Roll (Excel) | Unit(s), Lease, Area, Lease From, Lease To | no |
| Buildium | Reports > Rent roll (CSV or Excel) | Tenants, Lease start date, Lease end date, Rent | no |
| Rent Manager | Rent Roll report (Excel export) | Tenant Name, Unit Type, Lease Start, Lease End, Sq Ft | no |
| Entrata | Rent Roll report (Excel export) | Resident, Floor Plan, Scheduled Rent, Lease Start | no |
| RealPage OneSite | Rent Roll Detail (Excel export) | Floorplan, Unit/Lease Status, Lease Rent | no |
| MRI Commercial Management | Rent Roll (Excel export) | Suite, Occupant Name, Lease Begin, Lease Expiration | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx cobalt-of-listings inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y cobalt-of-listings demo
npx -y cobalt-of-listings mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "cobalt-of-listings": {
      "command": "npx",
      "args": [
        "-y",
        "cobalt-of-listings",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add cobalt-of-listings -- npx -y cobalt-of-listings mcp --root .`, or install the `cobalt-of-listings` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `cobalt-of-listings approve <id> --as "Your Name"` (or on the local approvals page, `cobalt-of-listings approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`cobalt-of-listings kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
cobalt-of-listings tools                 # every tool, its policy and arguments
cobalt-of-listings sources               # the columns each input is read from
cobalt-of-listings inspect <file>        # how a file would be read (names and shapes, never values)
cobalt-of-listings call cobalt_check '{"listings":"<listings>","rent_roll":"<rent_roll>"}'
cobalt-of-listings eval                  # the private eval cases on the fictional fixtures
cobalt-of-listings demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Cobalt compares your listings export with your rent roll. It does not visit listing sites, so a listing missing from the export is invisible to it.
- Not legal advice. Wording findings are prompts for a person's review.
