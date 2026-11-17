# Pyrite of Fees (`pyrite-of-fees`)

Recomputes the fees charged to each owner from the terms of **their** management agreement and compares them with the owner ledger: management fee (percent of collected income less security deposits and anything else the agreement excludes, or flat, with minimum and maximum), leasing and renewal fees (flat or a percent of the unit's rent from the rent roll), maintenance markup against the bills it applies to, fees charged twice in a month, and fees the agreement does not provide for. It drafts fee correction notes. It never posts a credit or changes a fee setup.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y pyrite-of-fees demo
npx -y pyrite-of-fees mcp --root ./fees
```

## What it checks

| Finding | Meaning |
|---|---|
| `management_fee_over` / `management_fee_under` (note) | Charged against the agreement's fee for the month |
| `duplicate_fee` | The same management fee charged more than once in a month |
| `leasing_fee_over`, `renewal_fee_over`, `…_not_in_agreement`, `…_unverified` (note) | Against the flat or percent-of-rent term; unverified when no unit in the rent roll matches |
| `markup_over`, `markup_not_in_agreement` | Markup against `maintenance_markup_pct` of maintenance bills (taxes, insurance, utility bills, payroll and fees are not marked up) |
| `fee_not_in_agreement`, `other_fee_over` | A fee line the agreement's `other_fees` does not list, or above its amount |

Fees are recognised by their wording in nine languages (management fee, Verwaltungsgebühr, honoraires de gestion, 管理手数料…). Owners in the ledger with no agreement entry are listed, never guessed.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `pyrite_check`, `pyrite_explain` | read | allow |
| `pyrite_write_report` | report: `pyrite-fees.csv` and `.html` (in `--lang`) | allow |
| `pyrite_draft_credit` | write: fee correction note listing each overcharge | ask |
| `pyrite_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `post_owner_credit`, `fee_setup_update`, `email_send` | refused | block |

## Limits

- Pyrite applies the agreement terms you enter; it does not read the signed agreements.
- Not legal or accounting advice.
