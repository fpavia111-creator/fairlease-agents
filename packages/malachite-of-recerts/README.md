# Malachite of Recerts (`malachite-of-recerts`)

For affordable housing managers (HUD, LIHTC, HOME, public housing and similar programs). It tracks every household's recertification **dates** against the schedule in your policy file: when each is due, the reminder notices your policy sends before that (for example at 120, 90 and 60 days), whether they are recorded and on time, who is overdue or due soon, and which occupied units are missing from the tracker. It writes a calendar and drafts reminders. It never reads income, decides eligibility, changes rent or submits anything to an agency.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y malachite-of-recerts demo
npx -y malachite-of-recerts mcp --root ./recerts
```

## What it checks

| Finding | Meaning |
|---|---|
| `overdue`, `due_soon`, `in_window` | Past the due date; within `due_soon_days` (default 30); inside the window your program starts work (`start_days_before`) |
| `notice_missing`, `notice_late` | A notice your policy sends N days before the due date is not recorded for this cycle, or went after that date |
| `due_date_differs` | The tracker's next due date is more than a month away from last certification plus the program frequency |
| `last_cert_missing`, `due_from_move_in`, `due_unknown` | No last certification; due date taken from the move-in anniversary (confirm it); no date to place it at all |
| `program_unknown` | The program is not in your policy file, so no schedule applies |
| `not_tracked`, `not_in_rent_roll`, `name_differs` | With a rent roll: an occupied unit missing from the tracker (list market-rate units in `market_units`), a tracked unit that is vacant, or a different name in the unit |

Notices dated before the last certification belong to the previous cycle and do not count. Yardi and OneSite style headers (Effective Date, Next AR Due, 120-Day Notice …) and local headers such as 世帯, 前回申告日, 次回申告期限 are read.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `malachite_check`, `malachite_explain` | read | allow |
| `malachite_write_report` | report: `malachite-recerts.csv` and `.html` (in `--lang`) | allow |
| `malachite_calendar` | report: `malachite-calendar.ics` with notice and due dates, plus `.csv`/`.html` | allow |
| `malachite_draft_reminder` | write: a reminder with the due date and the documents listed in your policy | ask |
| `malachite_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `certify_household`, `submit_to_agency`, `change_rent`, `email_send` | refused | block |

## Limits

- Malachite repeats the schedule in your policy file. It does not know any program's rules; your compliance staff, the agency and the program documents do.
- It never sees income, assets or household composition, and it never decides eligibility or rent.
