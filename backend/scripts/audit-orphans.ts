/**
 * Lists rows that reference a record which no longer exists.
 *
 *   npx tsx scripts/audit-orphans.ts            # summary
 *   npx tsx scripts/audit-orphans.ts --ids      # summary plus every orphaned _id
 *
 * READ-ONLY. There is no --confirm and no write path: this script cannot
 * modify the database whatever flags it is given. Deciding what to do about
 * what it finds is a separate, deliberate step.
 *
 * Why these exist: delete endpoints used to remove a record without its
 * dependents. `deleteCrewRole` and `deleteCrewMember` had no cascade at all,
 * and `deleteSubmission`'s cascade was best-effort — it logged failures and
 * removed the submission anyway. The record vanished from the CMS and its
 * references stayed in Mongo, which is what "deleted from the CMS but not the
 * database" actually looked like.
 *
 * Those causes are fixed. This reports the backlog they left behind.
 */

import "dotenv/config";
import mongoose from "mongoose";

type Check = {
  /** Collection holding the reference. */
  from: string;
  /** Field on that collection pointing elsewhere. */
  field: string;
  /** Collection it should point into. */
  to: string;
  /** What a leftover row means, in one line. */
  note: string;
};

const CHECKS: Check[] = [
  {
    from: "crewassignments",
    field: "crewRoleId",
    to: "crewroles",
    note: "credit with a role label that no longer exists",
  },
  {
    from: "crewassignments",
    field: "crewMemberId",
    to: "crewmembers",
    note: "credit for a person no longer in the directory",
  },
  {
    from: "crewassignments",
    field: "submissionId",
    to: "submissions",
    note: "credit attached to a deleted film",
  },
  {
    from: "submissiongenres",
    field: "submissionId",
    to: "submissions",
    note: "genre link for a deleted film",
  },
  {
    from: "nominations",
    field: "submissionId",
    to: "submissions",
    note: "nomination for a deleted film",
  },
  {
    from: "nominations",
    field: "crewMemberId",
    to: "crewmembers",
    note: "nomination naming a person no longer in the directory",
  },
];

async function main() {
  const showIds = process.argv.includes("--ids");
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("MONGO_URI is not set. Nothing to connect to.");
    process.exit(1);
  }

  // Enough of the host to recognise the cluster, without printing credentials.
  const host = uri.replace(/^mongodb(\+srv)?:\/\/[^@]*@/, "").split("/")[0];
  console.log(`Target database host: ${host}`);
  console.log("Mode: READ-ONLY (this script has no write path)\n");

  await mongoose.connect(uri);

  try {
    const db = mongoose.connection.db!;
    const idCache = new Map<string, Set<string>>();

    const idsOf = async (collection: string) => {
      const cached = idCache.get(collection);
      if (cached) return cached;
      const docs = await db
        .collection(collection)
        .find({}, { projection: { _id: 1 } })
        .toArray();
      const set = new Set(docs.map((d) => String(d._id)));
      idCache.set(collection, set);
      return set;
    };

    let grandTotal = 0;
    const detail: Array<{ check: Check; ids: string[] }> = [];

    for (const check of CHECKS) {
      const target = await idsOf(check.to);
      const rows = await db
        .collection(check.from)
        .find({}, { projection: { [check.field]: 1 } })
        .toArray();

      const orphans = rows.filter((row) => {
        const ref = (row as Record<string, unknown>)[check.field];
        return ref && !target.has(String(ref));
      });

      grandTotal += orphans.length;
      detail.push({ check, ids: orphans.map((o) => String(o._id)) });

      const label = `${check.from}.${check.field} -> ${check.to}`;
      console.log(
        `${label.padEnd(46)} ${String(orphans.length).padStart(5)} orphaned / ${rows.length}`,
      );
    }

    // Stored as one singleton with an ordered array, so it is counted by
    // entry rather than by document.
    const submissionIds = await idsOf("submissions");
    const featured = await db.collection("featuredfilms").find({}).toArray();
    const deadEntries: string[] = [];
    let entryCount = 0;
    for (const doc of featured) {
      for (const entry of ((doc as any).entries ?? []) as Array<{
        submissionId?: unknown;
      }>) {
        entryCount++;
        const ref = entry?.submissionId;
        if (ref && !submissionIds.has(String(ref))) deadEntries.push(String(ref));
      }
    }
    grandTotal += deadEntries.length;
    console.log(
      `${"featuredfilms.entries[].submissionId".padEnd(46)} ${String(deadEntries.length).padStart(5)} dead ref / ${entryCount}`,
    );

    console.log(`\nTotal orphaned references: ${grandTotal}`);

    if (grandTotal === 0) {
      console.log("Nothing to clean up.");
      return;
    }

    if (!showIds) {
      console.log("Re-run with --ids to list every affected _id.");
      return;
    }

    console.log("\n--- affected records ---");
    for (const { check, ids } of detail) {
      if (ids.length === 0) continue;
      console.log(`\n${check.from}.${check.field} (${check.note}) — ${ids.length}:`);
      for (const id of ids) console.log(`  ${id}`);
    }
    if (deadEntries.length > 0) {
      console.log(
        `\nfeaturedfilms entries pointing at a deleted film — ${deadEntries.length}:`,
      );
      for (const id of deadEntries) console.log(`  submissionId ${id}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
