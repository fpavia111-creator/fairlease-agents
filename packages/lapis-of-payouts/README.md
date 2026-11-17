# Lapis of Payouts (`lapis-of-payouts`)

For short-term and vacation rental managers. It reconciles what each channel paid against your reservations and your bank: payouts that never came, came short, came twice or came for a cancelled stay; channel fees and cleaning fees that differ from your rates; nights and check-in dates that differ; payouts for bookings you have no record of; and payouts that never reached the bank. It drafts payout inquiries to the channel. It never refunds a guest, pays an owner or changes a channel listing.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y lapis-of-payouts demo
npx -y lapis-of-payouts mcp --root ./payouts
```

## What it checks

| Finding | Meaning |
|---|---|
| `missing_payout` | Checked in more than `payout_lag_days` ago (per channel, default 3) and no payout line |
| `payout_short`, `payout_over` | Paid differs from the reservation's expected payout, or from your rates when there is no reservation file |
| `duplicate_payout` | Two reservation lines for one booking with the same amount, unless they are instalments that add up to what the reservation expects |
| `paid_while_cancelled` | Reservation cancelled but money paid (it may be a cancellation fee you keep) |
| `fee_rate_differs` | Channel fee as a share of the stay (plus cleaning, unless `fee_base` is `gross`) differs from your `fee_pct` |
| `cleaning_fee_differs` | Cleaning fee differs from the listing's rate |
| `nights_differ`, `dates_differ` | The channel pays for different nights or a different check-in |
| `not_in_reservations` | Paid for a booking missing from your reservations file |
| `not_in_bank`, `deposit_without_payout` | A channel payout with no bank deposit within `bank_lag_days`, or a channel deposit with no payout |

Confirmation codes match however they are typed (`hma1qx7z` is `HMA1QX7Z`). When two exports overlap, a line found in both is counted once and the summary says how many. On the bank statement, "DIRECT DEPOSIT" lines such as payroll are not taken for direct bookings.

Airbnb transaction history (with Payout rows) and Vrbo payout reports are recognised; other channels work when the file has a confirmation code and an amount. Airbnb's "Gross earnings" includes cleaning; Lapis splits it back out. Channel names come from the file name or a Channel column. German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean headers such as Buchungsnummer, Anreise, Provision, Auszahlung, Llegada or 予約番号 are read.


<!-- generated:start -->

## A demo run

`npx -y lapis-of-payouts demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Lapis of Payouts demo (fictional listings and guests) in <demo folder>

▶ Reconcile October payouts from two channels against reservations and the bank
  status: executed  decision: allow
  11 booking(s) across airbnb, vrbo: 3 paid as expected, 1 missing a payout, 5 with differences, 1 not yet due. Short or missing: 787.5. 9 payout(s) against the bank: 8 matched, 1 not found, 1 channel deposit(s) with no payout.
    HMF6PA3S                 missing   missing_payout
    vrbo 2026-11-06 331.2    missing   not_in_bank
    HMC3WE9P                 issue     payout_short, fee_rate_differs
    HA-502                   issue     cleaning_fee_differs
    HMD4YU2L                 issue     payout_short, nights_differ
    HA-503                   issue     not_in_reservations
    HME5IO8N                 issue     payout_over, duplicate_payout
    bank 2026-11-10 250      issue     deposit_without_payout
    HMG7DS5V                 pending   
    HMH8FG1B                 cancelled 

▶ Explain HMD4YU2L (channel paid for fewer nights)
  status: executed  decision: allow
  HMD4YU2L (airbnb, Lakeview Cabin, 2026-10-23 to 2026-10-26): issue. Expected 727.5, paid 533.5 in 1 line(s) on 2026-10-24. Paid 533.5; your reservation expects 727.5 (short 194). airbnb pays for 2 night(s); your reservation has 3.

▶ Read a German FeWo-direkt payout file (Buchungsnummer, Anreise, Provision, Auszahlung)
  status: executed  decision: allow
  2 booking(s) across vrbo: 1 paid as expected, 0 missing a payout, 1 with differences, 0 not yet due. Short or missing: 16.8. No bank file, so payouts are not matched to deposits.

▶ Write the worklist
  status: executed  decision: allow
  Worklist written (en): 11 booking(s) across airbnb, vrbo: 3 paid as expected, 1 missing a payout, 5 with differences, 1 not yet due. Short or missing: 787.5. 9 payout(s) against the bank: 8 matched, 1 not found, 1 channel deposit(s) with no payout.

▶ Draft a payout inquiry about HMC3WE9P (fee at 15% instead of 3%)
  status: executed  decision: allow  (auto)
  inquiry HMC3WE9P drafted with 1 open marker(s) ([TO CONFIRM: airbnb host support or account manager]). Nothing was sent.

▶ Auto: approve sending it, which stays one click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Agent tries to refund a guest itself
  status: blocked  decision: block
  reason: Lapis never refunds a guest or sends money anywhere.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `lapis_check` | Every reservation against the channel payout lines: payout missing after the channel's lag, short or over your expected payout, paid twice, paid while cancelled, channel fee off your rate, cleaning fee off your listin… | runs |
| `lapis_explain` | Show one reservation's expected and paid amounts, payout dates and each finding, or one payout's bank match. | runs |
| `lapis_write_report` | Write the payout reconciliation worklist as lapis-payouts.csv (one row per item, blank decision columns) and lapis-payouts.html into out_dir (default keystone-out/lapis). | runs |
| `lapis_draft_inquiry` | Write drafts/inquiry-<booking>.md: a payout inquiry to the channel's host support for one booking, listing exactly what differs. | asks first (Auto can be opted in) |
| `lapis_request_send` | After one named human click (even in Auto), record that the reviewed inquiry draft is approved in inquiry-requests.csv. | one named click, even in Auto (`binding_send`) |
| `lapis_recall` | Search this agent's own memory of the customer's setup: accepted facts (in use) and facts waiting for a person. | runs |
| `lapis_learn` | Propose one fact about the customer's setup for this agent to remember. | runs |
| `lapis_accept_learning` | A named person accepts or rejects a fact waiting in this agent's memory. | one named click, even in Auto (`accept_learning`) |
| `lapis_retire_memory` | A named person stops an accepted fact from applying. | one named click, even in Auto (`accept_learning`) |
| `issue_guest_refund` | Lapis never refunds a guest or sends money anywhere. | refused |
| `owner_payout` | Lapis never pays owners; owner statements and payouts are a person's job. | refused |
| `channel_listing_update` | Lapis never changes prices, fees or settings on a channel. | refused |
| `email_send` | Lapis never sends inquiries; a person sends the approved draft. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; Every result lists under `sources` how each file was read.

### Channel payouts (`payouts`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `booking_id` (required) | text | Confirmation Code, Reservation ID, Booking ID, Reservation, Reservation Number, Confirmation | Referenz, Référence, 参照番号, 参考号 |
| `channel` | text | Channel, Booking Source, Source, OTA, Booking Channel, Canal | Quelle, Source, 反響元, 来源 |
| `type` | text | Type, Transaction Type, Line Type | Typ, Type, 種類, 类型 |
| `listing` | text | Listing, Property, Listing Name, Rental, Unit, Property Name | Objekt, Immeuble, 物件, 物业 |
| `guest` | text | Guest, Guest Name, Traveler, Traveller | Gast, Voyageur, ゲスト, 房客 |
| `check_in` | date | Start date, Check-in, Check In, Arrival, Arrival Date, Start Date | Anreise, Arrivée, チェックイン, 入住 |
| `check_out` | date | End date, Check-out, Check Out, Departure, Departure Date, End Date | Abreise, Départ, チェックアウト, 退房 |
| `nights` | number | Nights, Night, Length of Stay, LOS | Nächte, Nuits, 泊数, 晚数 |
| `currency` | text | Currency, Currency Code | Währung, Devise, 通貨, 币种 |
| `gross` | amount | Gross earnings, Gross Earnings, Gross, Booking Amount, Rental Amount, Total Booking | - |
| `cleaning_fee` | amount | Cleaning fee, Cleaning Fee, Cleaning, Tarifa de limpieza, Limpieza, Reinigungsgebühr | - |
| `service_fee` | amount | Service fee, Service Fee, Host Fee, Commission, Channel Fee, Host service fee | - |
| `taxes` | amount | Occupancy taxes, Occupancy Taxes, Taxes, Lodging Tax, Tax | - |
| `amount` | amount | Amount, Net, Net Amount, Expected Payout, Payout Amount | Auszahlung, Versement, 支払額, 结算金额 |
| `paid_out` | amount | Paid out, Paid Out, Payout, Payout Sent, Actual Payout | - |
| `status` | text | Status, Reservation Status, Booking Status | Status, Statut, ステータス, 状态 |
| `payout_date` | date | Date, Payout Date, Paid Date, Transfer Date, Fecha de pago, Fecha del pago | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| Airbnb | Earnings > Transaction history > Export CSV | Confirmation Code, Nights, Paid out, Gross earnings or Service fee | no |
| Vrbo | Payouts / financial reporting export (CSV) | Reservation ID, Traveler, Payout Amount | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Reservations (`bookings`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `booking_id` (required) | text | Confirmation Code, Reservation ID, Booking ID, Reservation, Reservation Number, Confirmation | Referenz, Référence, 参照番号, 参考号 |
| `channel` | text | Channel, Booking Source, Source, OTA, Booking Channel, Canal | Quelle, Source, 反響元, 来源 |
| `type` | text | Type, Transaction Type, Line Type | Typ, Type, 種類, 类型 |
| `listing` | text | Listing, Property, Listing Name, Rental, Unit, Property Name | Objekt, Immeuble, 物件, 物业 |
| `guest` | text | Guest, Guest Name, Traveler, Traveller | Gast, Voyageur, ゲスト, 房客 |
| `check_in` | date | Start date, Check-in, Check In, Arrival, Arrival Date, Start Date | Anreise, Arrivée, チェックイン, 入住 |
| `check_out` | date | End date, Check-out, Check Out, Departure, Departure Date, End Date | Abreise, Départ, チェックアウト, 退房 |
| `nights` | number | Nights, Night, Length of Stay, LOS | Nächte, Nuits, 泊数, 晚数 |
| `currency` | text | Currency, Currency Code | Währung, Devise, 通貨, 币种 |
| `gross` | amount | Gross earnings, Gross Earnings, Gross, Booking Amount, Rental Amount, Total Booking | - |
| `cleaning_fee` | amount | Cleaning fee, Cleaning Fee, Cleaning, Tarifa de limpieza, Limpieza, Reinigungsgebühr | - |
| `service_fee` | amount | Service fee, Service Fee, Host Fee, Commission, Channel Fee, Host service fee | - |
| `taxes` | amount | Occupancy taxes, Occupancy Taxes, Taxes, Lodging Tax, Tax | - |
| `amount` | amount | Amount, Net, Net Amount, Expected Payout, Payout Amount | Auszahlung, Versement, 支払額, 结算金额 |
| `paid_out` | amount | Paid out, Paid Out, Payout, Payout Sent, Actual Payout | - |
| `status` | text | Status, Reservation Status, Booking Status | Status, Statut, ステータス, 状态 |
| `payout_date` | date | Date, Payout Date, Paid Date, Transfer Date, Fecha de pago, Fecha del pago | - |

### Bank statement (`bank`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `date` (required) | date | Date, Posting Date, Post Date, Transaction Date, Value Date, Buchungstag | Datum, Date, 日付, 日期 |
| `description` | text | Description, Details, Memo, Payee, Transaction Description | Beschreibung, Description, 摘要, 摘要 |
| `amount` | amount | Amount, Transaction Amount, Net Amount | Betrag, Montant, 金額, 金额 |
| `debit` | amount | Debit, Withdrawal, Withdrawals, Money Out, Payment, Payments | Ausgang, Débit, 出金, 支出 |
| `credit` | amount | Credit, Deposit, Deposits, Money In, Receipts | Eingang, Crédit, 入金, 收入 |
| `reference` | text | Reference, Check Number, Check #, Ref, Bank Reference, Check No | Referenz, Référence, 参照番号, 参考号 |
| `balance` | amount | Balance, Running Balance, Running Bal. | Saldo, Solde, 残高, 余额 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. The repository's `npm run intl` runs this agent's eval cases again on German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean versions of the fixture files and requires the same results. Columns named differently? Run `npx lapis-of-payouts inspect <file>` (names and shapes only, never values) and name them in `keystone-sources.json`:

```json
{ "files": { "exports/rent-roll.csv": { "columns": { "unit": "Einheit" }, "date_order": "dmy" } } }
```

## Memory

lapis-of-payouts can remember facts about your setup so the next run does not have to be told again. `lapis_learn` only proposes a fact; it changes nothing until a named person accepts it with `lapis_accept_learning`, which is one click even in Auto. Facts live in one hash-chained file per agent under `.keystone/memory/`; if the chain does not verify, no fact is used. Credentials, personal identifiers and text that reads like instructions to an AI are refused. Run without memory with `--no-memory`.

| Kind | What an accepted fact changes |
|---|---|
| `listing_alias` | reads that channel listing name as your listing when matching cleaning fees and reservations; never changes an amount, fee rate or tolerance |
| `note` | nothing (shown by recall only) |

```bash
lapis-of-payouts memory list
lapis-of-payouts memory accept MEM-1a2b3c4d5e6f --as "Your Name"
lapis-of-payouts memory retire MEM-1a2b3c4d5e6f --as "Your Name" --reason "code retired"
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y lapis-of-payouts demo
npx -y lapis-of-payouts mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "lapis-of-payouts": {
      "command": "npx",
      "args": [
        "-y",
        "lapis-of-payouts",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add lapis-of-payouts -- npx -y lapis-of-payouts mcp --root .`, or install the `lapis-of-payouts` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `lapis-of-payouts approve <id> --as "Your Name"` (or on the local approvals page, `lapis-of-payouts approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`lapis-of-payouts kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
lapis-of-payouts tools                 # every tool, its policy and arguments
lapis-of-payouts sources               # the columns each input is read from
lapis-of-payouts inspect <file>        # how a file would be read (names and shapes, never values)
lapis-of-payouts call lapis_check '{"payouts":"<payouts>"}'
lapis-of-payouts eval                  # the private eval cases on the fictional fixtures
lapis-of-payouts demo
```

## Audit log and data

Every call is written to `.keystone/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Lapis compares files. It does not log in to a channel, see adjustments that are not in the files, or judge occupancy or tourist tax.
- Fee rates and lags are the ones in your policy file; channels change theirs, so keep the file current.
