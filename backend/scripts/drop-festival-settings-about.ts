/**
 * Removes the `about` section from the festival settings document.
 *
 *   npx tsx scripts/drop-festival-settings-about.ts            # dry run, writes nothing
 *   npx tsx scripts/drop-festival-settings-about.ts --confirm  # writes
 *
 * THIS WRITES TO THE PRODUCTION DATABASE. The backend's MONGO_URI points at the
 * live cluster from every environment, local included (see AGENTS.md), so there
 * is no "safe" place to try this out. Hence the explicit flag.
 *
 * The Festival page's statement section — the one that carried "about" — was
 * cut, and the field went with it from the schema, the controller and the CMS
 * form. Mongoose in strict mode simply ignores a stored field it no longer
 * declares, so nothing breaks if this never runs; what is left behind is a
 * block of dead text in the document and, more to the point, a banner image
 * sitting in S3 that nothing will ever reference or delete again.
 *
 * So the banner is removed too, and only when the field is actually gone from
 * the document: the key is the one handle we have on that object, and dropping
 * the field first would leave the file unreachable and unbilled to anyone.
 *
 * Run this AFTER deploying the schema change, not before. A running instance of
 * the old code would rewrite `about` from its schema defaults on the next
 * settings save.
 *
 * Idempotent: a document with no `about` is left alone, so a re-run after a
 * partial failure is safe.
 */

import "dotenv/config";
import mongoose from "mongoose";

import FestivalSettings from "../models/festivalSettings.model.js";
import { deleteUploadedObject } from "../libs/s3.js";

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
    // Read straight off the collection, not through the model: the model no
    // longer declares `about`, so a model read would hand back a document with
    // the field already stripped and there would be nothing to report on.
    const documents = await FestivalSettings.collection
      .find({ about: { $exists: true } })
      .toArray();

    if (documents.length === 0) {
      console.log("No settings document carries an `about` field. Nothing to do.");
      return;
    }

    // Settings are a singleton, but the query is written for many: an extra
    // document is a bug worth seeing rather than one worth silently skipping.
    if (documents.length > 1) {
      console.warn(
        `${documents.length} settings documents found — expected one. All will be cleared.\n`,
      );
    }

    const imageKeys: string[] = [];

    for (const document of documents) {
      const about = (document.about ?? {}) as Record<string, unknown>;
      const body = Array.isArray(about.body) ? about.body : [];
      const stats = Array.isArray(about.stats) ? about.stats : [];
      const imageKey = String(about.imageKey ?? "").trim();

      console.log(`Settings ${String(document._id)}:`);
      console.log(`  eyebrow  ${String(about.eyebrow ?? "")}`);
      console.log(`  heading  ${String(about.heading ?? "")}`);
      console.log(`  body     ${body.length} paragraph(s)`);
      console.log(`  stats    ${stats.length}`);
      console.log(`  banner   ${imageKey || "(none uploaded)"}`);

      if (imageKey) imageKeys.push(imageKey);
    }

    if (!confirmed) {
      console.log("\nDry run — nothing written. Re-run with --confirm.");
      return;
    }

    const result = await FestivalSettings.collection.updateMany(
      { about: { $exists: true } },
      { $unset: { about: "" } },
    );
    console.log(`\nCleared \`about\` from ${result.modifiedCount} document(s).`);

    // After the unset, never before — same rule as the settings controller: a
    // failed cleanup must not leave the field pointing at a deleted object.
    // A key that is already gone reports false and is not an error.
    for (const key of imageKeys) {
      const deleted = await deleteUploadedObject(key);
      console.log(`  banner ${key}: ${deleted ? "deleted" : "not deleted"}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
