/**
 * Fills in `year` on festivals created before the field existed, and reports
 * any year that ended up with more than one.
 *
 *   npx tsx scripts/backfill-festival-year.ts            # dry run, writes nothing
 *   npx tsx scripts/backfill-festival-year.ts --confirm  # writes
 *
 * THIS WRITES TO THE PRODUCTION DATABASE. The backend's MONGO_URI points at the
 * live cluster from every environment, local included (see AGENTS.md), so there
 * is no "safe" place to try this out. Hence the explicit flag.
 *
 * RUN THIS BEFORE DEPLOYING the one-festival-a-year change. `year` carries a
 * unique index, and Mongo treats a missing field as null: two festivals with no
 * `year` are two nulls, which collide. With the index already declared on the
 * model, that means the index build fails on boot and every write after it
 * errors — so the backfill has to land first.
 *
 * The year is taken from `startDate`, which is the only place it has ever
 * really lived. A festival that straddles New Year belongs to the year it opens
 * in, which is also how it is billed.
 *
 * Idempotent: a festival that already has the right year is left alone, so a
 * re-run after a partial failure only touches what is still missing.
 */

import "dotenv/config";
import mongoose from "mongoose";

import Festival from "../models/festival.model.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
    // model's schema now requires `year`, and these are exactly the documents
    // that do not have one yet.
    const festivals = await Festival.collection
      .find({}, { projection: { slug: 1, name: 1, startDate: 1, year: 1 } })
      .toArray();

    if (festivals.length === 0) {
      console.log("No festivals in the collection. Nothing to do.");
      return;
    }

    const updates: { id: unknown; slug: string; year: number }[] = [];
    const unusable: string[] = [];
    const byYear = new Map<number, string[]>();

    for (const festival of festivals) {
      const startDate = String(festival.startDate ?? "");
      if (!ISO_DATE.test(startDate)) {
        unusable.push(`${festival.slug} (startDate "${startDate}")`);
        continue;
      }

      const year = Number(startDate.slice(0, 4));
      const names = byYear.get(year);
      if (names) names.push(String(festival.slug));
      else byYear.set(year, [String(festival.slug)]);

      if (festival.year === year) continue;
      updates.push({ id: festival._id, slug: String(festival.slug), year });
    }

    // Reported before anything is written: the unique index cannot be built
    // while a year holds two festivals, and which one to drop or move is an
    // editorial decision, not something a script should make.
    const clashes = [...byYear.entries()].filter(([, slugs]) => slugs.length > 1);
    if (clashes.length > 0) {
      console.error("BLOCKED — these years hold more than one festival:\n");
      for (const [year, slugs] of clashes) {
        console.error(`  ${year}: ${slugs.join(", ")}`);
      }
      console.error(
        "\nOne festival a year is now enforced by a unique index. Move or delete\n" +
          "the extras in the CMS, then run this again.",
      );
      process.exitCode = 1;
      return;
    }

    if (unusable.length > 0) {
      console.warn(`Skipping ${unusable.length} festival(s) with no usable start date:`);
      for (const entry of unusable) console.warn(`  ${entry}`);
      console.warn("");
    }

    if (updates.length === 0) {
      console.log(`All ${festivals.length} festival(s) already carry the right year.`);
    } else {
      console.log(`${updates.length} festival(s) to update:`);
      for (const update of updates) console.log(`  ${update.slug} -> ${update.year}`);

      if (confirmed) {
        for (const update of updates) {
          await Festival.collection.updateOne(
            { _id: update.id as never },
            { $set: { year: update.year } },
          );
        }
        console.log(`\nDone. ${updates.length} festival(s) updated.`);
      } else {
        console.log("\nDry run — nothing written. Re-run with --confirm.");
      }
    }

    if (confirmed) {
      // Built explicitly rather than left to autoIndex on the next boot, so a
      // failure surfaces here, next to the data that caused it.
      await Festival.collection.createIndex({ year: 1 }, { unique: true });
      console.log("Unique index on `year` is in place.");
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
