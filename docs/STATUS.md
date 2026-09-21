# Status

Updated: 2026-09-18

Short by design — delete finished items rather than accumulating a changelog.
The public site's status lives in `../iffa-2026/docs/STATUS.md`; the AWS
blockers listed there affect this repo too.

**App Runner auto-deploys from `main`.** Verified 2026-09-15: a route merged
the previous day answered 401 rather than 404. Amplify does the same for the
client. They are not atomic, so a change spanning both wants two PRs with the
backend merged first — otherwise the UI can land against an API that has not
caught up, and writes silently no-op.

## Committed, not deployed

**Deletes now clean up after themselves.** Deleting a record removed it but
left everything pointing at it, so the row vanished from the CMS while its
references stayed in Mongo — which is what "deleted from the CMS but not the
database" turned out to mean. Backend #36 (merged); client #37.

`/admin/crew` used to discard every delete error in a bare `catch {}`, which
would have made the new 409 refusals look like a dead button. It now shows the
server's message — the count is the useful part — and confirms first, which
every other destructive action in the CMS already did.

- `deleteCrewRole` refuses with **409** when assignments still use the role,
  and says how many. **79 of 90 roles are in use**, so most can no longer be
  deleted without reassigning first — there is no UI for that yet.
- `deleteCrewMember` cascades their `CrewAssignment` rows, but refuses with 409
  if a nomination names them (12 of 1,182). Award history is not collateral.
- `deleteSubmission` now `$pull`s the film out of the `featuredfilms`
  singleton, and **fails closed**: the cascade runs first and a failure aborts
  the delete instead of logging and removing the submission anyway. That
  best-effort behaviour is what produced the existing orphans.

`scripts/audit-orphans.ts` reports the backlog. **Read-only — no `--confirm`,
no write path.** As of 2026-09-21:

```
crewassignments.crewRoleId    616      submissiongenres.submissionId  50
crewassignments.crewMemberId    6      nominations.*                   0
crewassignments.submissionId    6      featuredfilms                   0
                                            total 678
```

Nothing has been cleaned up. Deciding what to remove is a separate step.


**Featured film management (branch `featured`).** Site
content → Featured films (`/featured-films`) curates the homepage "Featured
Selection" row: up to 6 approved films, ordered, each with an optional badge,
highlighted title ending and short genre. Stored as one `FeaturedFilms`
singleton document, not as flags on submissions, so a save is a single write.
Routes: public `GET /featured-films`, staff `GET /featured-films/manage` and
`PUT /featured-films`. The public site's half is on `iffa-2026` branch
`featured`; merge and deploy this backend first.

**Not run against a database.** There's no local Mongo, and the local backend
reads production. The CMS page was checked in a browser against a mocked API.
After deploying, confirm `GET /featured-films` answers
`{"configured": false, "data": []}` before the first save.

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

## Crew email was public, and that has not been disclosed

`getSubmission` is public, returns the whole submission document, and denies
staff-only fields **by name** — so every crew field became public the moment it
was added to the model. Crew `email` was therefore readable by anyone holding a
film's id, for as long as crew has been stored.

Closed in #28: crew now goes through `publicCrew`, an allow-list of `fullName`,
`role` and `imageUrl` — all that `mapCrewGroup` on the synopsis page ever read.
`contactPhone` and `notes` were added behind that allow-list, so they were never
exposed.

The fix is live. **Whether the past exposure needs disclosing is still an open
decision** — recorded here because nobody has made it, not because it has been
judged unnecessary.

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
