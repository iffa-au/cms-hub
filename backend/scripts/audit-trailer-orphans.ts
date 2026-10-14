/**
 * Lists homepage trailer videos in S3 that no trailer entry points at.
 *
 *   npx tsx scripts/audit-trailer-orphans.ts
 *
 * READ-ONLY. There is no --confirm and no write path: this script cannot
 * modify the database or the bucket whatever flags it is given. Deciding what
 * to do about what it finds is a separate, deliberate step.
 *
 * Why these exist: the CMS uploads a trailer to S3 before the list is saved.
 * If that save then fails (409, validation, closed tab) the object stays in
 * the bucket with nothing referencing it. Saves themselves clean up keys they
 * stop referencing, so this only reports the abandoned-upload backlog.
 *
 * Needs AWS credentials with s3:ListBucket on the media bucket, plus
 * AWS_REGION and AWS_S3_BUCKET — run it where those exist, not on a developer
 * laptop without keys (it fails there with CredentialsProviderError).
 */

import "dotenv/config";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import mongoose from "mongoose";

import HomepageTrailers from "../models/homepageTrailers.model.js";
import { trailersPrefix } from "../libs/s3.js";

const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

async function main() {
  const uri = process.env.MONGO_URI;
  const { AWS_REGION, AWS_S3_BUCKET } = process.env;

  const missing = [
    !uri && "MONGO_URI",
    !AWS_REGION && "AWS_REGION",
    !AWS_S3_BUCKET && "AWS_S3_BUCKET",
  ].filter(Boolean);
  if (missing.length > 0) {
    console.error(`Missing env vars: ${missing.join(", ")}.`);
    process.exit(1);
  }

  // Enough of the host to recognise the cluster, without printing credentials.
  const host = uri!.replace(/^mongodb(\+srv)?:\/\/[^@]*@/, "").split("/")[0];
  const listPrefix = `${trailersPrefix()}/`;
  console.log(`Target database host: ${host}`);
  console.log(`Bucket: ${AWS_S3_BUCKET}, prefix: ${listPrefix}`);
  console.log("Mode: READ-ONLY (this script has no write path)\n");

  await mongoose.connect(uri!);

  try {
    const doc = await HomepageTrailers.findOne().lean();
    const referenced = new Set(
      (doc?.entries ?? []).map((e) => e.videoKey).filter(Boolean),
    );

    const client = new S3Client({ region: AWS_REGION });
    const orphans: Array<{ key: string; size: number; lastModified?: Date }> = [];
    let total = 0;
    let continuationToken: string | undefined;

    do {
      const listed = await client.send(
        new ListObjectsV2Command({
          Bucket: AWS_S3_BUCKET,
          Prefix: listPrefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const object of listed.Contents ?? []) {
        if (!object.Key) continue;
        total++;
        if (!referenced.has(object.Key)) {
          orphans.push({
            key: object.Key,
            size: object.Size ?? 0,
            lastModified: object.LastModified,
          });
        }
      }

      // IsTruncated rather than the token alone, as in deleteUploadedPrefix.
      continuationToken = listed.IsTruncated
        ? listed.NextContinuationToken
        : undefined;
    } while (continuationToken);

    console.log(
      `${total} object(s) under the prefix, ${referenced.size} referenced by an entry, ` +
        `${orphans.length} orphaned.`,
    );

    if (orphans.length === 0) {
      console.log("Nothing to clean up.");
      return;
    }

    console.log("\n--- orphaned objects ---");
    for (const o of orphans) {
      console.log(
        `  ${o.key}  ${formatSize(o.size)}  ${o.lastModified?.toISOString() ?? "—"}`,
      );
    }
    const bytes = orphans.reduce((sum, o) => sum + o.size, 0);
    console.log(`\nTotal orphaned: ${formatSize(bytes)}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
