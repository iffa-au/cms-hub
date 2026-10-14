/**
 * One-off import of the five homepage trailers that were hardcoded in the
 * public site (`iffa-2026/src/app/(root)/(marketing)/page.tsx`) before the
 * homepage trailer slots became CMS-driven.
 *
 *   npx tsx scripts/seed-homepage-trailers.ts            # dry run, writes nothing
 *   npx tsx scripts/seed-homepage-trailers.ts --confirm  # writes
 *
 * THIS WRITES TO THE PRODUCTION DATABASE. The backend's MONGO_URI points at
 * the live cluster from every environment, local included (see AGENTS.md), so
 * there is no "safe" place to try this out. Hence the explicit flag.
 *
 * Idempotent: if a HomepageTrailers document already exists, its titles are
 * printed and nothing is written — staff edits are never overwritten.
 *
 * Every videoUrl is checked with a HEAD request first, dry run included, and
 * the script aborts if any answers other than 200: the seed must not import a
 * dead link.
 *
 * The payload is inlined rather than imported from the sibling repo — a seed
 * has to keep working after the file it came from is deleted.
 */

import "dotenv/config";
import mongoose from "mongoose";

import HomepageTrailers from "../models/homepageTrailers.model.js";

const CF = "https://dhbdzeb2cbayq.cloudfront.net";

// Exactly what src/app/(root)/(marketing)/page.tsx in ../iffa-2026 renders today,
// in slot order. Inlined (not imported) so the seed keeps working after that
// page stops hardcoding them. videoKey is empty: these were transcoded to HLS
// by hand and are not ours to delete.
const SEED = [
  { title: "Oman: A Global Filming Destination", videoUrl: `${CF}/iffa/videos/oman-video/oman_bg.m3u8`, youtubeUrl: "https://www.youtube.com/watch?v=AdNUJTBD8Sk", learnMoreUrl: "/oman" },
  { title: "Club Kid", videoUrl: `${CF}/iffa/videos/Club_Kid/CLUB_KID.m3u8`, youtubeUrl: "https://youtu.be/dhj8K_KZsb8", learnMoreUrl: "" },
  { title: "Balandru", videoUrl: `${CF}/iffa/videos/balandrau/balandrau.m3u8`, youtubeUrl: "https://www.youtube.com/watch?v=-F3WzHG-m_I", learnMoreUrl: "" },
  { title: "Firebreak", videoUrl: `${CF}/iffa/videos/firebreak/firebreak.m3u8`, youtubeUrl: "https://youtu.be/5YXhpQ7wrL8?si=2ePMrOPQ0iXiczSD", learnMoreUrl: "" },
  { title: "The Stolen Girl", videoUrl: `${CF}/iffa/videos/hero3/hero-3.m3u8`, youtubeUrl: "https://www.youtube.com/watch?v=huMtYtMoN24", learnMoreUrl: "" },
].map((e) => ({ ...e, videoKey: "", isHidden: false }));

/** HTTP status of a HEAD request, or the error message when it never answered. */
async function headStatus(url: string): Promise<number | string> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.status;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

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
  console.log(`Payload: ${SEED.length} trailers.\n`);

  await mongoose.connect(uri);

  try {
    const existing = await HomepageTrailers.findOne().lean();
    if (existing) {
      console.log(
        `A homepage trailers document already exists (${existing._id}) — nothing to do.`,
      );
      for (const [index, entry] of existing.entries.entries()) {
        console.log(
          `  ${index + 1}. ${entry.title}${entry.isHidden ? " (hidden)" : ""}`,
        );
      }
      return;
    }

    let dead = 0;
    for (const [index, entry] of SEED.entries()) {
      const status = await headStatus(entry.videoUrl);
      if (status !== 200) dead++;
      console.log(`  insert ${index + 1}. ${entry.title}`);
      console.log(`         video   ${entry.videoUrl}  [HEAD ${status}]`);
      console.log(`         youtube ${entry.youtubeUrl || "—"}`);
      console.log(`         learn   ${entry.learnMoreUrl || "—"}`);
    }

    if (dead > 0) {
      console.error(
        `\nAborting: ${dead} video URL(s) did not answer HEAD 200. Nothing was written.`,
      );
      process.exitCode = 1;
      return;
    }

    if (!confirmed) {
      console.log(
        "\nDry run — nothing was written. Re-run with --confirm to apply to the " +
          "PRODUCTION database.",
      );
      return;
    }

    const created = await HomepageTrailers.create({ entries: SEED });
    console.log(`\nDone. Created homepage trailers document ${created._id}.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
