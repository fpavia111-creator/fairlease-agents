# Quartz of Delinquency (`quartz-of-delinquency`)

Turns a tenant ledger or an aging report into a delinquency worklist: who owes what and for how long, which stage each balance is at under **your** policy, which late fees were charged too early or above your cap, and who is on a payment plan. It drafts courtesy reminders for a person to send. It never serves a legal notice, files an eviction, reports to a credit bureau or posts a fee.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y quartz-of-delinquency demo
npx -y quartz-of-delinquency mcp --root ./collections
```

## How it works

- **From a ledger**, Quartz ages balances itself: payments and credits pay the oldest open charge first, and what is left ages from its own date into 1–30, 31–60, 61–90 and 90+ days. **From an aging report** (AppFolio Delinquency, Yardi Aged Receivables, Buildium Outstanding balances, or your own columns) it uses the buckets as exported.
- **Stages** are yours: `stages: [{ "days": 1, "name": "reminder" }, ...]` in the policy file, by days of the oldest open charge. Without a policy, reminder at 1 day, second_reminder at 15 and manager_review at 30 are used as internal workflow labels only.
- **Late fees** are checked only when your policy gives `grace_days` and `late_fee`. Rent paid on or before the due date plus `grace_days` is on time; a fee charged in that window, or on a month paid in it, is `late_fee_in_grace`. A fee above `late_fee.max` (or the flat amount, or the percent of the lease rent) is `late_fee_over_policy`. Rent paid late with no fee is a note: a person decides whether to charge it.

| Finding | Meaning |
|---|---|
| `balance_over_deposit` | Balance is more than the deposit in the leases file |
| `over_60_days` | Part of the balance is more than 60 days old |
| `late_fee_in_grace`, `late_fee_over_policy` | A fee to look at; the amount is in `fee_adjustment` |
| `late_fee_not_charged` | Late rent with no fee (note) |
| `on_payment_plan` | On a plan in your policy file; reminders paused |
| `credit_balance`, `below_minimum` | Prepaid, or under your `min_balance` (no action) |
| `lease_ended`, `former_tenant`, `in_collections` | Notes that change how a balance is handled |

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `quartz_check`, `quartz_explain` | read | allow |
| `quartz_write_report` | report: `quartz-delinquency.csv` and `.html` (in `--lang`) | allow |
| `quartz_draft_reminder` | write: a courtesy reminder with the open charges, marked "not a legal notice"; refused for tenants on a plan or in collections | ask |
| `quartz_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `serve_legal_notice`, `file_eviction`, `report_to_credit_bureau`, `post_tenant_charge`, `email_send` | refused | block |

## Limits

- Late-fee and notice rules differ by state and country. Quartz checks fees against the policy you write, not against any law.
- It does not decide who to pursue. A person and, where needed, counsel do.
- Not legal or accounting advice.
