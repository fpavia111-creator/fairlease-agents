# Jasper of Deposits (`jasper-of-deposits`)

Checks every move-out security deposit against **your own** rules before the statement goes out: the return deadline, each deduction and its support, useful-life proration for replaced items, possible normal wear and tear, the unpaid balance and the refund. Then it drafts the itemised statement for a person to send. It never pays a refund, posts a charge or sends anyone to collections.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y jasper-of-deposits demo
npx -y jasper-of-deposits mcp --root ./move-outs
```

## What it checks

| Finding | Meaning |
|---|---|
| `deadline_passed`, `deadline_soon` | Move-out date plus your `return_days`, against `as_of` |
| `returned_late`, `refund_differs` | A statement already sent late, or for a different amount |
| `possible_normal_wear` | A deduction matches your wear words (nail holes, touch-up, full repaint, …); a person decides |
| `no_evidence` | No photo, invoice or receipt reference (when `require_evidence` is on, the default) |
| `useful_life_proration` | A replacement charged at its age: amount × (1 − age ÷ useful life) |
| `unpaid_balance`, `tenant_owes` | From the final ledger; deductions above the deposit |
| `deposit_mismatch`, `deposit_unknown`, `no_forwarding_address` | Data to fix before a statement can go |

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `jasper_check`, `jasper_explain` | read | allow |
| `jasper_write_report` | report: `jasper-deposits.csv` and `.html` (in `--lang`) | allow |
| `jasper_draft_statement` | write: the itemised statement; wear-and-tear lines and missing support are `[TO CONFIRM]` | ask |
| `jasper_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `issue_refund`, `post_tenant_charge`, `send_to_collections`, `email_send` | refused | block |

## Files it reads

- **Move-outs** (`move_outs` schema): `rules.return_days` is required and has no default, because the deadline is set by your law or policy. Optional `interest_pct`, `deduct_unpaid_balance`, `require_evidence`, `due_soon_days`, `wear_words`. Each move-out: unit, date, deposit held, move-in, forwarding address, and `returned_on` / `returned_amount` once sent.
- **Deductions**: unit, item, category, amount, optional age and useful life in years, and a support reference. Local headers are read (Einheit, Position, Betrag, Belege; Unidad, Concepto, Importe; 項目, 金額 …).
- **Leases** and a **final ledger** are optional.

## Limits

- Deadlines, interest and wear-and-tear rules differ by place. Jasper applies the rules file you write; it does not know the law.
- Not legal advice. A person decides every deduction and pays the refund.
