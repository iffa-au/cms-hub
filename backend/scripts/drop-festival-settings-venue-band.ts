/**
 * Removes the venue band's fields from the festival settings document.
 *
 *   npx tsx scripts/drop-festival-settings-venue-band.ts            # dry run, writes nothing
 *   npx tsx scripts/drop-festival-settings-venue-band.ts --confirm  # writes
 *
 * THIS WRITES TO THE PRODUCTION DATABASE. The backend's MONGO_URI points at the
 * live cluster from every environment, local included (see AGENTS.md), so there
 * is no "safe" place to try this out. Hence the explicit flag.
 *
 * The Festival page's venue band — a "plan your festival" heading, a line
 * naming the city, and the festival's venues in two columns — was cut, and
 * `venues`, `planTitle`, `planBody`, `city` and `country` went with it from the
 * schema, the controller and the CMS form. A venue is a property of a
 * screening, and every screening already carries its own; the festival-wide
 * list was the same fact kept in a second place.
 *
 * Mongoose in strict mode simply ignores a stored field it no longer declares,
 * so nothing breaks if this never runs — what is left behind is dead text in
 * the document. Unlike the `about` cleanup this script is modelled on, none of
 * these fields reference an uploaded object, so there is nothing in S3 to
 * collect afterwards.
 *
 * Run this AFTER deploying the schema change, not before. A running instance of
 * the old code would rewrite all five from its schema defaults on the next
 * settings save.
 *
 * Idempotent: a document carrying none of the fields is left alone, so a re-run
 * after a partial failure is safe.
 */

import "dotenv/config";
import mongoose from "mongoose";

import FestivalSettings from "../models/festivalSettings.model.js";

/** Every field the venue band read, and nothing the rest of the page needs. */
const FIELDS = ["venues", "planTitle", "planBody", "city", "country"] as const;

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
    const match = { $or: FIELDS.map((field) => ({ [field]: { $exists: true } })) };

    // Read straight off the collection, not through the model: the model no
    // longer declares these fields, so a model read would hand back a document
    // with them already stripped and there would be nothing to report on.
    const documents = await FestivalSettings.collection.find(match).toArray();

    if (documents.length === 0) {
      console.log("No settings document carries the venue band fields. Nothing to do.");
      return;
    }

    // Settings are a singleton, but the query is written for many: an extra
    // document is a bug worth seeing rather than one worth silently skipping.
    if (documents.length > 1) {
      console.warn(
        `${documents.length} settings documents found — expected one. All will be cleared.\n`,
      );
    }

    for (const document of documents) {
      const venues = Array.isArray(document.venues) ? document.venues : [];

      console.log(`Settings ${String(document._id)}:`);
      console.log(`  city       ${String(document.city ?? "")}`);
      console.log(`  country    ${String(document.country ?? "")}`);
      console.log(`  planTitle  ${String(document.planTitle ?? "")}`);
      console.log(`  planBody   ${String(document.planBody ?? "")}`);
      console.log(`  venues     ${venues.length}`);

      // Named one by one: these are the last readable copy of a list someone
      // typed in, and a count alone is not enough to reconstruct it from a log.
      for (const raw of venues) {
        const venue = (raw ?? {}) as Record<string, unknown>;
        const suburb = String(venue.suburb ?? "").trim();
        console.log(`    - ${String(venue.name ?? "")}${suburb ? ` (${suburb})` : ""}`);
      }
    }

    if (!confirmed) {
      console.log("\nDry run — nothing written. Re-run with --confirm.");
      return;
    }

    const result = await FestivalSettings.collection.updateMany(match, {
      $unset: Object.fromEntries(FIELDS.map((field) => [field, ""])),
    });
    console.log(`\nCleared the venue band fields from ${result.modifiedCount} document(s).`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
