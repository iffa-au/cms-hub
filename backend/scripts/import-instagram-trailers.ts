/**
 * Copies every not-yet-copied @iffaawards Instagram trailer into our S3 bucket,
 * so the public site plays it in its own player. The same work the CMS's
 * "Use IFFA player" button does, for films that were set up before it existed.
 *
 *   npx tsx scripts/import-instagram-trailers.ts            # dry run, writes nothing
 *   npx tsx scripts/import-instagram-trailers.ts --confirm  # writes
 *
 * WRITES TO PRODUCTION with --confirm: the backend's MONGO_URI points at the
 * live cluster from every environment (see AGENTS.md), and the copies go to the
 * live media bucket. Needs IG_ACCESS_TOKEN / IG_USER_ID, plus AWS credentials
 * that can s3:PutObject on the bucket (a laptop has none by default).
 *
 * Idempotent: a submission whose copy already matches its trailer link is
 * skipped.
 */

import "dotenv/config";
import mongoose from "mongoose";

import Submission from "../models/submission.model.js";
import { findOwnVideo, instagramShortcode, InstagramMediaError } from "../libs/instagram.js";
import {
  buildPublicUrl,
  copyVideoToSubmissionTrailers,
  deleteUploadedObject,
  isSubmissionTrailerKey,
} from "../libs/s3.js";

async function main() {
  const confirmed = process.argv.includes("--confirm");
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set.");
  console.log(confirmed ? "Mode: WRITING\n" : "Mode: dry run (pass --confirm to write)\n");

  await mongoose.connect(uri, { autoIndex: false });
  try {
    const rows = await Submission.find(
      { trailerUrl: { $regex: "instagram\\.com", $options: "i" } },
      { title: 1, trailerUrl: 1, trailerVideoUrl: 1, trailerVideoKey: 1, trailerVideoSource: 1 },
    );

    let copied = 0;
    for (const row of rows) {
      const label = String(row.title).padEnd(36);
      const code = instagramShortcode(row.trailerUrl);
      if (row.trailerVideoUrl && code && row.trailerVideoSource === code) {
        console.log(`${label} already copied`);
        continue;
      }

      let media;
      try {
        media = await findOwnVideo(row.trailerUrl);
      } catch (error) {
        if (error instanceof InstagramMediaError) {
          console.log(`${label} skipped: ${error.message}`);
          continue;
        }
        throw error;
      }

      if (!confirmed) {
        console.log(`${label} would copy reel ${media.shortcode}`);
        continue;
      }

      const key = await copyVideoToSubmissionTrailers(media.mediaUrl, row.title);
      const updated = await Submission.findOneAndUpdate(
        { _id: row._id, trailerUrl: row.trailerUrl },
        {
          $set: {
            trailerVideoUrl: buildPublicUrl(key),
            trailerVideoKey: key,
            trailerVideoSource: media.shortcode,
          },
        },
      );
      if (!updated) {
        await deleteUploadedObject(key);
        console.log(`${label} skipped: trailer link changed during the copy`);
        continue;
      }
      if (row.trailerVideoKey && isSubmissionTrailerKey(row.trailerVideoKey)) {
        await deleteUploadedObject(row.trailerVideoKey);
      }
      copied += 1;
      console.log(`${label} copied -> ${key}`);
    }

    console.log(`\n${confirmed ? "Copied" : "Would copy"}: ${confirmed ? copied : "see above"} of ${rows.length}.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
