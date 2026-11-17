# Topaz of Utilities (`topaz-of-utilities`)

Re-works RUBS (ratio utility billing) from the utility bills and who lived where, by **your** method, and compares it with what residents were actually billed. It finds residents billed more than the bill, vacant units still billed, duplicate charges, units left out, and bills that spike (often a leak worth fixing before anyone is billed). It never posts a charge or a credit.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y topaz-of-utilities demo
npx -y topaz-of-utilities mcp --root ./utilities
```

## How the split works

1. The common-area part comes off first: the bill's own common-area column, or `common_area_pct`.
2. Each tenancy is weighted by the days it overlaps the bill period. Days a unit has nobody are the owner's share (`vacant_occupants`, default 1, says how many people a vacant unit counts as in an occupant split).
3. The rest is split by your method per utility: `sqft`, `occupants`, `units`, or a mix such as `{ "occupants": 0.5, "sqft": 0.5 }`. Cents always add up to the bill.
4. Each utility charge in the ledger belongs to the latest bill of that utility that ended before it (within `billing_window_days`, default 45). `cap_per_unit` limits what a unit may be billed.

| Finding | Meaning |
|---|---|
| `over_recovery` | Residents were billed more than their share of a bill |
| `billed_while_vacant` | A charge for a unit with nobody in it that period |
| `duplicate_charge`, `overbilled`, `underbilled`, `not_billed` | Per unit, against the split |
| `bill_spike` | Cost per day more than `spike_pct` (default 25%) above the earlier bills of that utility |


## Files it reads

- **Bills**: utility, service from and to, amount, optional common-area amount. Local headers are read (Versorgung, Zeitraum, Betrag; 種別, 開始日, 終了日, 金額 …).
- **Occupancy**: one row per tenancy (unit, tenant, square feet, occupants, move-in, move-out).
- **RUBS file** (`rubs` schema) and, optionally, the **tenant ledger** with the utility charges billed.

<!-- generated:start -->

## A demo run

`npx -y topaz-of-utilities demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Topaz of Utilities demo (fictional 24-unit apartment building) in <demo folder>

▶ Re-work three months of water/sewer and trash billbacks and compare with what was billed
  status: executed  decision: allow
  6 bill(s), 15370 in total: residents' share 14414.13, owner's share 955.87 (common area and vacant days). Billed 14717.47; 4 unit(s) differ, 416.12 overbilled. 1 bill(s) spike: water_sewer 2026-10. Over-recovery on at least one bill.
    water_sewer  2026-08  bill     3980  residents     3781  owner     199  billed     3781  
    trash        2026-08  bill      640  residents      640  owner       0  billed   613.34  
    water_sewer  2026-09  bill     4050  residents   3847.5  owner   202.5  billed   3847.5  
    trash        2026-09  bill      640  residents      640  owner       0  billed      640  
    water_sewer  2026-10  bill     5420  residents  4901.76  owner  518.24  billed  5231.76  bill_spike, over_recovery
    trash        2026-10  bill      640  residents   603.87  owner   36.13  billed   603.87  

▶ Explain unit 204 (vacant since September, still billed in November)
  status: executed  decision: allow
  Unit 204 (Wren Adler): split 397.38, billed 577.38, difference 180. water_sewer 2026-10: billed while vacant (billed 180, split 0).

▶ Split only, from Japanese bills (種別, 開始日, 終了日, 金額)
  status: executed  decision: allow
  2 bill(s), 8030 in total: residents' share 7628.5, owner's share 401.5 (common area and vacant days). No billing file, so nothing billed is compared.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 6 bill(s), 15370 in total: residents' share 14414.13, owner's share 955.87 (common area and vacant days). Billed 14717.47; 4 unit(s) differ, 416.12 overbilled. 1 bill(s) spike: water_sewer 2026-10. Over-recovery on at least one bill.

▶ Agent tries to post a credit for the duplicate charge itself
  status: blocked  decision: block
  reason: Topaz never posts utility charges or credits; your billing team does after review.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `topaz_check` | For every bill: take off the common area, split the rest by your method with each tenancy weighted by days occupied (vacant days are the owner's share), then compare with the utility charges billed after the period. | runs |
| `topaz_explain` | Show one unit's split and billed amounts across bills, with every finding. | runs |
| `topaz_write_report` | Write the RUBS worklist as topaz-rubs.csv (one row per item, blank decision columns) and topaz-rubs.html into out_dir (default keystone-out/topaz). | runs |
| `post_tenant_charge` | Topaz never posts utility charges or credits; your billing team does after review. | refused |
| `utility_portal_update` | Topaz never changes billing settings in a utility billing or property management system. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Utility bills (`bills`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `utility` (required) | text | Utility, Service, Utility Type, Type, Commodity | Typ, Type, 種類, 类型 |
| `period_start` | date | Service From, Period Start, From, Start Date, Service Start, Bill Start | Eintrittsdatum, Date d'entrée, 入社日, 入职日期 |
| `period_end` | date | Service To, Period End, To, End Date, Service End, Bill End | Austrittsdatum, Date de sortie, 退職日, 离职日期 |
| `amount` (required) | amount | Amount, Bill Amount, Total, Total Due, Charges, Current Charges | Betrag, Montant, 金額, 金额 |
| `account` | text | Account, Account Number, Utility Account, Meter | Konto, Compte, 勘定科目, 科目代码 |
| `common_area` | amount | Common Area, Common Area Amount, House Meter, Vacant/Common Deduction | - |

### Occupancy (`occupancy`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `unit` (required) | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `tenant` | text | Tenant, Tenant Name, Tenants, Resident, Resident Name, Name | Mieter, Locataire, 賃借人, 租户 |
| `sqft` | number | Sqft, Sq Ft, Square Feet, Area, Unit Sq Ft, SF | Fläche, Surface, 面積, 面积 |
| `occupants` | number | Occupants, Occupant Count, Residents, Persons, Household Size, Number of Occupants | Personen, Occupants, 入居人数, 居住人数 |
| `bedrooms` | number | Bedrooms, Beds, BR, Bed | Zimmer, Pièces, 間取り, 卧室 |
| `move_in` | date | Move-in, Move In, Move-In Date, Occupied From | Einzug, Date d’entrée, 入居日, 入住日期 |
| `move_out` | date | Move-out, Move Out, Move-Out Date, Occupied To | Auszug, Date de sortie, 退去日, 退租日期 |
| `billed` | amount | Billed, Utility Billed, Billback, RUBS Charge, Charged | Betrag, Montant, 金額, 金额 |

### Tenant ledger with utility charges (`billed`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `property` | text | Property, Property Name, Property Code, Prop, Prop Code, Building | Objekt, Immeuble, 物件, 物业 |
| `unit` | text | Unit, Unit Number, Unit #, Unit No, Unit(s), Suite | Einheit, Lot, 部屋番号, 房号 |
| `tenant` | text | Tenant, Tenant Name, Tenants, Resident, Resident Name, Name | Mieter, Locataire, 賃借人, 租户 |
| `lease_id` | text | Lease, Lease ID, Lease Code, Lease Number, Lease #, Tenant Code | Mietvertrag, Bail, 契約番号, 合同编号 |
| `date` (required) | date | Date, Transaction Date, Trans Date, Post Date, Posted, Posting Date | Datum, Date, 日付, 日期 |
| `due_date` | date | Due Date, Due | Fälligkeitsdatum, Date d'échéance, 期日, 截止日期 |
| `charge_code` | text | Charge Code, Charge Type, Code, Type, GL Account, Account | Buchungsart, Code de charge, 費目, 费用项目 |
| `description` | text | Description, Memo, Notes, Detail, Details | Beschreibung, Description, 摘要, 摘要 |
| `charge` | amount | Charges, Charge, Charge Amount, Increase, Debit, Billed | - |
| `payment` | amount | Payments, Payment, Payment Amount, Decrease, Credit, Received | Zahlung, Paiement, 入金, 收款 |
| `amount` | amount | Amount, Net Amount, Transaction Amount | Betrag, Montant, 金額, 金额 |
| `balance` | amount | Balance, Running Balance, Bal | Saldo, Solde, 残高, 余额 |
| `reference` | text | Reference, Ref, Check Number, Check #, Receipt #, Document | Referenz, Référence, 参照番号, 参考号 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| AppFolio | Tenant Ledger (CSV or Excel) | Date, Description, Increase, Decrease, Balance | no |
| Yardi Voyager | Resident Ledger (Excel) | Date, Charge Code, Charges, Payments, Balance | no |
| Buildium | Tenant ledger (CSV) | Date, Memo, Charges, Payments, Balance | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx topaz-of-utilities inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y topaz-of-utilities demo
npx -y topaz-of-utilities mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "topaz-of-utilities": {
      "command": "npx",
      "args": [
        "-y",
        "topaz-of-utilities",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add topaz-of-utilities -- npx -y topaz-of-utilities mcp --root .`, or install the `topaz-of-utilities` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `topaz-of-utilities approve <id> --as "Your Name"` (or on the local approvals page, `topaz-of-utilities approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`topaz-of-utilities kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
topaz-of-utilities tools                 # every tool, its policy and arguments
topaz-of-utilities sources               # the columns each input is read from
topaz-of-utilities inspect <file>        # how a file would be read (names and shapes, never values)
topaz-of-utilities call topaz_check '{"bills":"<bills>","occupancy":"<occupancy>","rubs":"<rubs>"}'
topaz-of-utilities eval                  # the private eval cases on the fictional fixtures
topaz-of-utilities demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Whether utilities may be billed back, and how, is set by your leases and local rules. Topaz applies your method; it does not check that the method is allowed.
- Not legal or accounting advice.
