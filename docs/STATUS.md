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

**Credit roles — the "Other Crew" vocabulary, client half.** The backend (#30)
is live and seeded; the client is not. Its original PR (#31) was merged into
`feat/credit-roles` rather than `main` — a branch already merged and no longer
built from — so the UI work never reached anyone. Re-applied onto current
`main` on top of the responsive refactor (#32), which had rewritten every file
involved.

Drops the `CREW` action from the review queue. That modal loaded crew from the
*public* `GET /submissions/:id`, whose projection strips biography, instagram,
email, phone and notes — and the editor saves all four groups wholesale, so
any edit there overwrote those five fields with empty strings. The edit page's
error fallback read the same route and now refuses to edit rather than loading
a reduced copy.

Credited role is a dropdown: fixed sets for directors, producers and cast;
`/credit-roles` for Other Crew. A stored role no list contains stays selected
and is labelled "as submitted" — most existing crew was typed freehand on the
public form, so `Director/Writer` and `DOP` are common and must survive a save
untouched.

**Not opened in a browser.** Needs an authenticated CMS session. Worth
confirming the crew thumbnails on `/submissions/[id]/view`, the four dropdowns,
and Metadata → Crew Roles.


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
