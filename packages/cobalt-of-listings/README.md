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

## Tools

| Tool | Kind | Policy |
|---|---|---|
| `cobalt_check`, `cobalt_explain` | read | allow |
| `cobalt_write_report` | report: `cobalt-listings.csv` and `.html` (in `--lang`) | allow |
| `cobalt_draft_correction` | write: corrections for one unit, for your leasing or marketing contact or vendor | ask |
| `cobalt_request_send` | one click (`binding_send`), tied to the draft's sha256 | ask, even in Auto |
| `publish_listing`, `change_asking_rent`, `reply_to_prospect`, `email_send` | refused | block |

Local headers such as Référence annonce, Loyer, Disponible le, Verfügbar ab, Disponible desde or 入居可能日 are read. Ambiguous dates under French, Spanish, German, Portuguese or Italian headers are read day-first, with a warning.

## Limits

- Cobalt compares your listings export with your rent roll. It does not visit listing sites, so a listing missing from the export is invisible to it.
- Not legal advice. Wording findings are prompts for a person's review.
