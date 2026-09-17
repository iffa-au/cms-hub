/**
 * Seeds the "Other Crew" credited-role list.
 *
 *   npx tsx scripts/seed-credit-roles.ts            # dry run, writes nothing
 *   npx tsx scripts/seed-credit-roles.ts --confirm  # writes
 *
 * THIS WRITES TO THE PRODUCTION DATABASE. The backend's MONGO_URI points at
 * the live cluster from every environment, local included (see AGENTS.md), so
 * there is no "safe" place to try this out. Hence the explicit flag.
 *
 * Idempotent, case-insensitively: a role already on the list is skipped, so a
 * re-run after a partial failure only inserts what is still missing, and
 * running it twice cannot produce "Editor" beside "editor".
 *
 * WHERE THESE 25 NAMES COME FROM. They are taken verbatim from the 90 entries
 * in the legacy `crewroles` collection — the vocabulary accumulated by the
 * 2022-2025 CrewAssignment workflow — keeping only entries that are:
 *
 *   - an actual role, not a department ("Art Department", "BTS", "Color")
 *   - not a misspelling ("Cinematopgraher", "Poducer", "Screenwritter")
 *   - not a duplicate under another spelling (Cinematographer / Cinematography
 *     / DOP all collapse to "Director of Photography"; "Video Editor" to
 *     "Editor"; "Colorist" to "Colourist", this being an Australian festival)
 *   - not a director, producer or actor credit — those four groups are covered
 *     by the fixed option sets in the client's lib/crew-roles.ts, and this
 *     list is explicitly everything else
 *
 * Nothing here is invented or reworded. Names that read poorly in a dropdown
 * ("PA", "Lighting Assist", "Characters Design") were dropped rather than
 * tidied up, because a seed script is the wrong place to make up vocabulary.
 * Add better versions from the CMS Metadata page.
 */

import "dotenv/config";
import mongoose from "mongoose";

import CreditRole from "../models/creditRole.model.js";

const SEED_ROLES = [
  // Directing (excluding Director / Co-Director)
  "First Assistant Director",

  // Writing
  "Writer",
  "Co-Writer",
  "Screenwriter",

  // Camera and lighting
  "Director of Photography",
  "First Assistant Camera",
  "Second Assistant Camera",
  "Data Wrangler",
  "Gaffer",
  "Grip",

  // Editing and post
  "Editor",
  "Colourist",
  "VFX Supervisor",
  "Visual Effects",
  "Title Design",

  // Sound and music
  "Sound Designer",
  "Sound Recordist",
  "Boom Operator",
  "Composer",

  // Art, wardrobe and makeup
  "Production Designer",
  "Art Director",
  "Wardrobe",
  "SFX Makeup",

  // Production
  "Production Manager",
  "Script Supervisor",
] as const;

// Matches the collation the controller queries and sorts with.
const CASE_INSENSITIVE = { locale: "en", strength: 2 } as const;

async function main() {
  const confirmed = process.argv.includes("--confirm");
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("MONGO_URI is not set. Nothing to connect to.");
    process.exit(1);
  }

  // A duplicate in the list above would be a typo in this file, not a data
  // condition. Catch it before touching the database.
  const seen = new Set(SEED_ROLES.map((role) => role.toLowerCase()));
  if (seen.size !== SEED_ROLES.length) {
    console.error("SEED_ROLES contains a duplicate. Fix the script.");
    process.exit(1);
  }

  // Enough of the host to recognise which cluster this is, without printing
  // credentials into a terminal or a CI log.
  const host = uri.replace(/^mongodb(\+srv)?:\/\/[^@]*@/, "").split("/")[0];
  console.log(`Target database host: ${host}`);
  console.log(`Seed list: ${SEED_ROLES.length} role(s)`);
  console.log(confirmed ? "Mode: WRITING\n" : "Mode: dry run (pass --confirm to write)\n");

  await mongoose.connect(uri);

  try {
    const existing = await CreditRole.find({}, { name: 1 }).lean();
    const existingByName = new Map(
      existing.map((role) => [String(role.name).toLowerCase(), String(role.name)]),
    );

    const toInsert: string[] = [];
    const skipped: string[] = [];

    for (const role of SEED_ROLES) {
      const match = existingByName.get(role.toLowerCase());
      if (match) skipped.push(match === role ? role : `${role} (stored as "${match}")`);
      else toInsert.push(role);
    }

    console.log(`Collection currently holds ${existing.length} role(s).`);

    if (skipped.length > 0) {
      console.log(`\nAlready present, skipping ${skipped.length}:`);
      for (const role of skipped) console.log(`  - ${role}`);
    }

    if (toInsert.length === 0) {
      console.log("\nNothing to insert. The list is already seeded.");
      return;
    }

    console.log(`\n${toInsert.length} role(s) to insert:`);
    for (const role of toInsert) console.log(`  + ${role}`);

    if (!confirmed) {
      console.log("\nDry run — nothing written. Re-run with --confirm.");
      return;
    }

    const created = await CreditRole.insertMany(
      toInsert.map((name) => ({ name, description: "" })),
      // Unordered: a name that slips past the pre-check because it was added
      // concurrently should not stop the rest of the batch.
      { ordered: false },
    );
    console.log(`\nDone. ${created.length} role(s) inserted.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
