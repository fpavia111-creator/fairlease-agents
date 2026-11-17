# Mica of Leads (`mica-of-leads`)

For leasing managers. It reads guest cards and lead exports and shows where prospects are slipping: leads with no response or a late first response, follow-ups that are due, approved applicants with no signed lease, stale open leads, duplicates, and lost leads with no reason. It also builds a table by source (each person counted once): response on time, tours, applications, leases, lead-to-lease rate, and cost per lease when you give it your spend. It drafts follow-ups for a person to send. It never screens, approves or denies an applicant and never contacts anyone.

MIT · Node 20 or newer · local files only · no credentials · built on [`keystone-core`](../keystone-core)

```bash
npx -y mica-of-leads demo
npx -y mica-of-leads mcp --root ./leasing
```

## What it checks

| Finding | Meaning |
|---|---|
| `no_response`, `slow_response` | No first response after `respond_within_days` (default 1), or a first response later than that |
| `follow_up_due` | Open lead with no step for `follow_up_days` (default 3) |
| `approved_not_leased` | Approved more than `approved_days` (default 7) ago with no lease signed |
| `stale_open` | Open longer than `stale_days` (default 30) |
| `duplicate` | Same email, phone or name as an earlier lead within `duplicate_days` (default 30); set aside in the source table |
| `lost_reason_missing`, `dates_out_of_order` | Closed as lost with no reason; a tour, application or lease dated before the lead came in |

The report adds a **By source** table and the **Lost reasons** tally. Sources with spend and no leads are listed too. Dates are whole days, because most exports carry dates without times.

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `mica_check`, `mica_explain` | read | allow |
| `mica_write_report` | report: `mica-leads.csv` and `.html` (in `--lang`), with the source table | allow |
| `mica_draft_followup` | write: a short follow-up suited to the prospect's stage | ask |
| `mica_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `mica_recall`, `mica_learn` | domain memory: another name for a lead source (`source_alias`) | allow (learning only proposes) |
| `mica_accept_learning`, `mica_retire_memory` | action, `accept_learning` | one named click, even in Auto |
| `decide_application`, `run_screening`, `text_prospect`, `email_send` | refused | block |

AppFolio guest cards are recognised; local headers such as Interesado, Origen, Fecha de contacto, Anfragedatum, Date de demande or 問合せ日 are read.

## Limits

- Mica sees only what was logged in the export. Calls, texts and emails that nobody logged look like no response.
- It never sees or judges anything about who a prospect is. Screening decisions follow your written criteria and are made by people.
