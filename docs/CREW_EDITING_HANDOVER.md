# Crew editing in the CMS — handover

**Date:** 2026-09-15
**PRs:** #22 (backend), #24 (UI), #25 + #26 (follow-ups)

Written for whoever picks this up next. It covers what changed, the decisions
taken, and the two places the outcome differs from the original brief.

---

## The problem, restated

The brief was that "the crew member functionality isn't working" and that crew
should be editable from the submissions and review-queue pages rather than a
separate CMS section.

The underlying cause turned out to be that **there are two unrelated crew
systems in this codebase**, and the CMS was wired to the wrong one.

| | Where it lives | Coverage |
|---|---|---|
| **Embedded crew** | `submission.crew` — `{ directors, producers, actors, other }` on the submission document | What the public submit-film form writes. All of 2026, most of 2024–25 |
| **Normalised crew** | `CrewMember` + `CrewRole` + `CrewAssignment` collections | 1,182 / 90 / 1,516 docs, covering **2022–2025 only — zero overlap with 2026** |

The old CMS "Crew" section managed the second one. Open it against any 2026
film and it shows nothing, because that film's crew is in the first. The page
was not broken; it was pointed at the wrong data.

---

## What shipped

### Backend (#22)

- **`crew` is now accepted on `PUT /submissions/:id`.** It previously was not:
  `updateSubmission` whitelists the fields it accepts and `crew` was absent, so
  the field was silently dropped from every update while the request still
  returned success. There was no way to edit crew through the API at all.
- **New `POST /uploads/presign/submission-crew`** (staff only). Takes a
  submission **id**, never a path — the S3 folder is resolved server-side from
  the stored record.
- **`assetPrefix` is minted lazily**, on first upload for a submission that has
  none, and persisted.
- The crew normaliser was lifted to module scope and is now shared by the
  public create path and the CMS update path.

### UI (#24, #25, #26)

- A crew editor on `/submissions/[id]/edit`, replacing the old read-only
  "Proposed Crew" block. Add, edit and remove people across all four groups;
  upload or replace a photo per person.
- The same editor in a modal on `/review-queue`, behind a per-row `CREW` action,
  so a reviewer can fix credits without leaving the queue.
- **"Crew" removed from the admin nav.**
- `MANAGE CREW` on the submission detail screen repointed from the legacy
  assignment page to the new editor.

---

## Two places this differs from the brief

### 1. The legacy crew collections were NOT deleted

The brief said to eliminate the crew section. **Only the nav entry was
removed.** `/admin/crew`, `/crew/create` and `/submissions/[id]/crew` still work
if reached directly, and no data was touched.

Reason:

- The public API returns both `crewDirectors` (embedded) and `directors`
  (legacy), and the public site prefers the first and **falls back to the
  second**.
- **~29 films have no embedded crew at all** — mostly 2023 (14) and 2025 (13).
  Those are rendering their director names from the legacy directory right now.
  Deleting it drops their directors from the public site.
- **12 nominations reference a `crewMemberId`.**

Removing the collections is a reasonable end goal, but it needs those ~29 films
backfilled into embedded crew first. That is a separate piece of work and
deliberately was not started here.

### 2. The API groundwork was not already in place

The brief said controllers, routes and the model were already working, and that
GET/PUT/POST were implemented for S3.

Half of that held. The model was fine and the S3 helpers existed
(`createSubmissionAssetUpload`, `deleteUploadedObject`, prefix building). But
**`PUT /submissions/:id` did not accept `crew`**, and there was no staff-facing
presign endpoint — the only one was the public, unauthenticated route the
submit-film form uses. Both had to be built, which is most of #22.

---

## Data worth knowing before touching this again

**Most crew photos are not in S3.** Of 855 crew entries that carry a photo:

| | |
|---|---|
| In the proper `crews/` folder | **189** |
| Older flat uploads at `submissions-2026/<uuid>.webp` | 71 |
| **Google Drive share links** | **594** |
| Other | 1 |

About two thirds are Drive links pasted into the public form rather than
uploaded. They are not direct image URLs, so they cannot be rendered in an
`<img>` — the editor shows them as a link chip instead, and replacing one
uploads a real file to the bucket. Any future feature that assumes a crew photo
is an S3 object will be wrong two thirds of the time.

**Most submissions have no S3 folder.** Only 25 of 370 carry an `assetPrefix`;
the rest predate per-submission folders or were bulk-imported. Rather than
backfilling ~316 records, one is minted on first CMS upload, so only records
staff actually edit get written to.

**Other decisions taken:**

- Crew editing is **staff/admin only**, even though `PUT /submissions/:id`
  otherwise allows the owner. Crew is curated after submission; a submitter
  should not be able to overwrite credits a reviewer has corrected.
- The editor **always posts all four groups together**, because the API
  replaces `crew` wholesale. A partial payload would clear whatever it omitted.
- The staff upload path accepts **png and jpeg as well as webp**. Staff work
  from whatever a distributor sent and have no in-browser converter. The public
  form stays webp-only.
- Upload keys reuse the public form's `{role}-{name}-{index}` convention, so
  replacing a photo **overwrites the existing object** rather than orphaning it.
  That is why no S3 delete path was added.
- `expand=crew` is deliberately avoided when loading. That flag makes the
  overview endpoint swap the grouped crew object for the legacy assignment
  array.

---

## Status and loose ends

**Deployed:** #22, #24 and #25 are on `main` and live. App Runner auto-deploys
from `main`, as does Amplify — they are not atomic, which is why backend and UI
went out as separate PRs with the backend first.

**#26 is open and should be merged promptly.** It fixes a bug where the editor
discarded crew that arrived after first render — a film with 12 crew showed "0
people", and saving after adding someone would have deleted the rest. It missed
#25's merge by seconds.

**The photo upload has never actually run.** Key construction, validation and
the prefix guard are all tested, and the crew save is verified end to end
against the database. But no file has ever been written to S3 through the new
endpoint — there are no AWS credentials outside App Runner, so it could not be
exercised locally. **Someone should replace one crew photo in the CMS and
confirm the file lands in the bucket.** Until that happens, treat the upload
path as unverified.

**There is a test record in the database:**
`6aa9279c136b072d6e205df9`, titled `ZZZ TEST - crew editor (safe to delete)`.
Status `SUBMITTED`, so it cannot appear on the public site, but it does show in
the review queue. It exists to test the upload path without risking a real
film's data. Delete it once that test is done.

**Also open:** a gap in `assertDeletableFestivalPrefix` in `backend/libs/s3.ts`
lets a `..` segment through. Unrelated to crew, but it guards a bulk-delete
path, so it is worth closing. The equivalent guard added for submissions
(`assertSubmissionAssetPrefix`) shows the fix — allowlist the charset `slugify`
emits instead of blacklisting separators.
