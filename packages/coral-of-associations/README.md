# Coral of Associations (`coral-of-associations`)

For community association managers (HOAs, condominiums, owners' communities). It checks every owner account against **your** assessment and collection policy, and every violation case against **your** notice, cure and hearing steps. It drafts statement-of-account reminders and violation notices. It never posts a fine or charge, records a lien or sends anything.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y coral-of-associations demo
npx -y coral-of-associations mcp --root ./association
```

## What it checks

Owner accounts (from the owner ledger):

| Finding | Meaning |
|---|---|
| `missing_assessment`, `wrong_amount` | A period with no assessment, or one that differs from the policy (per-unit amounts supported) |
| `late_fee_missing`, `late_fee_not_due`, `late_fee_amount` | Paid after the grace period with no late fee; a late fee when the assessment was on time; a fee that differs from the policy |
| `balance_differs` | The ledger's own balance column does not equal its charges less payments |
| `past_due` | Amount past the grace period, days since the oldest unpaid charge, and the step your `collection_steps` name at that age (and the next one) |
| `credit_balance` (note) | Paid ahead or overpaid |

Payments are applied oldest charge first. Assessment and late fee lines are recognised by words in many languages (Assessment, HOA dues, Hausgeld, cuota de comunidad, spese condominiali, 管理費, 物业费, 관리비 …); set `assessment.words` or `late_fee.words` to use your own.

Violations (from the violations log): `first_notice_late`, `second_notice_due` (cure period over with no follow-up), `fine_without_hearing` (when your policy holds a hearing before a fine), `stale`, `repeat` (same rule at the same unit within `repeat_days`), `dates_out_of_order`.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `coral_check`, `coral_explain` | read | allow |
| `coral_write_report` | report: `coral-association.csv` and `.html` (in `--lang`) | allow |
| `coral_draft_notice` | write: a payment reminder for a past-due account, or a violation notice for an open case | ask |
| `coral_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `record_lien`, `post_fine`, `post_owner_charge`, `email_send` | refused | block |

Policy file (`association_policy` schema): `assessment` (`amount`, `per_unit`, `frequency`, `due_day`), `periods_from`, `grace_days`, `late_fee` (`flat`, `pct`), `collection_steps` (`days`, `step`), `violations` (`notice_within_days`, `cure_days`, `hearing_before_fine`, `stale_days`, `repeat_days`). Local headers such as Propietario, Vivienda, Concepto, Cargo, Abono, Eigentümer or Soll/Haben are read.

## Limits

- Coral repeats the steps your policy file names. It does not read governing documents or decide whether a fee, fine or collection step is allowed where you are.
- Not legal advice. Collection and enforcement decisions belong to the board and its advisers.
