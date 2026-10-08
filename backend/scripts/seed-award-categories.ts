/**
 * Opens the award categories offered on the public submission form.
 *
 *   npx tsx scripts/seed-award-categories.ts            # dry run, writes nothing
 *   npx tsx scripts/seed-award-categories.ts --confirm  # writes
 *
 * THIS WRITES TO THE PRODUCTION DATABASE. The backend's MONGO_URI points at
 * the live cluster from every environment, local included (see AGENTS.md), so
 * there is no "safe" place to try this out. Hence the explicit flag.
 *
 * Matches existing categories by name, case-insensitively, and only sets the
 * submission-form fields on them — name and description are left alone, and
 * the category ids that past nominations and winners point at are kept. A
 * name with no match is inserted. Idempotent: a second run changes nothing.
 *
 * Every category NOT listed here is left as it is, which for anything never
 * opened means closed. "Best Animation" is deliberately absent: it duplicated
 * "Best Animated Film" and the two were merged into the latter.
 *
 * `formats` names content types; empty means every screen format. Actor
 * categories are unrestricted on purpose — the form already hides them for
 * formats without a cast, and the server rejects them anyway when the crew
 * has no actors to nominate.
 */

import "dotenv/config";
import mongoose from "mongoose";

import AwardCategory, { type NomineeType } from "../models/awardCategory.model.js";
import ContentType from "../models/contentType.model.js";

type Seed = {
  name: string;
  group: string;
  nomineeType: NomineeType;
  formats: string[];
};

const SEED: Seed[] = [
  { name: "Best Actor in a Leading Role", group: "Actor / Actress", nomineeType: "actors", formats: [] },
  { name: "Best Actor in a Supporting Role", group: "Actor / Actress", nomineeType: "actors", formats: [] },
  { name: "Best Actor in a Negative Role", group: "Actor / Actress", nomineeType: "actors", formats: [] },
  { name: "Best Actress in a Leading Role", group: "Actor / Actress", nomineeType: "actors", formats: [] },
  { name: "Best Actress in a Supporting Role", group: "Actor / Actress", nomineeType: "actors", formats: [] },
  { name: "Best Debut Actor", group: "Actor / Actress", nomineeType: "actors", formats: [] },
  { name: "Best Debut Actress", group: "Actor / Actress", nomineeType: "actors", formats: [] },

  { name: "Best Cinematography", group: "Craft", nomineeType: "craft", formats: [] },
  { name: "Best Direction", group: "Craft", nomineeType: "directors", formats: [] },
  { name: "Best Editor", group: "Craft", nomineeType: "craft", formats: [] },
  { name: "Best Screenplay Writing", group: "Craft", nomineeType: "craft", formats: [] },

  { name: "Best International Feature Film", group: "Producer", nomineeType: "producers", formats: ["Feature Film"] },
  { name: "Best International Short Film", group: "Producer", nomineeType: "producers", formats: ["Short Film", "Under 18 Film"] },

  { name: "Best Animated Film", group: "Whole Team", nomineeType: "whole-team", formats: ["Animation"] },
  { name: "Best Original Web Series", group: "Whole Team", nomineeType: "whole-team", formats: ["Web Series (OTT)"] },
  { name: "Best TV Series", group: "Whole Team", nomineeType: "whole-team", formats: ["TV Series"] },
  // "Documentry" is the content type's stored spelling.
  { name: "Best Documentary Film", group: "Whole Team", nomineeType: "whole-team", formats: ["Documentry"] },
];

async function main() {
  const confirmed = process.argv.includes("--confirm");
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("MONGO_URI is not set. Nothing to connect to.");
    process.exit(1);
  }

  if (new Set(SEED.map((s) => s.name.toLowerCase())).size !== SEED.length) {
    console.error("SEED contains a duplicate. Fix the script.");
    process.exit(1);
  }

  const host = uri.replace(/^mongodb(\+srv)?:\/\/[^@]*@/, "").split("/")[0];
  console.log(`Target database host: ${host}`);
  console.log(`Seed list: ${SEED.length} categor(ies)`);
  console.log(confirmed ? "Mode: WRITING\n" : "Mode: dry run (pass --confirm to write)\n");

  await mongoose.connect(uri);

  try {
    const contentTypes = await ContentType.find({}, { name: 1 }).lean();
    const contentTypeId = new Map(
      contentTypes.map((ct: any) => [String(ct.name).toLowerCase(), ct._id]),
    );
    const missingFormats = [...new Set(SEED.flatMap((s) => s.formats))].filter(
      (f) => !contentTypeId.has(f.toLowerCase()),
    );
    if (missingFormats.length > 0) {
      console.error(`Unknown content type(s): ${missingFormats.join(", ")}. Nothing written.`);
      process.exit(1);
    }

    const existing = await AwardCategory.find({}, { name: 1 }).lean();
    const existingByName = new Map(
      existing.map((c: any) => [String(c.name).toLowerCase(), c]),
    );

    const updates: Array<{ id: unknown; name: string; fields: Record<string, unknown> }> = [];
    const inserts: Array<Record<string, unknown>> = [];

    for (const [index, seed] of SEED.entries()) {
      const fields = {
        openForSubmission: true,
        group: seed.group,
        nomineeType: seed.nomineeType,
        contentTypeIds: seed.formats.map((f) => contentTypeId.get(f.toLowerCase())),
        sortOrder: (index + 1) * 10,
      };
      const match = existingByName.get(seed.name.toLowerCase());
      if (match) updates.push({ id: match._id, name: String(match.name), fields });
      else inserts.push({ name: seed.name, description: "", ...fields });
    }

    console.log(`Collection currently holds ${existing.length} categor(ies).`);
    console.log(`\nExisting, will open/update ${updates.length}:`);
    for (const u of updates) console.log(`  ~ ${u.name}`);
    console.log(`\nMissing, will insert ${inserts.length}:`);
    for (const i of inserts) console.log(`  + ${i.name}`);

    if (!confirmed) {
      console.log("\nDry run — nothing written. Re-run with --confirm.");
      return;
    }

    for (const u of updates) {
      await AwardCategory.updateOne({ _id: u.id }, { $set: u.fields });
    }
    if (inserts.length > 0) {
      await AwardCategory.insertMany(inserts, { ordered: false });
    }
    console.log(`\nDone. ${updates.length} updated, ${inserts.length} inserted.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
