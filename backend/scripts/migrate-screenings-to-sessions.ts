/**
 * Restructures embedded screenings from "a screening IS a film" to
 * "a screening is a session that HOLDS films".
 *
 *   npx tsx scripts/migrate-screenings-to-sessions.ts            # dry run, writes nothing
 *   npx tsx scripts/migrate-screenings-to-sessions.ts --confirm  # writes
 *
 * THIS WRITES TO THE PRODUCTION DATABASE. The backend's MONGO_URI points at the
 * live cluster from every environment, local included (see AGENTS.md), so there
 * is no "safe" place to try this out. Hence the explicit flag.
 *
 * RUN THIS BEFORE DEPLOYING the session restructure. The new schema requires
 * `startDate` on every screening and stores films in `films[]`; an old document
 * has `date` and no `films`, so until it is converted the CMS cannot save a
 * festival without first re-typing its whole programme.
 *
 * (The public site does not need this to have run — `festival-api.ts` reads an
 * old row as a session of one. That tolerance is what makes the deploy order
 * free; this script is what makes the CMS editable again.)
 *
 * Each old row becomes a session of exactly one film, carrying the same title.
 * Same-date rows are NOT merged: they had their own times and venues, so
 * merging the 7:30 in the Main Theatre with the 8:00 in Cinema Two would lose
 * both. Staff can combine them in the CMS afterwards, which is a judgement
 * call about programming and not one a script should make.
 *
 * Idempotent: a screening that already has a `films` array is left alone, so a
 * re-run after a partial failure only touches what is still in the old shape.
 */

import "dotenv/config";
import mongoose from "mongoose";

import Festival from "../models/festival.model.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type OldScreening = {
  _id?: unknown;
  title?: string;
  posterUrl?: string;
  posterKey?: string;
  country?: string;
  year?: number;
  genre?: string;
  runtimeMinutes?: number;
  synopsis?: string;
  trailerUrl?: string;
  date?: string;
  time?: string;
  venue?: string;
  seatStatus?: string;
  /** Present only on an already-migrated row. */
  films?: unknown[];
  startDate?: string;
};

const convert = (old: OldScreening) => ({
  _id: old._id,
  title: String(old.title ?? "").trim(),
  description: "",
  startDate: String(old.date ?? "").trim(),
  endDate: String(old.date ?? "").trim(),
  time: String(old.time ?? "").trim(),
  venue: String(old.venue ?? "").trim(),
  seatStatus: old.seatStatus ?? "available",
  films: [
    {
      title: String(old.title ?? "").trim(),
      posterUrl: String(old.posterUrl ?? "").trim(),
      // Carried across deliberately: this key is what the cascade delete walks
      // to decide a poster is ours to remove. Dropping it here would orphan
      // every uploaded poster in S3 on the next save.
      posterKey: String(old.posterKey ?? "").trim(),
      country: String(old.country ?? "").trim(),
      year: Number(old.year) || 0,
      genre: String(old.genre ?? "").trim(),
      runtimeMinutes: Number(old.runtimeMinutes) || 0,
      synopsis: String(old.synopsis ?? "").trim(),
      trailerUrl: String(old.trailerUrl ?? "").trim(),
    },
  ],
});

async function main() {
  const confirmed = process.argv.includes("--confirm");
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("MONGO_URI is not set. Nothing to connect to.");
    process.exit(1);
  }

  // Enough of the host to recognise which cluster this is, without printing
  // credentials into a terminal or a CI log.
  const host = uri.replace(/^mongodb(\+srv)?:\/\/[^@]*@/, "").split("/")[0];
  console.log(`Target database host: ${host}`);
  console.log(confirmed ? "Mode: WRITING\n" : "Mode: dry run (pass --confirm to write)\n");

  await mongoose.connect(uri);

  try {
    // Read straight off the collection rather than through the model: the
    // model's schema now requires `startDate` on every screening, and these
    // are exactly the documents that do not have one yet.
    const festivals = await Festival.collection
      .find({}, { projection: { slug: 1, name: 1, screenings: 1 } })
      .toArray();

    if (festivals.length === 0) {
      console.log("No festivals in the collection. Nothing to do.");
      return;
    }

    let converted = 0;
    let skipped = 0;
    let blocked = 0;

    for (const festival of festivals) {
      const screenings = (festival.screenings ?? []) as OldScreening[];
      if (screenings.length === 0) {
        console.log(`- ${festival.slug}: no screenings, nothing to do`);
        continue;
      }

      // Already in the new shape. Checked per row rather than per festival so
      // a half-finished previous run resumes cleanly.
      const stale = screenings.filter((row) => !Array.isArray(row.films));
      if (stale.length === 0) {
        console.log(`- ${festival.slug}: already migrated (${screenings.length})`);
        skipped += screenings.length;
        continue;
      }

      // A row with no usable date cannot become a session: `startDate` is
      // required and there is nothing honest to infer it from. Reported and
      // left untouched rather than guessed at.
      const undated = stale.filter((row) => !ISO_DATE.test(String(row.date ?? "").trim()));
      if (undated.length > 0) {
        blocked += undated.length;
        console.warn(
          `! ${festival.slug}: ${undated.length} screening(s) have no valid date — ` +
            `left as they are: ${undated.map((r) => r.title ?? "(untitled)").join(", ")}`,
        );
      }

      const next = screenings.map((row) =>
        Array.isArray(row.films) || !ISO_DATE.test(String(row.date ?? "").trim())
          ? row
          : convert(row),
      );

      const changing = stale.length - undated.length;
      if (changing === 0) continue;

      console.log(`- ${festival.slug}: converting ${changing} screening(s) to sessions`);
      converted += changing;

      if (confirmed) {
        await Festival.collection.updateOne(
          { _id: festival._id },
          { $set: { screenings: next } },
        );
      }
    }

    console.log(
      `\n${confirmed ? "Converted" : "Would convert"} ${converted} screening(s). ` +
        `${skipped} already migrated. ${blocked} left alone (no valid date).`,
    );
    if (!confirmed && converted > 0) {
      console.log("Re-run with --confirm to write.");
    }
    if (blocked > 0) {
      console.log(
        "The undated rows need a date set in the CMS before they can be programmed.",
      );
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
