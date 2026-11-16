/**
 * Reports, for every submission whose trailer is an Instagram link, whether the
 * site can play it in its own player (see libs/instagram.ts).
 *
 *   npx tsx scripts/check-instagram-trailers.ts
 *
 * READ-ONLY. It reads submissions from MongoDB and media from the Instagram
 * API, and writes nothing to either. Needs IG_ACCESS_TOKEN in backend/.env.
 */

import "dotenv/config";
import mongoose from "mongoose";

import Submission from "../models/submission.model.js";
import { instagramShortcode, listOwnMedia } from "../libs/instagram.js";

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set.");

  const media = await listOwnMedia();
  console.log(`@iffaawards media visible to the API: ${media.length}\n`);
  const byCode = new Map(media.map((m) => [m.shortcode, m]));

  await mongoose.connect(uri, { autoIndex: false });
  try {
    const rows = await Submission.find(
      { trailerUrl: { $regex: "instagram\\.com", $options: "i" } },
      { title: 1, status: 1, trailerUrl: 1 },
    ).lean();

    let ready = 0;
    for (const row of rows) {
      const code = instagramShortcode(row.trailerUrl);
      const found = code ? byCode.get(code) : undefined;
      const verdict = !code
        ? "not a post/reel link"
        : !found
          ? "NOT on @iffaawards (embed only)"
          : found.mediaType !== "VIDEO"
            ? `not a video (${found.mediaType})`
            : found.mediaUrl
              ? "OK: video file available"
              : "no video file (licensed audio?)";
      if (verdict.startsWith("OK")) ready += 1;
      console.log(`${String(row.title).padEnd(36)} ${String(row.status).padEnd(9)} ${code ?? "-"}  ${verdict}`);
    }
    console.log(`\n${ready} of ${rows.length} Instagram trailers can play in the site's own player.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
