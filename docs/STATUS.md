# Status

Updated: 2026-09-15

Short by design — delete finished items rather than accumulating a changelog.
The public site's status lives in `../iffa-2026/docs/STATUS.md`; the AWS
blockers listed there affect this repo too.

**App Runner auto-deploys from `main`.** Verified 2026-09-15: a route merged
the previous day answered 401 rather than 404. Amplify does the same for the
client. They are not atomic, so a change spanning both wants two PRs with the
backend merged first — otherwise the UI can land against an API that has not
caught up, and writes silently no-op.

## Committed, not deployed

**Credit roles — the "Other Crew" vocabulary.** New `CreditRole` model and
`/credit-roles` CRUD (public GET, admin writes). Backend half of the review
queue / crew work; the client half is a separate PR and must merge *after*
this deploys.

```
curl <app-runner>/api/v1/credit-roles   # 404 now, want 200 + [] after deploy
```

Deliberately NOT the legacy `crewroles` collection — that one belongs to the
2022-2025 CrewAssignment system, nothing in the current crew editor reads it,
and its 90 entries carry typos, four spellings of Director of Photography, and
the Director/Producer/Actor credits the fixed dropdowns already cover.

`scripts/seed-credit-roles.ts` inserts 25 names taken verbatim from those 90
(the ones that are real roles, correctly spelled, not duplicates, and not a
director/producer/actor credit). Read-only without `--confirm`; idempotent and
case-insensitive, so a re-run is safe. **Not yet run** — the collection is
empty. Dry run verified 2026-09-16.


**Crew editing from the CMS.** Two stacked PRs: #22 (backend) and #23 (UI,
based on #22 so it cannot reach production first). Confirmed still pending:

```
curl -X POST <app-runner>/api/v1/uploads/presign/submission-crew   # 404 now, want 401 after deploy
```

The crew a filmmaker enters on the public form is stored on the submission
document, and nothing could edit it afterwards — `updateSubmission` whitelists
the fields it accepts and `crew` was not one, so it was dropped from every
update while the request still returned success. #22 accepts it (staff-only,
whole object: an omitted group is cleared) and adds
`POST /uploads/presign/submission-crew`, which takes a submission id and
resolves the S3 folder server-side rather than accepting a path. #23 turns the
read-only crew block on `/submissions/[id]/edit` into an editor and adds a
`CREW` action to each review-queue row.

Submissions with no `assetPrefix` (345 of 370 — they predate per-submission
folders or were bulk-imported) get one **minted on first CMS upload**, not by
backfill. Only records staff actually edit are touched.

**"Crew" is gone from the admin nav**, but `/admin/crew` and the
`CrewMember`/`CrewAssignment` collections are untouched. ~29 older films have
no embedded crew and render their director names from that directory through
the public API's `directors` fallback, and 12 nominations reference a
`crewMemberId`. Deleting that data is a separate decision, not yet taken.

**No crew photo has been uploaded through the new path.** All 25 stored
`assetPrefix` values pass the new guard, and crew round-trips through the model
with every field intact (checked with a direct query, not by reading the
schema) — but there are no AWS credentials outside App Runner, so nothing has
been written to S3. Do one photo replace in the CMS after deploying and check
the bucket.

**Neither screen has been opened in a browser.** Both need an authenticated CMS
session. Worth confirming a Drive-linked photo renders as a link chip and a
bucket photo renders as a thumbnail.

## Verified and live

Everything this file previously listed as "committed, not deployed" has in fact
shipped. Probed 2026-09-15:

| | |
|---|---|
| `GET /winners` | 401 — deployed (the Winners CMS page's gating endpoint) |
| `GET /podcasts` | 200 — deployed |
| `GET /festivals` | 200 — deployed |
| `PATCH /submissions/:id/restore` | 401 — deployed (the undo flows) |

**The festival year work is live and the data is safe.** Both festivals carry a
`year` (2026, 2027 — distinct) and the `year_1` unique index exists and built
cleanly, so the null-collision this file used to warn about can no longer
happen. `scripts/backfill-festival-year.ts` is spent; it is read-only without
`--confirm` if you want to re-check.

**Per-submission S3 folders are live.** Submissions from ~2026-08-28 carry an
`assetPrefix` and their crew photos sit under `<slug>-<8hex>/crews/`, serving
200 through CloudFront.

`{ createdAt: -1, _id: -1 }` sort on the public submissions endpoint.

## Know this before touching crew

Of 855 crew entries carrying a photo:

- **189** are in the proper `crews/` folder
- **71** are older flat uploads at `submissions-2026/<uuid>.webp`
- **594 are Google Drive share links** pasted into the public form, never
  uploaded
- 1 other

Any feature that assumes a crew photo is an S3 object will be wrong two thirds
of the time. They are also not direct image URLs, so they cannot be rendered in
an `<img>`.

There are also **two unrelated crew systems**: the grouped `crew` object on the
submission (what the public form writes, 2026 and most of 2024–25) and the
normalised `CrewMember`/`CrewRole`/`CrewAssignment` collections (1,182 / 90 /
1,516 docs, covering 2022–2025 only, **zero overlap with 2026**). The public
API returns both — `crewDirectors` from the first, `directors` from the second
— and `../iffa-2026` prefers the first, falling back to the second.

## Blocked on AWS console

See `../iffa-2026/docs/STATUS.md` — CloudFront `OPTIONS`, S3 CORS trailing
slash, IAM put/delete on `iffa-media-vault`.

Treat that list as unconfirmed rather than current: presigned uploads are
demonstrably working in production (189 crew photos landed between 2026-09-08
and 09-14), so the put path is fine. The `OPTIONS` and delete items have not
been retested.

## Never verified

CMS Partners page, Carousel page, and the Site Content nav dropdown have never
been visually checked — they need an authenticated CMS session.
