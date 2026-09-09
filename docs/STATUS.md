# Status

Updated: 2026-09-04

Short by design — delete finished items rather than accumulating a changelog.
The public site's status lives in `../iffa-2026/docs/STATUS.md`; the AWS
blockers listed there affect this repo too.

## Committed, not deployed

**One festival a year.** `festival.model.ts` gains `year` — derived from
`startDate`, never accepted from the client, and carrying a **unique index**.
`festival.controller.ts` recomputes it on every write and returns a 409 naming
the festival already holding that year. Public and staff lists now sort newest
first. The CMS is keyed by year: the list groups by it, "New festival" opens on
the next free year, and the coming-soon months editor is gone (the field stays
on the settings schema so no document needs migrating; nothing reads it).

**RUN THE BACKFILL BEFORE APP RUNNER REDEPLOYS:**

```bash
cd backend
npx tsx scripts/backfill-festival-year.ts            # dry run, writes nothing
npx tsx scripts/backfill-festival-year.ts --confirm  # writes
```

Mongo counts a missing field as null, so two festivals without `year` collide
on the unique index — deploying the model first fails the index build on boot
and every write after it errors. Not yet run in any environment; the dry run is
read-only and also reports any year already holding two festivals, which it
refuses to write through.

Also in the same batch, all undeployed:

- `edition` removed from `festival.model.ts`, the controller and the CMS editor.
  One festival a year makes a position-within-the-year meaningless. Existing
  documents keep the stored value; nothing reads it.
- `about.imageUrl` / `about.imageKey` added to `festivalSettings.model.ts` and
  handled in `updateFestivalSettings`, including orphan cleanup on replace. The
  CMS settings page uploads it through the existing `festival-page` presign.
- The CMS festivals page is now a **year calendar**, not a list. There is no
  free-form "new festival" button — it could only ever produce a second
  festival in a year that already has one, which the API refuses. Years are
  created by opening the empty year you want.

The public site's matching redesign is in `../iffa-2026` on `page/festivals`.


**Podcast is entirely new and entirely undeployed.** Backend: `podcast.model.ts`,
`podcast.controller.ts`, `routes/podcast.ts`, and the `/podcasts` mount in
`routes/index.ts`. Until App Runner redeploys, every podcast route 404s and the
public site's `/podcast` page shows its "No podcasts yet" state — which is the
correct-looking failure, so check the endpoint rather than the page:

```
curl <app-runner>/api/v1/podcasts   # want {"success":true,"data":[]}
```

The CMS pages (`client/src/app/podcasts/`) and the public pages in
`../iffa-2026` are both ready and waiting on that deploy. No podcast has been
created yet, in any environment — the collection does not exist.

The featured episode is `isFeatured` on the podcast document, kept exclusive by
`clearOtherFeatured` in the controller — setting it on one clears it on the
rest, so "featured" is always exactly one or none. With none set, the public
page falls back to the newest `publishedAt`. A featured *draft* loses to that
fallback, because the public endpoint never returns drafts; the CMS editor warns
about that combination rather than letting it look broken on the site.

App Runner has also **not** picked up the per-submission S3 folder work:

- `libs/s3.ts` — `buildSubmissionAssetPrefix`, `createSubmissionAssetUpload`
- `controllers/upload.controller.ts` — presign now requires `submissionRef`,
  `group`, `name` and rejects malformed input
- `models/submission.model.ts` — `assetPrefix`
- `controllers/submission.controller.ts` — recomputes `assetPrefix` server-side

The frontend already sends these fields. Until this deploys, the live backend
ignores them and uploads keep landing in the flat `submissions-2026/` folder.

**No real upload has been run through the new path.** Presigning was tested
with dummy credentials, which exercises validation and key construction but
never touches S3. Do one test submission after deploying and check the bucket.

## Verified and live

`{ createdAt: -1, _id: -1 }` sort on the public submissions endpoint is
deployed — the API returns newest-first.

## Blocked on AWS console

See `../iffa-2026/docs/STATUS.md` — CloudFront `OPTIONS`, S3 CORS trailing
slash, IAM put/delete on `iffa-media-vault`.

## Never verified

CMS Partners page, Carousel page, and the Site Content nav dropdown have never
been visually checked — they need an authenticated CMS session.
