/**
 * Seeds Talent Lab Events, Opportunities and Mentors from the public site's
 * built-in data files, so the CMS starts with exactly what iffa.com.au shows.
 *
 *   npx tsx scripts/seed-talent-lab.ts            # dry run: validates, writes nothing
 *   npx tsx scripts/seed-talent-lab.ts --confirm  # writes
 *   npx tsx scripts/seed-talent-lab.ts --site ../path/to/iffa-2026
 *
 * Reads iffa-2026's `src/modules/talent-lab/data/{events,opportunities,mentors}-data.ts`
 * (default: the sibling checkout `../../iffa-2026`). Each record goes through
 * the same validation as the CMS, so a dry run also proves the rules fit the
 * real content.
 *
 * WRITES TO PRODUCTION with --confirm (MONGO_URI is the live cluster from
 * every environment — see AGENTS.md). A kind that already has any records is
 * skipped entirely: this never overwrites staff edits. Re-running is safe.
 */

import "dotenv/config";
import path from "path";
import { pathToFileURL } from "url";
import mongoose from "mongoose";

import { KINDS, normalise } from "../controllers/talentLabContent.controller.js";

const SOURCES = {
  events: { file: "events-data.ts", exportName: "events" },
  opportunities: { file: "opportunities-data.ts", exportName: "opportunities" },
  mentors: { file: "mentors-data.ts", exportName: "mentors" },
} as const;

async function main() {
  const confirmed = process.argv.includes("--confirm");
  const siteArg = process.argv.indexOf("--site");
  const siteRoot = path.resolve(siteArg > -1 ? process.argv[siteArg + 1] : "../../iffa-2026");
  const dataDir = path.join(siteRoot, "src/modules/talent-lab/data");
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set.");

  console.log(confirmed ? "Mode: WRITING\n" : "Mode: dry run (pass --confirm to write)\n");
  console.log(`Reading site data from ${dataDir}\n`);

  // Validate everything before touching the database.
  const prepared: Record<string, Record<string, unknown>[]> = {};
  for (const [name, source] of Object.entries(SOURCES)) {
    const mod = await import(pathToFileURL(path.join(dataDir, source.file)).href);
    const rows = mod[source.exportName] as Record<string, unknown>[];
    const kind = KINDS[name as keyof typeof KINDS];
    prepared[name] = rows.map((row, index) => {
      try {
        return { ...normalise(kind, row), order: index, isPublished: true };
      } catch (error) {
        throw new Error(`${name}[${index}] (${String(row[kind.publicKey])}): ${(error as Error).message}`);
      }
    });
    console.log(`${name.padEnd(14)} ${rows.length} records valid`);
  }

  await mongoose.connect(uri, { autoIndex: !confirmed ? false : true });
  try {
    console.log("");
    for (const [name, docs] of Object.entries(prepared)) {
      const kind = KINDS[name as keyof typeof KINDS];
      const existing = await kind.model.estimatedDocumentCount();
      if (existing > 0) {
        console.log(`${name.padEnd(14)} skipped: already has ${existing} record(s)`);
        continue;
      }
      if (!confirmed) {
        console.log(`${name.padEnd(14)} would insert ${docs.length}`);
        continue;
      }
      await kind.model.insertMany(docs, { ordered: true });
      console.log(`${name.padEnd(14)} inserted ${docs.length}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
