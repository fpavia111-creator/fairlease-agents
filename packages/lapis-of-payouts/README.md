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
| `duplicate_payout` | Two reservation lines for one booking with the same amount |
| `paid_while_cancelled` | Reservation cancelled but money paid (it may be a cancellation fee you keep) |
| `fee_rate_differs` | Channel fee as a share of the stay (plus cleaning, unless `fee_base` is `gross`) differs from your `fee_pct` |
| `cleaning_fee_differs` | Cleaning fee differs from the listing's rate |
| `nights_differ`, `dates_differ` | The channel pays for different nights or a different check-in |
| `not_in_reservations` | Paid for a booking missing from your reservations file |
| `not_in_bank`, `deposit_without_payout` | A channel payout with no bank deposit within `bank_lag_days`, or a channel deposit with no payout |

Airbnb transaction history (with Payout rows) and Vrbo payout reports are recognised; other channels work when the file has a confirmation code and an amount. Airbnb's "Gross earnings" includes cleaning; Lapis splits it back out. Channel names come from the file name or a Channel column. German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean headers such as Buchungsnummer, Anreise, Provision, Auszahlung, Llegada or 予約番号 are read.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `lapis_check`, `lapis_explain` | read | allow |
| `lapis_write_report` | report: `lapis-payouts.csv` and `.html` (in `--lang`) | allow |
| `lapis_draft_inquiry` | write: an inquiry to the channel about one booking's payout | ask |
| `lapis_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `lapis_recall`, `lapis_learn` | domain memory: a channel's name for one of your listings (`listing_alias`) | allow (learning only proposes) |
| `lapis_accept_learning`, `lapis_retire_memory` | action, `accept_learning` | one named click, even in Auto |
| `issue_guest_refund`, `owner_payout`, `channel_listing_update`, `email_send` | refused | block |

## Limits

- Lapis compares files. It does not log in to a channel, see adjustments that are not in the files, or judge occupancy or tourist tax.
- Fee rates and lags are the ones in your policy file; channels change theirs, so keep the file current.
